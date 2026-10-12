import { handle } from "@/server/http";
import { readDb } from "@/server/store";
import { bookingView, ownedBooking } from "@/server/core/booking";

export const GET = handle<{ params: Promise<{ reference: string }> }>(async (req, { params }) => {
  const { reference } = await params;
  const key = req.headers.get("x-access-key") ?? "";
  return readDb((db) => bookingView(db, ownedBooking(db, reference, key)));
});
