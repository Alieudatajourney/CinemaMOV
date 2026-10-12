import { z } from "zod";
import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { resetDatabase } from "@/server/store";

const input = z.object({ confirm: z.literal("RESET") });

/** Replaces ALL data with fresh demo data. Requires admin and an explicit confirmation phrase. */
export const POST = handle(async (req) => {
  await requireRole(["admin"]);
  await body(req, input);
  await resetDatabase();
  return { ok: true };
});
