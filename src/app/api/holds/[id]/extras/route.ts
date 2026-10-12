import { body, handle } from "@/server/http";
import { transact } from "@/server/store";
import { setExtrasInput, setHoldExtras } from "@/server/core/booking";

/** Save snack choices on a hold. Prices are computed by the server from the menu. */
export const PUT = handle<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const input = await body(req, setExtrasInput);
  return transact((db) => setHoldExtras(db, id, input));
});
