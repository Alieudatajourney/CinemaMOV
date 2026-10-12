import { z } from "zod";
import type { Booking, Database, ValidationOutcome } from "@/lib/types";
import { dateKey } from "@/lib/format";
import { newId, safeEqual } from "../ids";
import { screeningContext } from "./booking";

/** The QR code carries only this opaque token — no names, contacts or payment data. */
export const QR_PREFIX = "MCP1:";
export function qrPayload(ticketToken: string) {
  return `${QR_PREFIX}${ticketToken}`;
}

export const validateInput = z.object({
  code: z.string().trim().min(4).max(300),
  admit: z.boolean().default(true),
  collectPayment: z.boolean().default(false),
  /** Staff override to admit a ticket for a different day (e.g. manager approval). */
  allowOtherDay: z.boolean().default(false),
});

export function parseCode(raw: string): { kind: "qr" | "token" | "reference" | "unknown"; value: string } {
  const v = raw.trim();
  if (v.startsWith(QR_PREFIX)) return { kind: "qr", value: v.slice(QR_PREFIX.length) };
  const ref = v.toUpperCase().replace(/\s+/g, "");
  if (/^MCP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(ref)) return { kind: "reference", value: ref };
  if (/^[A-Za-z0-9_-]{24,64}$/.test(v)) return { kind: "token", value: v };
  return { kind: "unknown", value: v };
}

function findBooking(db: Database, parsed: ReturnType<typeof parseCode>): Booking | undefined {
  if (parsed.kind === "reference") return db.bookings.find((b) => b.reference === parsed.value);
  if (parsed.kind === "qr" || parsed.kind === "token") {
    return db.bookings.find((b) => b.ticketToken.length === parsed.value.length && safeEqual(b.ticketToken, parsed.value));
  }
  return undefined;
}

const MESSAGES: Record<ValidationOutcome, string> = {
  admitted: "Valid ticket — admit guests.",
  already_redeemed: "Already redeemed. This ticket has been used.",
  cancelled: "Cancelled booking. Do not admit.",
  unpaid: "Unpaid reservation. Collect payment before admitting.",
  pending_payment: "Payment pending. Online payment has not been confirmed.",
  expired: "Expired booking. The reservation lapsed and seats were released.",
  screening_ended: "This screening has already ended.",
  not_today: "This ticket is for a screening on a different day. Do not admit without a manager's approval.",
  invalid: "Invalid ticket. No booking matches this code.",
};

/**
 * Validate a ticket against stored records and — if valid and `admit` is set — mark it redeemed.
 * Runs inside a store transaction, so two simultaneous scans cannot both admit the same ticket.
 */
export function validateTicket(db: Database, now: Date, input: z.infer<typeof validateInput>, staffEmail: string) {
  const parsed = parseCode(input.code);
  const booking = findBooking(db, parsed);
  let outcome: ValidationOutcome;

  if (!booking) {
    outcome = "invalid";
  } else {
    const { screening, movie } = screeningContext(db, booking.screeningId);
    const endsAt = Date.parse(screening.startsAt) + (movie.runtimeMin + 30) * 60_000;
    if (booking.redeemedAt) outcome = "already_redeemed";
    else if (booking.status === "cancelled") outcome = "cancelled";
    else if (booking.status === "expired") outcome = "expired";
    else if (booking.status === "pending_payment") outcome = "pending_payment";
    else if (now.getTime() > endsAt) outcome = "screening_ended";
    // Admitting early would mark the ticket used and lock the customer out of the real show.
    else if (dateKey(screening.startsAt) !== dateKey(now) && !input.allowOtherDay) outcome = "not_today";
    else if (booking.status === "reserved" && !input.collectPayment) outcome = "unpaid";
    else outcome = "admitted";

    if (outcome === "admitted" && input.admit) {
      const iso = now.toISOString();
      if (booking.status === "reserved") {
        booking.status = "confirmed";
        booking.paymentStatus = "paid";
        booking.confirmedAt = iso;
        db.payments.push({
          id: newId("pay"),
          reference: `BOX-${booking.reference.slice(4)}`,
          holdId: booking.holdId ?? "",
          bookingId: booking.id,
          method: "pay_at_cinema",
          outcome: "succeeded",
          amountCents: booking.totalCents,
          idempotencyKey: `box-${booking.id}`,
          createdAt: iso,
          note: `Collected at box office by ${staffEmail} (demo)`,
        });
      }
      booking.redeemedAt = iso;
      booking.redeemedBy = staffEmail;
      booking.updatedAt = iso;
    }
  }

  db.redemptions.push({
    id: newId("red"),
    at: now.toISOString(),
    by: staffEmail,
    outcome: outcome === "admitted" && !input.admit ? "checked" : outcome,
    bookingId: booking?.id,
    inputKind: parsed.kind,
  });

  const detail = booking
    ? (() => {
        const { screening, movie, auditorium } = screeningContext(db, booking.screeningId);
        return {
          reference: booking.reference,
          customerName: booking.customer.name,
          seats: booking.items.map((i) => ({ seatId: i.seatId, category: i.category })),
          concessions: (booking.concessions ?? []).map((c) => ({ name: c.name, variantLabel: c.variantLabel, qty: c.qty })),
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          totalCents: booking.totalCents,
          redeemedAt: booking.redeemedAt,
          redeemedBy: booking.redeemedBy,
          movieTitle: movie.title,
          rating: movie.rating,
          startsAt: screening.startsAt,
          auditorium: auditorium.name,
          format: screening.format,
        };
      })()
    : null;

  return {
    outcome,
    admitted: outcome === "admitted" && input.admit,
    message: outcome === "admitted" && !input.admit ? "Valid ticket (checked only — not yet admitted)." : MESSAGES[outcome],
    booking: detail,
  };
}
export type ValidationResult = ReturnType<typeof validateTicket>;
