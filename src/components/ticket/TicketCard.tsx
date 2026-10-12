import { clsx } from "clsx";
import { CalendarDays, Clock3, MapPin, Popcorn } from "lucide-react";
import { describeLine } from "@/lib/concessions";
import type { BookingView } from "@/server/core/booking";
import { CATEGORY_LABEL, formatDateLong, formatTime, formatUSD } from "@/lib/format";
import { MoviePoster } from "../MoviePoster";
import { Wordmark } from "../brand/Wordmark";
import { BookingStatusBadge, DemoBadge, PaymentStatusBadge, RatingBadge } from "../ui/badges";

/** The digital ticket. Also the printable layout (see `.print-ticket` in globals.css). */
export function TicketCard({ view, qrSvg, venue }: { view: BookingView; qrSvg: string | null; venue: string }) {
  const valid = view.status === "confirmed" || view.status === "reserved";
  const cats = Object.entries(view.items.reduce<Record<string, number>>((a, i) => ((a[i.category] = (a[i.category] ?? 0) + 1), a), {}));
  return (
    <article className="print-ticket surface relative overflow-hidden" aria-label={`Ticket ${view.reference}`}>
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-gold-500/30 px-5 py-4 sm:px-7">
        <Wordmark compact />
        <DemoBadge>DEMO TICKET</DemoBadge>
      </div>
      <div className="grid md:grid-cols-[1fr_280px]">
        <div className="flex gap-5 p-5 sm:p-7">
          <MoviePoster movie={view.movie} className="hidden aspect-[2/3] w-28 shrink-0 rounded-xl sm:block print-keep-dark" showTitle={false} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">{view.movie.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <RatingBadge rating={view.movie.rating} /> {view.screening.format} · {view.movie.runtimeMin} min
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <TF icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatDateLong(view.screening.startsAt)} wide />
              <TF icon={<Clock3 className="h-4 w-4" />} label="Time (Monrovia)" value={formatTime(view.screening.startsAt)} />
              <TF icon={<MapPin className="h-4 w-4" />} label="Auditorium" value={view.auditorium.name} />
            </dl>
            <div className="mt-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Seats</p>
              <p className="font-display mt-1 text-3xl text-gold-200">{view.items.map((i) => i.seatId).join(", ")}</p>
              <p className="mt-1 text-sm text-fg-muted">
                {cats.map(([c, n]) => `${n} × ${CATEGORY_LABEL[c]}`).join(" · ")}
                {view.concessions.length > 0 && " + snacks"} · Total {formatUSD(view.totalCents)}
              </p>
            </div>
            {view.concessions.length > 0 && (
              <div className="mt-5 rounded-xl border border-gold-400/25 bg-gold-400/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-300">
                  <Popcorn className="h-3.5 w-3.5" aria-hidden /> Snacks — collect at the concession counter
                </p>
                <ul className="mt-1.5 text-sm text-fg">
                  {view.concessions.map((c) => (
                    <li key={`${c.itemId}:${c.variantId}`}>{describeLine(c)}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-5 text-sm text-fg-muted">{venue}</p>
          </div>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-3 border-t border-dashed border-gold-500/30 p-6 md:border-l md:border-t-0">
          {valid && qrSvg ? (
            <div
              className="print-keep-dark w-[200px] rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
              role="img"
              aria-label={`Ticket QR code for booking ${view.reference}`}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className={clsx("flex h-[200px] w-[200px] items-center justify-center rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-fg-subtle")}>
              {view.status === "pending_payment" ? "QR code appears once payment is confirmed" : "This ticket is no longer valid"}
            </div>
          )}
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Booking reference</p>
          <p className="-mt-2 font-mono text-xl font-bold tracking-wider">{view.reference}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <BookingStatusBadge status={view.status} redeemed={!!view.redeemedAt} />
            <PaymentStatusBadge status={view.paymentStatus} />
          </div>
        </div>
      </div>
      <p className="border-t border-white/[0.06] px-5 py-3 text-center text-xs text-fg-subtle sm:px-7">
        Demonstration ticket for a fictional booking. Show the QR code at the entrance — each ticket can be admitted once.
      </p>
    </article>
  );
}

function TF({ icon, label, value, wide }: { icon: React.ReactNode; label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
        <span className="text-gold-400" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-base text-fg">{value}</dd>
    </div>
  );
}
