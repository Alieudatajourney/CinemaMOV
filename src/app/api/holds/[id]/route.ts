import { handle } from "@/server/http";
import { readDb, transact } from "@/server/store";
import { getHoldView, releaseHold } from "@/server/core/booking";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const key = req.headers.get("x-hold-key") ?? "";
  const v = await readDb((db, now) => getHoldView(db, now, id, key));
  return { hold: v.hold, quote: v.quote, extras: v.extras, grandTotalCents: v.grandTotalCents, booking: v.booking, lastPayment: v.lastPayment, serverNow: v.serverNow };
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const key = req.headers.get("x-hold-key") ?? "";
  return transact((db) => releaseHold(db, id, key));
});
