import { body, handle, rateLimit } from "@/server/http";
import { transact } from "@/server/store";
import { createHold, createHoldInput } from "@/server/core/booking";

export const POST = handle(async (req) => {
  rateLimit(req, "hold", 30, 60_000);
  const input = await body(req, createHoldInput);
  const { hold, holdKey } = await transact((db, now) => createHold(db, now, input));
  return { holdId: hold.id, holdKey, expiresAt: hold.expiresAt, seatIds: hold.seatIds };
});
