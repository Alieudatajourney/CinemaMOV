import { body, handle, rateLimit } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { validateInput, validateTicket } from "@/server/core/tickets";

export const POST = handle(async (req) => {
  const user = await requireRole(["staff", "admin"]);
  rateLimit(req, "validate", 120, 60_000);
  const input = await body(req, validateInput);
  return transact((db, now) => validateTicket(db, now, input, user.email));
});
