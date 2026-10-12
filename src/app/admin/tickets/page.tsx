import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { dateKey, formatDateTime } from "@/lib/format";
import { AdminHeader, Panel, StatTile } from "@/components/admin/ui";
import { TicketValidator } from "@/components/staff/TicketValidator";

export const metadata: Metadata = { title: "Tickets" };

const OUTCOME_LABEL: Record<string, string> = {
  admitted: "Admitted",
  checked: "Checked only (not admitted)",
  not_today: "Rejected — different day",
  already_redeemed: "Rejected — already used",
  cancelled: "Rejected — cancelled",
  unpaid: "Unpaid",
  pending_payment: "Payment pending",
  expired: "Rejected — expired",
  screening_ended: "Rejected — ended",
  invalid: "Rejected — invalid",
};

export default async function AdminTickets() {
  await requirePageRole(["admin"], "/admin/tickets");
  const d = await readDb((db, now) => {
    const today = dateKey(now);
    const todaysScreenings = new Set(db.screenings.filter((s) => dateKey(s.startsAt) === today).map((s) => s.id));
    const todayValid = db.bookings.filter((b) => todaysScreenings.has(b.screeningId) && (b.status === "confirmed" || b.status === "reserved"));
    const log = [...db.redemptions]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 15)
      .map((r) => {
        const b = r.bookingId ? db.bookings.find((x) => x.id === r.bookingId) : undefined;
        return { ...r, reference: b?.reference ?? "—", seats: b?.items.map((i) => i.seatId).join(", ") ?? "" };
      });
    return {
      expected: todayValid.reduce((n, b) => n + b.items.length, 0),
      admitted: todayValid.filter((b) => b.redeemedAt).reduce((n, b) => n + b.items.length, 0),
      unpaid: todayValid.filter((b) => b.status === "reserved").length,
      rejected: db.redemptions.filter((r) => r.outcome !== "admitted" && r.outcome !== "checked" && dateKey(r.at) === today).length,
      log,
    };
  });
  return (
    <>
      <AdminHeader eyebrow="Entrance" title="Tickets" description="Redemption status for today's screenings. Validation here uses the same booking records and rules as the staff check-in screen." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Expected today" value={String(d.expected)} sub="Admissions for today's screenings" />
        <StatTile label="Admitted" value={String(d.admitted)} sub={d.expected ? `${Math.round((d.admitted / d.expected) * 100)}% checked in` : "—"} />
        <StatTile label="Unpaid reservations" value={String(d.unpaid)} sub="Collect at the box office" />
        <StatTile label="Rejected scans today" value={String(d.rejected)} />
      </div>
      <div className="mt-8">
        <TicketValidator />
      </div>
      <Panel title="Recent scans" className="mt-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-fg-subtle">
              <tr>
                <th className="py-2 font-semibold">Time</th>
                <th className="py-2 font-semibold">Reference</th>
                <th className="py-2 font-semibold">Seats</th>
                <th className="py-2 font-semibold">Result</th>
                <th className="py-2 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {d.log.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.05]">
                  <td className="py-2 tabular-nums">{formatDateTime(r.at)}</td>
                  <td className="py-2 font-mono">{r.reference}</td>
                  <td className="py-2">{r.seats}</td>
                  <td className={`py-2 ${r.outcome === "admitted" ? "text-success-400" : "text-danger-400"}`}>{OUTCOME_LABEL[r.outcome]}</td>
                  <td className="py-2 text-fg-subtle">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
