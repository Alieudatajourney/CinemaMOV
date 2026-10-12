import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { settingsInput, updateSettings } from "@/server/core/admin";

export const PATCH = handle(async (req) => {
  await requireRole(["admin"]);
  const input = await body(req, settingsInput);
  const settings = await transact((db) => updateSettings(db, input));
  return { settings };
});
