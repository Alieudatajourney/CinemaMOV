import type { Database, SeatState } from "@/lib/types";

/**
 * Apply time-based state transitions. Runs at the start of every transaction so expired
 * holds and lapsed payments can never keep seats blocked. Returns true if anything changed.
 */
export function reconcile(db: Database, now: Date): boolean {
  const t = now.getTime();
  const iso = now.toISOString();
  let changed = false;

  for (const hold of db.holds) {
    if (hold.status === "active" && Date.parse(hold.expiresAt) <= t) {
      hold.status = "expired";
      changed = true;
    }
  }

  const screeningStart = new Map(db.screenings.map((s) => [s.id, Date.parse(s.startsAt)]));
  for (const b of db.bookings) {
    if (b.status === "pending_payment" && b.expiresAt && Date.parse(b.expiresAt) <= t) {
      b.status = "expired";
      b.paymentStatus = "void";
      b.cancelReason = "Payment was not confirmed before the hold expired.";
      b.updatedAt = iso;
      changed = true;
    }
    // Unpaid Pay-at-Cinema reservations are released once the screening starts.
    if (b.status === "reserved" && (screeningStart.get(b.screeningId) ?? Infinity) <= t) {
      b.status = "expired";
      b.paymentStatus = "void";
      b.cancelReason = "Reservation was not paid before the screening started.";
      b.updatedAt = iso;
      changed = true;
    }
  }
  return changed;
}

/** Bookings in these states occupy their seats. */
export const SEAT_BLOCKING_STATUSES = new Set(["pending_payment", "reserved", "confirmed"]);

/**
 * Seat availability for one screening. Availability is per screening, never per seat globally.
 * Seats in pending-payment bookings and active holds show as "held"; reserved and confirmed seats
 * show as "occupied".
 */
export function seatStates(db: Database, screeningId: string, now: Date, ignoreHoldId?: string) {
  const states = new Map<string, Exclude<SeatState, "available">>();
  for (const b of db.bookings) {
    if (b.screeningId !== screeningId || !SEAT_BLOCKING_STATUSES.has(b.status)) continue;
    const s = b.status === "pending_payment" ? "held" : "occupied";
    for (const item of b.items) states.set(item.seatId, s);
  }
  const t = now.getTime();
  for (const h of db.holds) {
    if (h.screeningId !== screeningId || h.status !== "active" || h.id === ignoreHoldId) continue;
    if (Date.parse(h.expiresAt) <= t) continue;
    for (const id of h.seatIds) if (!states.has(id)) states.set(id, "held");
  }
  return states;
}
