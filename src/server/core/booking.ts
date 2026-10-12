// Booking business rules. Every function here operates on an in-memory Database inside a
// store transaction, so check-then-write sequences are atomic. Prices are always computed here
// from the screening's price table — client-supplied prices are never accepted.
import { z } from "zod";
import type { Booking, Database, PaymentAttempt, PaymentOutcome, SeatHold } from "@/lib/types";
import { quoteSeats, seatMap } from "@/lib/seating";
import { quoteConcessions } from "@/lib/concessions";
import { fail } from "../errors";
import { newBookingReference, newId, newPaymentReference, newSecret, safeEqual, sha256 } from "../ids";
import { seatStates } from "../reconcile";

/** Online sales close this many minutes after the advertised start time (trailers). */
export const SALES_CLOSE_AFTER_START_MIN = 10;

export function screeningContext(db: Database, screeningId: string) {
  const screening = db.screenings.find((s) => s.id === screeningId);
  if (!screening) fail("NOT_FOUND", "That screening could not be found.");
  const movie = db.movies.find((m) => m.id === screening.movieId);
  const auditorium = db.auditoriums.find((a) => a.id === screening.auditoriumId);
  if (!movie || !auditorium) fail("NOT_FOUND", "That screening could not be found.");
  return { screening, movie, auditorium };
}

export function isOnSale(db: Database, screeningId: string, now: Date): boolean {
  const { screening, movie } = screeningContext(db, screeningId);
  return (
    screening.status === "scheduled" &&
    movie.published &&
    movie.status === "now_showing" &&
    Date.parse(screening.startsAt) + SALES_CLOSE_AFTER_START_MIN * 60_000 > now.getTime()
  );
}

// ── Holds ────────────────────────────────────────────────────────────────

export const createHoldInput = z.object({
  screeningId: z.string().min(1).max(100),
  seatIds: z.array(z.string().regex(/^[A-Z]{1,2}\d{1,2}$/)).min(1).max(20),
});

export function createHold(db: Database, now: Date, input: z.infer<typeof createHoldInput>) {
  const { screening, auditorium } = screeningContext(db, input.screeningId);
  if (!isOnSale(db, screening.id, now)) fail("SCREENING_CLOSED", "Online booking for this screening has closed.");

  const seatIds = [...new Set(input.seatIds)];
  if (seatIds.length !== input.seatIds.length) fail("BAD_REQUEST", "Duplicate seats in selection.");
  const max = db.settings.maxTicketsPerBooking;
  if (seatIds.length > max) fail("LIMIT", `You can book up to ${max} tickets at a time.`);

  const seats = seatMap(auditorium);
  const unknown = seatIds.filter((id) => !seats.has(id));
  if (unknown.length) fail("BAD_REQUEST", `Unknown seat(s): ${unknown.join(", ")}`);

  const states = seatStates(db, screening.id, now);
  const taken = seatIds.filter((id) => states.has(id));
  if (taken.length) {
    fail("SEAT_UNAVAILABLE", `Sorry — ${taken.join(", ")} ${taken.length > 1 ? "were" : "was"} just taken. Please choose again.`, {
      seats: taken,
    });
  }

  const holdKey = newSecret();
  const hold: SeatHold = {
    id: newId("hold"),
    screeningId: screening.id,
    seatIds,
    keyHash: sha256(holdKey),
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + db.settings.holdMinutes * 60_000).toISOString(),
  };
  db.holds.push(hold);
  return { hold, holdKey };
}

function ownedHold(db: Database, holdId: string, holdKey: string) {
  const hold = db.holds.find((h) => h.id === holdId);
  // Same error for "missing" and "wrong key" so hold ids can't be probed.
  if (!hold || !holdKey || !safeEqual(hold.keyHash, sha256(holdKey))) fail("NOT_FOUND", "This seat hold was not found.");
  return hold;
}

export function getHoldView(db: Database, now: Date, holdId: string, holdKey: string) {
  const hold = ownedHold(db, holdId, holdKey);
  const ctx = screeningContext(db, hold.screeningId);
  const quote = quoteSeats(hold.seatIds, ctx.auditorium, ctx.screening.prices);
  const snacks = quoteConcessions(hold.extras ?? [], db.concessions);
  const extras = snacks.ok ? { lines: snacks.lines, totalCents: snacks.totalCents } : { lines: [], totalCents: 0, error: snacks.error.message };
  const booking = hold.bookingId ? db.bookings.find((b) => b.id === hold.bookingId) : undefined;
  const lastAttempt = [...db.payments].reverse().find((p) => p.holdId === hold.id);
  return {
    hold: { id: hold.id, status: hold.status, seatIds: hold.seatIds, expiresAt: hold.expiresAt, screeningId: hold.screeningId, extras: hold.extras ?? [] },
    quote,
    extras,
    grandTotalCents: quote.totalCents + extras.totalCents,
    booking: booking ? { reference: booking.reference, accessKey: booking.accessKey, status: booking.status } : null,
    lastPayment: lastAttempt ? { outcome: lastAttempt.outcome, reference: lastAttempt.reference, at: lastAttempt.createdAt } : null,
    serverNow: now.toISOString(),
    ...ctx,
  };
}

export function releaseHold(db: Database, holdId: string, holdKey: string) {
  const hold = ownedHold(db, holdId, holdKey);
  if (hold.status === "active") hold.status = "released";
  return { status: hold.status };
}

export const setExtrasInput = z.object({
  holdKey: z.string().min(10).max(200),
  extras: z
    .array(z.object({ itemId: z.string().min(1).max(60), variantId: z.string().min(1).max(20), qty: z.number().int().min(0).max(10) }))
    .max(40),
});

/** Save the customer's snack choices on their hold (an empty list means "skip snacks"). */
export function setHoldExtras(db: Database, holdId: string, input: z.infer<typeof setExtrasInput>) {
  const hold = ownedHold(db, holdId, input.holdKey);
  if (hold.status !== "active") fail("HOLD_EXPIRED", "Your seat hold has expired and the seats were released. Please choose your seats again.");
  const q = quoteConcessions(input.extras, db.concessions);
  if (!q.ok) fail("BAD_REQUEST", q.error.message);
  hold.extras = q.lines.map(({ itemId, variantId, qty }) => ({ itemId, variantId, qty }));
  return { lines: q.lines, totalCents: q.totalCents };
}

// ── Checkout ─────────────────────────────────────────────────────────────

const phoneRe = /^\+?[0-9 ()-]{7,20}$/;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: z
    .string()
    .trim()
    .regex(phoneRe, "Enter a valid phone number, e.g. +231 77 123 4567.")
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a valid phone number."),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address."),
});

export const checkoutInput = z.object({
  holdId: z.string().min(1).max(100),
  holdKey: z.string().min(10).max(200),
  idempotencyKey: z.string().min(8).max(100),
  method: z.enum(["pay_at_cinema", "demo_online"]),
  demoOutcome: z.enum(["succeeded", "pending", "failed"]).optional(),
  customer: customerSchema,
});

export type CheckoutResult =
  | { kind: "booking"; reference: string; accessKey: string; status: Booking["status"]; duplicate: boolean }
  | { kind: "payment_failed"; paymentReference: string; message: string };

function resolveDemoOutcome(db: Database, requested?: "succeeded" | "pending" | "failed"): Exclude<PaymentOutcome, "cancelled"> {
  switch (db.settings.demoPaymentMode) {
    case "always_succeed":
      return "succeeded";
    case "always_pending":
      return "pending";
    case "always_fail":
      return "failed";
    case "random": {
      const r = Math.random();
      return r < 0.7 ? "succeeded" : r < 0.85 ? "pending" : "failed";
    }
    default:
      return requested ?? "succeeded";
  }
}

export function checkout(db: Database, now: Date, input: z.infer<typeof checkoutInput>): CheckoutResult {
  const hold = ownedHold(db, input.holdId, input.holdKey);

  // Idempotency 1: a hold converts into at most one booking. Re-submits return that booking.
  if (hold.status === "converted" && hold.bookingId) {
    const existing = db.bookings.find((b) => b.id === hold.bookingId)!;
    return { kind: "booking", reference: existing.reference, accessKey: existing.accessKey, status: existing.status, duplicate: true };
  }
  // Idempotency 2: the same submit (double click / network retry) replays its recorded outcome.
  const prior = db.payments.find((p) => p.idempotencyKey === input.idempotencyKey && p.holdId === hold.id);
  if (prior && prior.outcome === "failed") {
    return { kind: "payment_failed", paymentReference: prior.reference, message: "Payment was declined (demo)." };
  }

  if (hold.status !== "active") fail("HOLD_EXPIRED", "Your seat hold has expired and the seats were released. Please choose your seats again.");

  const { screening, auditorium } = screeningContext(db, hold.screeningId);
  if (!isOnSale(db, screening.id, now)) fail("SCREENING_CLOSED", "Online booking for this screening has closed.");
  const startMs = Date.parse(screening.startsAt);
  if (input.method === "pay_at_cinema" && startMs <= now.getTime()) {
    // Unpaid reservations are released at the start time, so one made now would lapse instantly.
    fail("SCREENING_CLOSED", "This film has already started, so Pay at Cinema is no longer available. Please pay online.");
  }

  // Defensive re-check: nobody else may hold or own these seats (excluding this hold itself).
  const states = seatStates(db, screening.id, now, hold.id);
  const clash = hold.seatIds.filter((id) => states.has(id));
  if (clash.length) fail("SEAT_UNAVAILABLE", `Seat(s) ${clash.join(", ")} are no longer available.`);

  const quote = quoteSeats(hold.seatIds, auditorium, screening.prices);
  const snacks = quoteConcessions(hold.extras ?? [], db.concessions);
  if (!snacks.ok) fail("CONFLICT", snacks.error.message);
  const grandTotal = quote.totalCents + snacks.totalCents;
  const customer = input.customer;
  const outcome = input.method === "pay_at_cinema" ? null : resolveDemoOutcome(db, input.demoOutcome);

  const attempt: PaymentAttempt = {
    id: newId("pay"),
    reference: newPaymentReference(),
    holdId: hold.id,
    method: input.method,
    outcome: outcome ?? "pending",
    amountCents: grandTotal,
    idempotencyKey: input.idempotencyKey,
    createdAt: now.toISOString(),
    note: input.method === "pay_at_cinema" ? "Pay at cinema — collect at box office" : "Simulated online payment (DEMO)",
  };
  db.payments.push(attempt);

  if (outcome === "failed") {
    return { kind: "payment_failed", paymentReference: attempt.reference, message: "Payment was declined (demo)." };
  }

  const iso = now.toISOString();
  const used = new Set(db.bookings.map((b) => b.reference));
  let reference = newBookingReference();
  while (used.has(reference)) reference = newBookingReference();

  const status: Booking["status"] =
    input.method === "pay_at_cinema" ? "reserved" : outcome === "succeeded" ? "confirmed" : "pending_payment";

  const booking: Booking = {
    id: newId("bkg"),
    reference,
    screeningId: screening.id,
    holdId: hold.id,
    items: quote.items,
    concessions: snacks.lines.length ? snacks.lines : undefined,
    subtotalCents: quote.subtotalCents + snacks.totalCents,
    feesCents: quote.feesCents,
    totalCents: grandTotal,
    currency: "USD",
    customer: { name: customer.name, phone: customer.phone, email: customer.email },
    status,
    paymentStatus: status === "confirmed" ? "paid" : status === "reserved" ? "unpaid" : "pending",
    paymentMethod: input.method,
    accessKey: newSecret(),
    ticketToken: newSecret(),
    idempotencyKey: input.idempotencyKey,
    createdAt: iso,
    updatedAt: iso,
    confirmedAt: status === "confirmed" ? iso : undefined,
    expiresAt:
      status === "pending_payment"
        ? new Date(
            Math.min(now.getTime() + db.settings.pendingPaymentMinutes * 60_000, startMs + SALES_CLOSE_AFTER_START_MIN * 60_000),
          ).toISOString()
        : undefined,
  };
  db.bookings.push(booking);
  attempt.bookingId = booking.id;
  hold.status = "converted";
  hold.bookingId = booking.id;

  return { kind: "booking", reference: booking.reference, accessKey: booking.accessKey, status: booking.status, duplicate: false };
}

// ── Customer booking access ─────────────────────────────────────────────

export function ownedBooking(db: Database, reference: string, accessKey: string) {
  const booking = db.bookings.find((b) => b.reference === reference.toUpperCase());
  if (!booking || !accessKey || !safeEqual(booking.accessKey, accessKey)) fail("NOT_FOUND", "Booking not found.");
  return booking;
}

/** Simulated gateway callback for a pending demo payment. */
export function resolvePendingPayment(db: Database, now: Date, reference: string, accessKey: string, action: "confirm" | "fail") {
  const booking = ownedBooking(db, reference, accessKey);
  if (booking.status !== "pending_payment") {
    if (booking.status === "expired") fail("HOLD_EXPIRED", "The payment window expired and the seats were released.");
    return booking; // already resolved — idempotent
  }
  const iso = now.toISOString();
  if (action === "confirm" && !isOnSale(db, booking.screeningId, now)) {
    // Refuse (the transaction rolls back); the capped expiresAt lets reconcile release the seats.
    fail("HOLD_EXPIRED", "Ticket sales for this screening have closed, so the payment can no longer be accepted. No charge was made.");
  }
  if (action === "confirm") {
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.confirmedAt = iso;
    booking.expiresAt = undefined;
  } else {
    booking.status = "cancelled";
    booking.paymentStatus = "failed";
    booking.cancelledAt = iso;
    booking.cancelReason = "Online payment failed (demo).";
  }
  booking.updatedAt = iso;
  db.payments.push({
    id: newId("pay"),
    reference: newPaymentReference(),
    holdId: booking.holdId ?? "",
    bookingId: booking.id,
    method: booking.paymentMethod,
    outcome: action === "confirm" ? "succeeded" : "failed",
    amountCents: booking.totalCents,
    idempotencyKey: `resolve-${booking.id}`,
    createdAt: iso,
    note: "Simulated gateway callback (DEMO)",
  });
  return booking;
}

/** Customers may cancel bookings that have not been paid. Paid bookings go through the box office. */
export function cancelByCustomer(db: Database, now: Date, reference: string, accessKey: string) {
  const booking = ownedBooking(db, reference, accessKey);
  if (booking.status === "cancelled" || booking.status === "expired") return booking; // nothing left to cancel
  if (booking.status !== "pending_payment" && booking.status !== "reserved") {
    fail("CONFLICT", "Paid bookings can only be cancelled by the box office.");
  }
  booking.status = "cancelled";
  booking.paymentStatus = "void";
  booking.cancelledAt = now.toISOString();
  booking.updatedAt = booking.cancelledAt;
  booking.cancelReason = "Cancelled by customer.";
  return booking;
}

export function cancelByAdmin(db: Database, now: Date, bookingId: string, reason: string) {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) fail("NOT_FOUND", "Booking not found.");
  if (booking.status === "cancelled") fail("CONFLICT", "This booking is already cancelled.");
  if (booking.status === "expired") fail("CONFLICT", "This booking has already expired; its seats are free.");
  if (booking.redeemedAt) fail("CONFLICT", "This ticket has already been admitted and cannot be cancelled.");
  const { screening } = screeningContext(db, booking.screeningId);
  if (Date.parse(screening.startsAt) < now.getTime()) fail("CONFLICT", "Bookings for screenings that have started cannot be cancelled.");
  booking.status = "cancelled";
  booking.paymentStatus = booking.paymentStatus === "paid" ? "refunded" : "void";
  booking.cancelledAt = now.toISOString();
  booking.updatedAt = booking.cancelledAt;
  booking.cancelReason = reason || "Cancelled by cinema management.";
  return booking;
}

// ── Lookup ───────────────────────────────────────────────────────────────

export const lookupInput = z.object({
  reference: z.string().trim().min(6).max(20),
  contact: z.string().trim().min(5).max(120),
});

/** National significant number: drops the +231 country code / 00231 prefix and the trunk 0. */
function digits(v: string) {
  return v
    .replace(/\D/g, "")
    .replace(/^(00)?231/, "")
    .replace(/^0+/, "");
}

/**
 * Returns the booking only if the contact detail matches the phone (last 7+ digits) or email
 * on record. Mismatches and unknown references produce the same response.
 */
export function lookupBooking(db: Database, input: z.infer<typeof lookupInput>) {
  const ref = input.reference.toUpperCase().replace(/\s+/g, "");
  const normalized = ref.startsWith("MCP-") ? ref : `MCP-${ref.replace(/^MCP/, "").replace(/^-/, "")}`;
  const booking = db.bookings.find((b) => b.reference === normalized);
  const contact = input.contact.trim().toLowerCase();
  if (!booking) return null;
  const emailMatch = !!booking.customer.email && contact.includes("@") && booking.customer.email.toLowerCase() === contact;
  const cd = digits(contact);
  const bd = digits(booking.customer.phone);
  const phoneMatch = !contact.includes("@") && cd.length >= 7 && cd === bd;
  if (!emailMatch && !phoneMatch) return null;
  return { reference: booking.reference, accessKey: booking.accessKey };
}

// ── Public view of a booking (owner only) ────────────────────────────────

export function bookingView(db: Database, booking: Booking) {
  const { screening, movie, auditorium } = screeningContext(db, booking.screeningId);
  return {
    reference: booking.reference,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    items: booking.items,
    concessions: booking.concessions ?? [],
    subtotalCents: booking.subtotalCents,
    feesCents: booking.feesCents,
    totalCents: booking.totalCents,
    customer: booking.customer,
    createdAt: booking.createdAt,
    expiresAt: booking.expiresAt,
    redeemedAt: booking.redeemedAt,
    cancelReason: booking.cancelReason,
    ticketToken: booking.ticketToken,
    screening: { id: screening.id, startsAt: screening.startsAt, format: screening.format },
    movie: { id: movie.id, slug: movie.slug, title: movie.title, rating: movie.rating, runtimeMin: movie.runtimeMin, art: movie.art, posterUrl: movie.posterUrl, genres: movie.genres },
    auditorium: { id: auditorium.id, name: auditorium.name, shortName: auditorium.shortName },
  };
}
export type BookingView = ReturnType<typeof bookingView>;
