import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/types";
import { buildSeedDatabase } from "@/server/seed";
import { reconcile, seatStates } from "@/server/reconcile";
import {
  cancelByAdmin,
  cancelByCustomer,
  checkout,
  checkoutInput,
  createHold,
  getHoldView,
  lookupBooking,
  ownedBooking,
  releaseHold,
  resolvePendingPayment,
  setHoldExtras,
} from "@/server/core/booking";
import { validateTicket } from "@/server/core/tickets";
import { createScreening, dashboardMetrics, findConflict, updateAuditorium, updateMovie, updateScreening } from "@/server/core/admin";
import { parseLayout } from "@/lib/seating";
import { ServiceError } from "@/server/errors";

const NOW = new Date("2026-10-12T09:00:00.000Z");
let db: Database;

/** An upcoming Grand Hall screening and some of its free seats. */
function freeSeats(n: number, category = "standard") {
  const scr = db.screenings.find((s) => Date.parse(s.startsAt) > NOW.getTime() + 3 * 3600_000 && s.auditoriumId === "aud_grand")!;
  const aud = db.auditoriums.find((a) => a.id === scr.auditoriumId)!;
  const states = seatStates(db, scr.id, NOW);
  const seats = parseLayout(aud.rows)
    .filter((s) => !states.has(s.id) && s.category === category)
    .slice(0, n)
    .map((s) => s.id);
  return { scr, seats };
}
const customer = { name: "Test Customer", phone: "+231 77 555 1234", email: "test@example.com" };
const errCode = (err: unknown) => (err as ServiceError).code;
const v = (code: string, collectPayment = false) => ({ code, admit: true, collectPayment, allowOtherDay: false });

beforeEach(() => {
  db = buildSeedDatabase(NOW);
});

describe("seed data", () => {
  it("has the required demo scale", () => {
    expect(db.movies.length).toBeGreaterThanOrEqual(6);
    expect(db.movies.some((m) => m.status === "coming_soon")).toBe(true);
    expect(db.auditoriums).toHaveLength(2);
    expect(new Set(db.screenings.map((s) => s.startsAt.slice(0, 10))).size).toBeGreaterThanOrEqual(3);
    const statuses = new Set(db.bookings.map((b) => b.status));
    expect(statuses.has("confirmed") && statuses.has("reserved") && statuses.has("cancelled")).toBe(true);
    expect(db.settings.name).toBe("Monrovia Cinema Plus");
  });

  it("never seeds two active bookings on the same seat of the same screening", () => {
    const seen = new Set<string>();
    for (const b of db.bookings.filter((x) => ["confirmed", "reserved", "pending_payment"].includes(x.status))) {
      for (const i of b.items) {
        const k = `${b.screeningId}:${i.seatId}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });
});

describe("holds", () => {
  it("creates a hold that blocks seats for that screening only", () => {
    const { scr, seats } = freeSeats(2);
    createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    expect(seatStates(db, scr.id, NOW).get(seats[0])).toBe("held");
    const holdsElsewhere = db.holds.filter((h) => h.screeningId !== scr.id && h.status === "active" && h.seatIds.includes(seats[0]));
    const other = db.screenings.find((s) => s.id !== scr.id && s.auditoriumId === scr.auditoriumId && !holdsElsewhere.some((h) => h.screeningId === s.id))!;
    const bookedThere = db.bookings.some((b) => b.screeningId === other.id && b.items.some((i) => i.seatId === seats[0]) && ["confirmed", "reserved", "pending_payment"].includes(b.status));
    expect(seatStates(db, other.id, NOW).has(seats[0])).toBe(bookedThere);
  });

  it("rejects occupied seats, duplicates, unknown seats and the ticket limit", () => {
    const { scr, seats } = freeSeats(9);
    const occupied = db.bookings.find((b) => b.screeningId === scr.id && b.status === "confirmed")!.items[0].seatId;
    expect(() => createHold(db, NOW, { screeningId: scr.id, seatIds: [occupied] })).toThrow(/taken/);
    expect(() => createHold(db, NOW, { screeningId: scr.id, seatIds: [seats[0], seats[0]] })).toThrow(/Duplicate/);
    expect(() => createHold(db, NOW, { screeningId: scr.id, seatIds: ["Z9"] })).toThrow(/Unknown/);
    expect(() => createHold(db, NOW, { screeningId: scr.id, seatIds: seats })).toThrow(/up to 8/);
  });

  it("prevents two customers holding the same seat", () => {
    const { scr, seats } = freeSeats(1);
    createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    try {
      createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
      expect.unreachable();
    } catch (e) {
      expect(errCode(e)).toBe("SEAT_UNAVAILABLE");
    }
  });

  it("expires holds and releases their seats", () => {
    const { scr, seats } = freeSeats(2);
    const { hold, holdKey } = createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    const later = new Date(NOW.getTime() + (db.settings.holdMinutes + 1) * 60_000);
    expect(reconcile(db, later)).toBe(true);
    expect(hold.status).toBe("expired");
    expect(seatStates(db, scr.id, later).has(seats[0])).toBe(false);
    expect(() =>
      checkout(db, later, { holdId: hold.id, holdKey, idempotencyKey: "idem-expired", method: "pay_at_cinema", customer }),
    ).toThrow(/expired/);
  });

  it("requires the secret hold key", () => {
    const { scr, seats } = freeSeats(1);
    const { hold } = createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    expect(() => getHoldView(db, NOW, hold.id, "wrong-key-wrong-key")).toThrow(/not found/);
    expect(() => releaseHold(db, hold.id, "wrong-key-wrong-key")).toThrow();
  });
});

describe("checkout", () => {
  function hold(n = 2) {
    const { scr, seats } = freeSeats(n);
    return { scr, seats, ...createHold(db, NOW, { screeningId: scr.id, seatIds: seats }) };
  }

  it("confirms a successful demo payment with server-computed totals", () => {
    const h = hold(2);
    const r = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-ok-1", method: "demo_online", demoOutcome: "succeeded", customer });
    expect(r.kind).toBe("booking");
    const b = db.bookings.find((x) => r.kind === "booking" && x.reference === r.reference)!;
    expect(b.status).toBe("confirmed");
    expect(b.paymentStatus).toBe("paid");
    expect(b.totalCents).toBe(h.scr.prices.standard * 2);
    expect(b.reference).toMatch(/^MCP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(b.ticketToken.length).toBeGreaterThanOrEqual(32);
    expect(seatStates(db, h.scr.id, NOW).get(h.seats[0])).toBe("occupied");
  });

  it("is idempotent: double submits and re-submits return the same booking", () => {
    const h = hold(2);
    const input = { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-dup-1", method: "demo_online" as const, demoOutcome: "succeeded" as const, customer };
    const a = checkout(db, NOW, input);
    const b = checkout(db, NOW, input);
    const c = checkout(db, NOW, { ...input, idempotencyKey: "idem-dup-2" });
    if (a.kind !== "booking" || b.kind !== "booking" || c.kind !== "booking") throw new Error("expected bookings");
    expect(b.reference).toBe(a.reference);
    expect(c.reference).toBe(a.reference);
    expect(c.duplicate).toBe(true);
    expect(db.bookings.filter((x) => x.holdId === h.hold.id)).toHaveLength(1);
  });

  it("keeps the hold after a failed payment so the customer can retry", () => {
    const h = hold(1);
    const failed = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-f-1", method: "demo_online", demoOutcome: "failed", customer });
    expect(failed.kind).toBe("payment_failed");
    expect(h.hold.status).toBe("active");
    expect(db.bookings.some((x) => x.holdId === h.hold.id)).toBe(false);
    const ok = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-f-2", method: "demo_online", demoOutcome: "succeeded", customer });
    expect(ok.kind).toBe("booking");
  });

  it("handles pending payments: confirmation and expiry", () => {
    const h1 = hold(1);
    const p = checkout(db, NOW, { holdId: h1.hold.id, holdKey: h1.holdKey, idempotencyKey: "idem-p-1", method: "demo_online", demoOutcome: "pending", customer });
    if (p.kind !== "booking") throw new Error("expected booking");
    expect(p.status).toBe("pending_payment");
    expect(seatStates(db, h1.scr.id, NOW).get(h1.seats[0])).toBe("held");
    expect(resolvePendingPayment(db, NOW, p.reference, p.accessKey, "confirm").status).toBe("confirmed");

    const { scr, seats } = freeSeats(1);
    const h2 = createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    const p2 = checkout(db, NOW, { holdId: h2.hold.id, holdKey: h2.holdKey, idempotencyKey: "idem-p-2", method: "demo_online", demoOutcome: "pending", customer });
    if (p2.kind !== "booking") throw new Error("expected booking");
    const later = new Date(NOW.getTime() + (db.settings.pendingPaymentMinutes + 1) * 60_000);
    reconcile(db, later);
    expect(ownedBooking(db, p2.reference, p2.accessKey).status).toBe("expired");
    expect(seatStates(db, scr.id, later).has(seats[0])).toBe(false);
  });

  it("creates an unpaid reservation for Pay at Cinema", () => {
    const h = hold(1);
    const r = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-pac", method: "pay_at_cinema", customer });
    if (r.kind !== "booking") throw new Error("expected booking");
    expect(r.status).toBe("reserved");
    expect(db.bookings.find((b) => b.reference === r.reference)!.paymentStatus).toBe("unpaid");
  });

  it("validates customer details", () => {
    const base = { holdId: "h", holdKey: "k".repeat(20), idempotencyKey: "i".repeat(10), method: "pay_at_cinema" };
    expect(checkoutInput.safeParse({ ...base, customer: { name: "A", phone: "12" } }).success).toBe(false);
    expect(checkoutInput.safeParse({ ...base, customer: { name: "Ann Doe", phone: "+231 77 123 4567", email: "bad" } }).success).toBe(false);
    expect(checkoutInput.safeParse({ ...base, customer: { name: "Ann Doe", phone: "+231 77 123 4567", email: "" } }).success).toBe(true);
  });
});

describe("lookup, validation, cancellation", () => {
  let n = 0;
  function book(method: "demo_online" | "pay_at_cinema" = "demo_online") {
    const { scr, seats } = freeSeats(2);
    const h = createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
    const r = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: `idem-book-${n++}`, method, demoOutcome: "succeeded", customer });
    if (r.kind !== "booking") throw new Error("expected booking");
    const booking = db.bookings.find((b) => b.reference === r.reference)!;
    return { scr, seats, booking, reference: r.reference, accessKey: r.accessKey };
  }

  it("finds bookings only with matching contact details", () => {
    const { reference, accessKey } = book();
    expect(lookupBooking(db, { reference, contact: "test@example.com" })?.accessKey).toBe(accessKey);
    expect(lookupBooking(db, { reference: reference.toLowerCase(), contact: "0775551234" })).not.toBeNull();
    expect(lookupBooking(db, { reference, contact: "someone@else.com" })).toBeNull();
    expect(lookupBooking(db, { reference, contact: "+231 88 999 0000" })).toBeNull();
    expect(lookupBooking(db, { reference: "MCP-ZZZZ-ZZZZ", contact: "test@example.com" })).toBeNull();
  });

  it("redeems a valid ticket exactly once", () => {
    const { booking } = book();
    const start = Date.parse(db.screenings.find((s) => s.id === booking.screeningId)!.startsAt);
    const at = new Date(start - 20 * 60_000);
    const first = validateTicket(db, at, v(`MCP1:${booking.ticketToken}`), "staff@x");
    expect(first.outcome).toBe("admitted");
    expect(first.admitted).toBe(true);
    expect(validateTicket(db, at, v(`MCP1:${booking.ticketToken}`), "staff@x").outcome).toBe("already_redeemed");
    expect(validateTicket(db, at, v(booking.reference), "staff@x").outcome).toBe("already_redeemed");
  });

  it("rejects invalid, cancelled and unpaid tickets", () => {
    expect(validateTicket(db, NOW, v("MCP1:not-a-real-token-xxxxxxxxxxxxxxx"), "s").outcome).toBe("invalid");
    expect(validateTicket(db, NOW, v("hello"), "s").outcome).toBe("invalid");

    const unpaid = book("pay_at_cinema");
    expect(validateTicket(db, NOW, v(unpaid.booking.ticketToken), "s").outcome).toBe("unpaid");
    expect(validateTicket(db, NOW, v(unpaid.booking.ticketToken, true), "s").outcome).toBe("admitted");
    expect(unpaid.booking.paymentStatus).toBe("paid");

    const c = book();
    cancelByAdmin(db, NOW, c.booking.id, "test");
    expect(c.booking.paymentStatus).toBe("refunded");
    expect(seatStates(db, c.scr.id, NOW).has(c.seats[0])).toBe(false);
    expect(validateTicket(db, NOW, v(c.booking.ticketToken), "s").outcome).toBe("cancelled");
  });

  it("lets customers cancel only unpaid bookings", () => {
    const paid = book();
    expect(() => cancelByCustomer(db, NOW, paid.reference, paid.accessKey)).toThrow(/box office/);
    const unpaid = book("pay_at_cinema");
    expect(cancelByCustomer(db, NOW, unpaid.reference, unpaid.accessKey).status).toBe("cancelled");
    expect(() => cancelByCustomer(db, NOW, unpaid.reference, "wrong-key-wrong-key")).toThrow(/not found/);
  });

  it("does not cancel admitted tickets", () => {
    const { booking } = book();
    validateTicket(db, NOW, v(booking.ticketToken), "s");
    expect(() => cancelByAdmin(db, NOW, booking.id, "x")).toThrow(/admitted/);
  });
});

describe("admin rules", () => {
  it("detects screening conflicts in the same auditorium", () => {
    const s = db.screenings.find((x) => Date.parse(x.startsAt) > NOW.getTime() && x.auditoriumId === "aud_grand")!;
    const at = new Date(Date.parse(s.startsAt) + 30 * 60_000);
    expect(findConflict(db, { auditoriumId: s.auditoriumId, movieId: s.movieId, startsAt: at.toISOString() })?.id).toBe(s.id);
    expect(() =>
      createScreening(db, NOW, {
        movieId: s.movieId,
        auditoriumId: s.auditoriumId,
        date: at.toISOString().slice(0, 10),
        time: at.toISOString().slice(11, 16),
        format: "2D",
        prices: { standard: 700, vip: 1200, accessible: 700 },
        status: "scheduled",
      }),
    ).toThrow(/Conflicts/);
  });

  it("allows a non-overlapping screening and stores it in UTC", () => {
    const sc = createScreening(db, NOW, { movieId: "mov_forgotten_island", auditoriumId: "aud_grand", date: "2026-10-20", time: "09:00", format: "2D", prices: { standard: 500, vip: 900, accessible: 500 }, status: "scheduled" });
    expect(sc.startsAt).toBe("2026-10-20T09:00:00.000Z");
  });

  it("refuses layout changes that would remove booked seats", () => {
    const aud = db.auditoriums.find((a) => a.id === "aud_lounge")!;
    expect(() => updateAuditorium(db, NOW, aud.id, { name: aud.name, description: "", rows: [{ label: "A", pattern: "SS" }] })).toThrow(/can't be removed/);
  });

  it("computes dashboard metrics from stored bookings", () => {
    const m = dashboardMetrics(db, NOW);
    const paidTotal = db.bookings.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + b.totalCents, 0);
    expect(m.revenueCents).toBe(paidTotal);
    expect(m.upcoming.length).toBeGreaterThan(0);
  });
});

describe("snacks & drinks", () => {
  function heldSeats(n = 2) {
    const { scr, seats } = freeSeats(n);
    return { scr, ...createHold(db, NOW, { screeningId: scr.id, seatIds: seats }) };
  }

  it("prices snacks on the server and adds them to the booking total", () => {
    const h = heldSeats(2);
    const r = setHoldExtras(db, h.hold.id, {
      holdKey: h.holdKey,
      extras: [
        { itemId: "con_popcorn", variantId: "l", qty: 1 },
        { itemId: "con_soda", variantId: "m", qty: 2 },
      ],
    });
    expect(r.totalCents).toBe(600 + 2 * 200);
    const view = getHoldView(db, NOW, h.hold.id, h.holdKey);
    expect(view.grandTotalCents).toBe(view.quote.totalCents + 1000);
    const done = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-snacks-1", method: "demo_online", demoOutcome: "succeeded", customer });
    if (done.kind !== "booking") throw new Error("expected booking");
    const b = db.bookings.find((x) => x.reference === done.reference)!;
    expect(b.totalCents).toBe(h.scr.prices.standard * 2 + 1000);
    expect(b.concessions?.map((c) => c.name)).toEqual(["Butter Popcorn", "Soft Drink"]);
  });

  it("skipping snacks keeps the ticket-only total", () => {
    const h = heldSeats(1);
    expect(setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [] }).totalCents).toBe(0);
    const done = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-snacks-2", method: "pay_at_cinema", customer });
    if (done.kind !== "booking") throw new Error("expected booking");
    const b = db.bookings.find((x) => x.reference === done.reference)!;
    expect(b.concessions).toBeUndefined();
    expect(b.totalCents).toBe(h.scr.prices.standard);
  });

  it("merges duplicate lines and rejects unknown, sold-out or excessive items", () => {
    const h = heldSeats(1);
    const merged = setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_water", variantId: "r", qty: 2 }, { itemId: "con_water", variantId: "r", qty: 1 }] });
    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0].qty).toBe(3);
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_nope", variantId: "r", qty: 1 }] })).toThrow(/no longer on the menu/);
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_popcorn", variantId: "xl", qty: 1 }] })).toThrow();
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_water", variantId: "r", qty: 6 }, { itemId: "con_water", variantId: "r", qty: 6 }] })).toThrow(/up to 10/);
    db.concessions.find((c) => c.id === "con_nachos")!.available = false;
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_nachos", variantId: "r", qty: 1 }] })).toThrow(/sold out/);
  });

  it("blocks checkout if a chosen snack sells out before payment", () => {
    const h = heldSeats(1);
    setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_hotdog", variantId: "r", qty: 1 }] });
    db.concessions.find((c) => c.id === "con_hotdog")!.available = false;
    expect(() => checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-snacks-3", method: "pay_at_cinema", customer })).toThrow(/sold out/);
  });

  it("requires the hold key and an active hold", () => {
    const h = heldSeats(1);
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: "wrong-key-wrong-key", extras: [] })).toThrow(/not found/);
    reconcile(db, new Date(NOW.getTime() + 60 * 60_000));
    expect(() => setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [] })).toThrow(/expired/);
  });

  it("includes snacks in the staff validation result", () => {
    const h = heldSeats(1);
    setHoldExtras(db, h.hold.id, { holdKey: h.holdKey, extras: [{ itemId: "con_combo_night", variantId: "r", qty: 1 }] });
    const done = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-snacks-4", method: "demo_online", demoOutcome: "succeeded", customer });
    if (done.kind !== "booking") throw new Error("expected booking");
    const res = validateTicket(db, NOW, v(done.reference), "staff@x");
    expect(res.booking?.concessions).toEqual([{ name: "Movie Night Combo", variantLabel: "Regular", qty: 1 }]);
  });
});

describe("audit fixes", () => {
  function heldFor(scr: (typeof db.screenings)[number], n = 1) {
    const aud = db.auditoriums.find((a) => a.id === scr.auditoriumId)!;
    const states = seatStates(db, scr.id, NOW);
    const seats = parseLayout(aud.rows).filter((s) => !states.has(s.id) && s.category === "standard").slice(0, n).map((s) => s.id);
    return createHold(db, NOW, { screeningId: scr.id, seatIds: seats });
  }
  const tomorrowScreening = () => db.screenings.find((s) => s.startsAt.startsWith("2026-10-13"))!;

  it("refuses to admit a ticket for another day unless staff override", () => {
    const h = heldFor(tomorrowScreening());
    const r = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-day-1", method: "demo_online", demoOutcome: "succeeded", customer });
    if (r.kind !== "booking") throw new Error("expected booking");
    const first = validateTicket(db, NOW, v(r.reference), "s");
    expect(first.outcome).toBe("not_today");
    expect(first.admitted).toBe(false);
    expect(db.bookings.find((b) => b.reference === r.reference)!.redeemedAt).toBeUndefined();
    const override = validateTicket(db, NOW, { ...v(r.reference), allowOtherDay: true }, "s");
    expect(override.outcome).toBe("admitted");
  });

  it("logs check-only scans as 'checked', not 'admitted'", () => {
    const scr = db.screenings.find((s) => s.startsAt.startsWith("2026-10-12") && Date.parse(s.startsAt) > NOW.getTime() + 3600_000)!;
    const h = heldFor(scr);
    const r = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-chk-1", method: "demo_online", demoOutcome: "succeeded", customer });
    if (r.kind !== "booking") throw new Error("expected booking");
    const res = validateTicket(db, NOW, { ...v(r.reference), admit: false }, "s");
    expect(res.admitted).toBe(false);
    expect(db.redemptions.at(-1)!.outcome).toBe("checked");
  });

  it("does not take Pay-at-Cinema reservations after the film has started, and caps pending payments", () => {
    const scr = db.screenings.find((s) => s.startsAt.startsWith("2026-10-12") && Date.parse(s.startsAt) > NOW.getTime())!;
    const start = Date.parse(scr.startsAt);
    const h = heldFor(scr, 2);
    const during = new Date(start + 5 * 60_000);
    h.hold.expiresAt = new Date(during.getTime() + 600_000).toISOString();
    expect(() => checkout(db, during, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-late-1", method: "pay_at_cinema", customer })).toThrow(/already started/);
    const p = checkout(db, during, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-late-2", method: "demo_online", demoOutcome: "pending", customer });
    if (p.kind !== "booking") throw new Error("expected booking");
    const b = db.bookings.find((x) => x.reference === p.reference)!;
    expect(Date.parse(b.expiresAt!)).toBeLessThanOrEqual(start + 10 * 60_000);
    expect(() => resolvePendingPayment(db, new Date(start + 15 * 60_000), p.reference, p.accessKey, "confirm")).toThrow(/sales for this screening have closed/);
  });

  it("treats cancelling an already-expired booking as a no-op", () => {
    const h = heldFor(tomorrowScreening());
    const p = checkout(db, NOW, { holdId: h.hold.id, holdKey: h.holdKey, idempotencyKey: "idem-exp-1", method: "demo_online", demoOutcome: "pending", customer });
    if (p.kind !== "booking") throw new Error("expected booking");
    const later = new Date(NOW.getTime() + 60 * 60_000);
    reconcile(db, later);
    expect(cancelByCustomer(db, later, p.reference, p.accessKey).status).toBe("expired");
  });
});

describe("admin audit fixes", () => {
  const futureWithBookings = () =>
    db.screenings.find((s) => Date.parse(s.startsAt) > NOW.getTime() + 3600_000 && db.bookings.some((b) => b.screeningId === s.id && ["confirmed", "reserved"].includes(b.status)))!;
  const asInput = (s: (typeof db.screenings)[number], patch: Partial<{ date: string; time: string; auditoriumId: string; movieId: string; status: "scheduled" | "cancelled" }> = {}) => ({
    movieId: s.movieId,
    auditoriumId: s.auditoriumId,
    date: s.startsAt.slice(0, 10),
    time: s.startsAt.slice(11, 16),
    format: s.format,
    prices: s.prices,
    status: s.status,
    ...patch,
  });

  it("validates auditorium and movie on screening edits", () => {
    const s = db.screenings.find((x) => Date.parse(x.startsAt) > NOW.getTime())!;
    expect(() => updateScreening(db, NOW, s.id, asInput(s, { auditoriumId: "aud_nope" }))).toThrow(/auditorium/);
    expect(() => updateScreening(db, NOW, s.id, asInput(s, { movieId: "mov_nope", status: "cancelled" }))).toThrow(/movie/);
  });

  it("won't move a screening into the past, or move one that has sold tickets", () => {
    const s = futureWithBookings();
    expect(() => updateScreening(db, NOW, s.id, asInput(s, { date: "2026-10-01" }))).toThrow(/past/);
    const later = new Date(Date.parse(s.startsAt) + 30 * 60_000).toISOString();
    expect(() => updateScreening(db, NOW, s.id, asInput(s, { time: later.slice(11, 16) }))).toThrow(/can't be moved/);
    // Price changes are still allowed.
    const before = s.prices.standard;
    const updated = updateScreening(db, NOW, s.id, { ...asInput(s), prices: { ...s.prices, standard: before + 100 } });
    expect(updated.prices.standard).toBe(before + 100);
  });

  it("rejects a runtime change that would make screenings overlap", () => {
    const m = db.movies.find((x) => x.id === "mov_digger")!;
    const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...fields } = m;
    const rest = { ...fields, posterUrl: m.posterUrl, backdropUrl: m.backdropUrl, trailerUrl: m.trailerUrl };
    expect(() => updateMovie(db, NOW, m.id, { ...rest, runtimeMin: 300 })).toThrow(/overlap/);
    expect(updateMovie(db, NOW, m.id, { ...rest, runtimeMin: 130 }).runtimeMin).toBe(130);
  });

  it("blocks layout edits that would move or re-categorise a booked seat", () => {
    const aud = db.auditoriums.find((a) => a.id === "aud_lounge")!;
    const bookedRow = db.bookings.find((b) => b.status === "confirmed" && db.screenings.find((s) => s.id === b.screeningId)!.auditoriumId === aud.id && Date.parse(db.screenings.find((s) => s.id === b.screeningId)!.startsAt) > NOW.getTime())!.items[0].seatId.replace(/\d+$/, "");
    const rows = aud.rows.map((r) => (r.label === bookedRow ? { ...r, pattern: `.${r.pattern}` } : r)); // shifts every seat in that row
    expect(() => updateAuditorium(db, NOW, aud.id, { name: aud.name, description: aud.description, rows })).toThrow(/moved or re-categorised/);
  });

  it("does not count cancelled bookings as today's bookings", () => {
    const m = dashboardMetrics(db, NOW);
    const todayKey = "2026-10-12";
    const expected = db.bookings.filter((b) => b.createdAt.slice(0, 10) === todayKey && b.status !== "cancelled" && b.status !== "expired").length;
    expect(m.todayBookings).toBe(expected);
  });

  it("rejects empty or non-integer prices instead of saving $0", async () => {
    const { screeningInput } = await import("@/server/core/admin");
    const base = { movieId: "m", auditoriumId: "a", date: "2026-10-20", time: "19:00", format: "2D" };
    expect(screeningInput.safeParse({ ...base, prices: { standard: null, vip: 1200, accessible: 700 } }).success).toBe(false);
    expect(screeningInput.safeParse({ ...base, prices: { standard: "", vip: 1200, accessible: 700 } }).success).toBe(false);
    expect(screeningInput.safeParse({ ...base, prices: { standard: 700, vip: 1200, accessible: 700 } }).success).toBe(true);
  });
});

describe("snack cart display", () => {
  it("keeps lines visible and reports problems when the cart is over the limit or sold out", async () => {
    const { describeCart } = await import("@/lib/concessions");
    const over = describeCart(
      [
        { itemId: "con_water", variantId: "r", qty: 10 },
        { itemId: "con_hotdog", variantId: "r", qty: 10 },
        { itemId: "con_nachos", variantId: "r", qty: 10 },
        { itemId: "con_icecream", variantId: "r", qty: 1 },
      ],
      db.concessions,
    );
    expect(over.lines).toHaveLength(4);
    expect(over.units).toBe(31);
    expect(over.problems[0]).toMatch(/limited to 30/);
    db.concessions.find((c) => c.id === "con_nachos")!.available = false;
    const soldOut = describeCart([{ itemId: "con_nachos", variantId: "r", qty: 1 }], db.concessions);
    expect(soldOut.lines).toHaveLength(1);
    expect(soldOut.problems[0]).toMatch(/sold out/);
  });
});
