import { handle } from "@/server/http";
import { fail } from "@/server/errors";
import { readDb } from "@/server/store";
import { seatMapView } from "@/server/core/catalog";

export const GET = handle<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const view = await readDb((db, now) => seatMapView(db, now, id));
  if (!view) fail("NOT_FOUND", "Screening not found.");
  return { states: view.states, onSale: view.onSale, serverNow: view.serverNow };
});
