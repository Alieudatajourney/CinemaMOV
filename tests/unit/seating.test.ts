import { describe, expect, it } from "vitest";
import { bestAvailableSeats, parseLayout, quoteSeats, toggleSeat, validateLayout, textToRows, rowsToText } from "@/lib/seating";
import { SEED_AUDITORIUMS } from "@/server/seed";

const grand = SEED_AUDITORIUMS[0];
const lounge = SEED_AUDITORIUMS[1];
const prices = { standard: 700, vip: 1200, accessible: 700 };

describe("layout parsing", () => {
  it("numbers seats left to right per row, skipping aisles and gaps", () => {
    const seats = parseLayout(grand.rows);
    const rowA = seats.filter((s) => s.row === "A").map((s) => s.id);
    expect(rowA[0]).toBe("A1");
    expect(rowA).toHaveLength(14);
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
  });
  it("assigns VIP and accessible categories from the pattern", () => {
    const seats = parseLayout(grand.rows);
    expect(seats.find((s) => s.id === "K1")?.category).toBe("vip");
    expect(seats.find((s) => s.id === "E1")?.category).toBe("accessible");
    expect(parseLayout(lounge.rows).filter((s) => s.category === "vip")).toHaveLength(20);
  });
  it("validates layouts and round-trips text", () => {
    expect(validateLayout(grand.rows).ok).toBe(true);
    expect(validateLayout([{ label: "A", pattern: "SSX" }]).ok).toBe(false);
    expect(validateLayout([{ label: "A", pattern: "SS" }, { label: "A", pattern: "SS" }]).ok).toBe(false);
    expect(textToRows(rowsToText(lounge.rows))).toEqual(lounge.rows);
  });
});

describe("seat toggling", () => {
  const avail = { exists: true, state: "available" as const, limit: 3 };
  it("selects then deselects a seat", () => {
    const a = toggleSeat([], "F7", avail);
    expect(a).toMatchObject({ ok: true, action: "added", selection: ["F7"] });
    const b = toggleSeat(a.selection, "F7", avail);
    expect(b).toMatchObject({ ok: true, action: "removed", selection: [] });
  });
  it("rejects occupied and held seats without changing the selection", () => {
    expect(toggleSeat(["A1"], "B2", { ...avail, state: "occupied" })).toMatchObject({ ok: false, reason: "occupied", selection: ["A1"] });
    expect(toggleSeat(["A1"], "B2", { ...avail, state: "held" })).toMatchObject({ ok: false, reason: "held" });
  });
  it("enforces the ticket limit and never duplicates", () => {
    let sel: string[] = [];
    for (const id of ["A1", "A2", "A3", "A4"]) sel = toggleSeat(sel, id, avail).selection;
    expect(sel).toEqual(["A1", "A2", "A3"]);
    expect(toggleSeat(sel, "A4", avail)).toMatchObject({ ok: false, reason: "limit" });
  });
});

describe("pricing", () => {
  it("computes itemised totals from the price table", () => {
    const q = quoteSeats(["K1", "B3", "B4", "E1"], grand, prices);
    expect(q.items.map((i) => i.seatId)).toEqual(["B3", "B4", "E1", "K1"]);
    expect(q.subtotalCents).toBe(700 * 3 + 1200);
    expect(q.totalCents).toBe(q.subtotalCents);
    expect(q.byCategory.find((c) => c.category === "vip")).toMatchObject({ count: 1, lineCents: 1200 });
  });
  it("de-duplicates seat ids and rejects unknown seats", () => {
    expect(quoteSeats(["B3", "B3"], grand, prices).items).toHaveLength(1);
    expect(() => quoteSeats(["Z99"], grand, prices)).toThrow();
  });
});

describe("best available seats", () => {
  const none = () => false;
  it("picks a contiguous, central block about two-thirds back", () => {
    const ids = bestAvailableSeats(grand, none, 2);
    expect(ids).toHaveLength(2);
    const seats = parseLayout(grand.rows).filter((s) => ids.includes(s.id));
    expect(seats[0].row).toBe(seats[1].row);
    expect(Math.abs(seats[0].col - seats[1].col)).toBe(1);
    expect(["F", "G"]).toContain(seats[0].row);
  });
  it("never spans an aisle and skips blocked or accessible seats", () => {
    const blocked = new Set(parseLayout(grand.rows).filter((s) => s.row === "F" || s.row === "G").map((s) => s.id));
    const ids = bestAvailableSeats(grand, (id) => blocked.has(id), 5);
    expect(ids.some((id) => blocked.has(id))).toBe(false);
    const seats = parseLayout(grand.rows).filter((s) => ids.includes(s.id));
    expect(new Set(seats.map((s) => s.row)).size).toBe(1);
    expect(seats.every((s, i) => i === 0 || s.col === seats[i - 1].col + 1)).toBe(true);
    expect(bestAvailableSeats(grand, none, 8).every((id) => parseLayout(grand.rows).find((s) => s.id === id)!.category !== "accessible")).toBe(true);
  });
  it("falls back to the best individual seats when no block fits", () => {
    const free = new Set(["A1", "C5", "H16"]);
    const ids = bestAvailableSeats(grand, (id) => !free.has(id), 2);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => free.has(id))).toBe(true);
  });
  it("returns nothing when the house is full", () => {
    expect(bestAvailableSeats(lounge, () => true, 2)).toEqual([]);
  });
});
