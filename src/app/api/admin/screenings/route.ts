import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { createScreening, screeningInput } from "@/server/core/admin";

export const POST = handle(async (req) => {
  await requireRole(["admin"]);
  const input = await body(req, screeningInput);
  const screening = await transact((db, now) => createScreening(db, now, input));
  return { screening };
});
