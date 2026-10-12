import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { screeningInput, updateScreening } from "@/server/core/admin";

export const PATCH = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireRole(["admin"]);
  const { id } = await params;
  const input = await body(req, screeningInput);
  const screening = await transact((db, now) => updateScreening(db, now, id, input));
  return { screening };
});
