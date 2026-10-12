import { body, handle, rateLimit } from "@/server/http";
import { fail } from "@/server/errors";
import { readDb } from "@/server/store";
import { lookupBooking, lookupInput } from "@/server/core/booking";

export const POST = handle(async (req) => {
  rateLimit(req, "lookup", 12, 60_000);
  const input = await body(req, lookupInput);
  const found = await readDb((db) => lookupBooking(db, input));
  // Identical response for unknown references and mismatched contact details.
  if (!found) fail("NOT_FOUND", "We couldn't find a booking matching those details. Check the reference and the phone number or email used when booking.");
  return found;
});
