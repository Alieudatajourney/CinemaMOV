import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CircleDollarSign, ReceiptText, Ticket, Users } from "lucide-react";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { dashboardMetrics } from "@/server/core/admin";
import { formatDateTime, formatTime, formatUSD, formatDateShort } from "@/lib/format";
import { AdminHeader, Meter, Panel, StatTile } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { BookingStatusBadge } from "@/components/ui/badges";

export default async function AdminOverview() {
  await requirePageRole(["admin"], "/admin");
  const m = await readDb((db, now) => ({ ...dashboardMetrics(db, now), now: now.toISOString() }));

  return (
    <>
      <AdminHeader
        eyebrow={formatDateShort(m.now)}
        title="Overview"
        description="Live figures computed from the stored demo bookings. Revenue is simulated — no real payments are processed."
        actions={
          <Link href="/admin/bookings" className="btn btn-secondary btn-sm">
            All bookings <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {m.futureScheduleDays < 3 && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-xl border border-warning-400/30 bg-warning-700/25 px-4 py-3 text-sm text-warning-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          The demo schedule only covers {m.futureScheduleDays} more day(s). Reset the demo data in Settings to generate fresh screenings before a presentation.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile icon={<ReceiptText className="h-4 w-4" />} label="Today's bookings" value={String(m.todayBookings)} sub={`${m.todayTickets} tickets booked today`} />
        <StatTile icon={<Ticket className="h-4 w-4" />} label="Tickets sold" value={m.ticketsSold.toLocaleString("en-US")} sub={`${m.redeemedCount} bookings admitted`} />
        <StatTile icon={<CircleDollarSign className="h-4 w-4" />} label="Demo revenue" value={formatUSD(m.revenueCents)} sub={`${formatUSD(m.todayRevenueCents)} today · ${formatUSD(m.snackRevenueCents)} from snacks (${Math.round(m.snackAttachRate * 100)}% of orders)`} />
        <StatTile icon={<Users className="h-4 w-4" />} label="Occupancy today" value={`${Math.round(m.todayOccupancyPct * 100)}%`} sub={`Across ${m.todayScreenings} screenings`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Revenue · last 7 days">
          <RevenueChart data={m.revenueByDay} />
        </Panel>
        <Panel title="Booking status">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {(["confirmed", "reserved", "pending_payment", "cancelled", "expired"] as const).map((s) => (
              <div key={s} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5">
                <dt>
                  <BookingStatusBadge status={s} />
                </dt>
                <dd className="font-semibold tabular-nums">{m.statusCounts[s] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Upcoming screenings"
          actions={
            <Link href="/admin/screenings" className="btn btn-ghost btn-sm">
              <CalendarClock className="h-4 w-4" aria-hidden /> Manage
            </Link>
          }
        >
          <ul className="divide-y divide-white/[0.06]">
            {m.upcoming.map((s) => (
              <li key={s.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 py-3">
                <span className="text-sm tabular-nums">
                  <span className="block font-semibold">{formatTime(s.startsAt)}</span>
                  <span className="text-xs text-fg-subtle">{formatDateShort(s.startsAt).split(",")[0]}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.movieTitle}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">
                      {s.occupied}/{s.capacity} · {s.auditorium}
                    </span>
                  </span>
                  <span className="mt-1.5 block">
                    <Meter value={s.pct} held={s.held / Math.max(1, s.capacity)} label={`${s.movieTitle} occupancy`} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-subtle">Solid bar: sold or reserved. Lighter segment: seats held at checkout.</p>
        </Panel>

        <Panel
          title="Recent bookings"
          actions={
            <Link href="/admin/bookings" className="btn btn-ghost btn-sm">
              View all
            </Link>
          }
        >
          <ul className="divide-y divide-white/[0.06]">
            {m.recent.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bookings?q=${b.reference}`} className="flex items-center justify-between gap-3 py-3 hover:text-gold-200">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {b.customer.name} · {b.movieTitle}
                    </span>
                    <span className="font-mono text-xs text-fg-subtle">
                      {b.reference} · {b.seats.join(", ")} · {formatDateTime(b.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{formatUSD(b.totalCents)}</span>
                    <BookingStatusBadge status={b.status} redeemed={!!b.redeemedAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
