import { handle } from "@/server/http";
import { readDb } from "@/server/store";
import { bookingView, ownedBooking } from "@/server/core/booking";
import { renderTicketSvg } from "@/server/ticket-svg";

/** Downloadable ticket (SVG). Requires the booking's access key. */
export const GET = handle<{ params: Promise<{ reference: string }> }>(async (req, { params }) => {
  const { reference } = await params;
  const key = req.nextUrl.searchParams.get("k") ?? req.headers.get("x-access-key") ?? "";
  const { view, settings } = await readDb((db) => ({ view: bookingView(db, ownedBooking(db, reference, key)), settings: db.settings }));
  const svg = await renderTicketSvg(view, settings, req.nextUrl.origin);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="MonroviaCinemaPlus-${view.reference}.svg"`,
      "Cache-Control": "no-store",
    },
  });
});
