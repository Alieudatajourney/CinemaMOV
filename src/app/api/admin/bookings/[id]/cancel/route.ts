import { z } from "zod";
import { body, handle } from "@/server/http";
import { requireRole } from "@/server/auth";
import { transact } from "@/server/store";
import { adminBookingRow } from "@/server/core/admin";
import { cancelByAdmin } from "@/server/core/booking";

const input = z.object({ reason: z.string().trim().max(200).default(""), confirm: z.literal(true) });

export const POST = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireRole(["admin"]);
  const { id } = await params;
  const { reason } = await body(req, input);
  return transact((db, now) => {
    cancelByAdmin(db, now, id, reason ? `${reason} (by ${user.email})` : `Cancelled by ${user.email}`);
    return adminBookingRow(db, id);
  });
});
