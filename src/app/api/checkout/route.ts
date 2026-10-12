import { body, handle, rateLimit } from "@/server/http";
import { transact } from "@/server/store";
import { checkout, checkoutInput } from "@/server/core/booking";

export const POST = handle(async (req) => {
  rateLimit(req, "checkout", 30, 60_000);
  const input = await body(req, checkoutInput);
  return transact((db, now) => checkout(db, now, input));
});
