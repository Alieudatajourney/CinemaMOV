import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { createMovie, movieInput } from "@/server/core/admin";

export const POST = handle(async (req) => {
  await requireRole(["admin"]);
  const input = await body(req, movieInput);
  const movie = await transact((db, now) => createMovie(db, now, input));
  return { movie };
});
