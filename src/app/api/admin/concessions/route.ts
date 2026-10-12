import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { concessionInput, createConcession } from "@/server/core/admin";

export const POST = handle(async (req) => {
  await requireRole(["admin"]);
  const input = await body(req, concessionInput);
  return { item: await transact((db) => createConcession(db, input)) };
});
