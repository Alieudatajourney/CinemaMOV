import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { concessionInput, deleteConcession, updateConcession } from "@/server/core/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  await requireRole(["admin"]);
  const { id } = await params;
  const input = await body(req, concessionInput);
  return { item: await transact((db) => updateConcession(db, id, input)) };
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  await requireRole(["admin"]);
  const { id } = await params;
  await transact((db) => deleteConcession(db, id));
  return { ok: true };
});
