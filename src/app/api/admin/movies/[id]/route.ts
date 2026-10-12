import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { deleteMovie, movieInput, updateMovie } from "@/server/core/admin";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  await requireRole(["admin"]);
  const { id } = await params;
  const input = await body(req, movieInput);
  const movie = await transact((db, now) => updateMovie(db, now, id, input));
  return { movie };
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  await requireRole(["admin"]);
  const { id } = await params;
  await transact((db, now) => deleteMovie(db, now, id));
  return { ok: true };
});
