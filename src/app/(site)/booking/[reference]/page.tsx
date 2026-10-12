import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, Clock3, XCircle } from "lucide-react";
import { readDb } from "@/server/store";
import { bookingView, ownedBooking } from "@/server/core/booking";
import { ServiceError } from "@/server/errors";
import { ticketQrSvg } from "@/server/qr";
import { formatUSD } from "@/lib/format";
import { TicketCard } from "@/components/ticket/TicketCard";
import { PendingControls, PendingCountdown, TicketActions } from "@/components/ticket/TicketActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ k?: string; new?: string }>;
}) {
  const { reference } = await params;
  const { k = "", new: isNew } = await searchParams;

  const result = await readDb((db) => {
    try {
      return { view: bookingView(db, ownedBooking(db, reference, k)), venue: db.settings.addressLine };
    } catch (e) {
      if (e instanceof ServiceError) return null;
      throw e;
    }
  });

  if (!result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning-400" aria-hidden />
        <h1 className="font-display mt-4 text-4xl">Booking not found</h1>
        <p className="mt-3 text-fg-muted">This link is incomplete or has expired. You can find your booking with its reference and your phone number or email.</p>
        <Link href="/my-tickets" className="btn btn-primary mt-8">
          Find my booking
        </Link>
      </div>
    );
  }

  const { view, venue } = result;
  const qr = view.status === "confirmed" || view.status === "reserved" ? await ticketQrSvg(view.ticketToken) : null;
  const firstName = view.customer.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <header className="no-print mb-8 text-center">
        {view.status === "confirmed" && (
          <>
            {isNew && <SuccessMark />}
            <p className="eyebrow mt-5">{view.redeemedAt ? "Ticket used" : "Booking confirmed"}</p>
            <h1 className="font-display mt-2 text-4xl sm:text-5xl">{view.redeemedAt ? "Enjoy the film" : `You're all set, ${firstName}`}</h1>
            <p className="mt-3 text-fg-muted">
              {view.redeemedAt ? "This ticket has been admitted." : "Show the QR code below at the entrance. A copy is saved in My Tickets on this device."}
            </p>
          </>
        )}
        {view.status === "reserved" && (
          <>
            <Building2 className="mx-auto h-12 w-12 text-gold-300" aria-hidden />
            <p className="eyebrow mt-4">Seats reserved · Pay at cinema</p>
            <h1 className="font-display mt-2 text-4xl sm:text-5xl">Pay {formatUSD(view.totalCents)} at the box office</h1>
            <p className="mx-auto mt-3 max-w-xl text-fg-muted">
              Your seats are reserved but not yet paid. Show this ticket at the box office before the film — unpaid reservations are released when the
              screening starts.
            </p>
            <PendingControls reference={view.reference} accessKey={k} kind="reserved" />
          </>
        )}
        {view.status === "pending_payment" && (
          <>
            <Clock3 className="mx-auto h-12 w-12 text-warning-400" aria-hidden />
            <p className="eyebrow mt-4 !text-warning-400">Payment pending</p>
            <h1 className="font-display mt-2 text-4xl sm:text-5xl">Waiting for payment confirmation</h1>
            <p className="mx-auto mt-3 max-w-xl text-fg-muted">
              Your seats are held while the (simulated) payment provider confirms. This booking is <strong className="text-fg">not yet valid for entry</strong>.
              {view.expiresAt && (
                <>
                  {" "}
                  Seats are released in <PendingCountdown expiresAt={view.expiresAt} /> if payment isn&apos;t confirmed.
                </>
              )}
            </p>
            <PendingControls reference={view.reference} accessKey={k} kind="pending" />
          </>
        )}
        {(view.status === "cancelled" || view.status === "expired") && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-danger-400" aria-hidden />
            <p className="eyebrow mt-4 !text-danger-400">{view.status === "cancelled" ? "Cancelled" : "Expired"}</p>
            <h1 className="font-display mt-2 text-4xl sm:text-5xl">This booking is no longer active</h1>
            <p className="mt-3 text-fg-muted">{view.cancelReason ?? "The seats have been released."}</p>
            <Link href={`/book/${view.screening.id}`} className="btn btn-primary mt-6">
              Book again
            </Link>
          </>
        )}
      </header>

      <TicketCard view={view} qrSvg={qr} venue={venue} />

      <div className="mt-6">
        <TicketActions
          reference={view.reference}
          accessKey={k}
          title={view.movie.title}
          startsAt={view.screening.startsAt}
          seats={view.items.map((i) => i.seatId)}
          printable={view.status === "confirmed" || view.status === "reserved"}
        />
      </div>

      <section className="no-print mt-10 grid gap-4 text-sm text-fg-muted sm:grid-cols-3" aria-label="Good to know">
        <Tip title="Arrive early">Doors open 20 minutes before the film. Trailers run for about 10 minutes.</Tip>
        <Tip title="One scan per ticket">Your QR code admits your whole party once. Screenshots work too.</Tip>
        <Tip title="Need help?">Visit the box office at Monrovia Super Mall with your booking reference.</Tip>
      </section>
    </div>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] p-4">
      <p className="font-semibold text-fg">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function SuccessMark() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="mx-auto" aria-hidden="true">
      <circle className="success-ring" style={{ transformOrigin: "38px 38px" }} cx="38" cy="38" r="34" fill="rgba(226,189,103,0.12)" stroke="#e2bd67" strokeWidth="2" />
      <path className="success-check" d="M24 39 l9 9 l19 -20" fill="none" stroke="#efd595" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
