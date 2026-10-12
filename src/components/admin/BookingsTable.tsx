"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AdminBookingRow } from "@/server/core/admin";
import { CATEGORY_LABEL, formatDateTime, formatUSD } from "@/lib/format";
import { api, type ApiError } from "@/lib/client-store";
import { describeLine } from "@/lib/concessions";
import { BookingStatusBadge, PaymentStatusBadge } from "../ui/badges";

export function BookingsTable({ rows }: { rows: AdminBookingRow[] }) {
  const [open, setOpen] = useState<AdminBookingRow | null>(null);
  if (!rows.length) return <p className="surface p-10 text-center text-fg-muted">No bookings match these filters.</p>;
  return (
    <>
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-fg-subtle">
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Screening</th>
              <th className="px-4 py-3 font-semibold">Seats</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <button type="button" className="font-mono font-semibold text-gold-200 underline-offset-4 hover:underline" onClick={() => setOpen(r)}>
                    {r.reference}
                  </button>
                  {r.seeded && <span className="block text-[0.65rem] text-fg-subtle">sample</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="block">{r.customer.name}</span>
                  <span className="text-xs text-fg-subtle">{r.customer.phone}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{r.movieTitle}</span>
                  <span className="text-xs text-fg-subtle">
                    {r.startsAt ? formatDateTime(r.startsAt) : "—"} · {r.auditorium}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{r.seats.join(", ")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUSD(r.totalCents)}</td>
                <td className="px-4 py-3">
                  <BookingStatusBadge status={r.status} redeemed={!!r.redeemedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <BookingDrawer row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function BookingDrawer({ row, onClose }: { row: AdminBookingRow; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(row);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const cancellable =
    !current.redeemedAt && ["confirmed", "reserved", "pending_payment"].includes(current.status) && Date.parse(current.startsAt) > openedAt;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<AdminBookingRow>(`/api/admin/bookings/${current.id}/cancel`, { method: "POST", json: { reason, confirm: true } });
      setCurrent(updated);
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="ml-auto mr-0 h-dvh max-h-dvh w-full max-w-md border-l border-white/10 bg-ink-900 p-0 text-fg backdrop:bg-black/60"
      aria-label={`Booking ${current.reference}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
        <div>
          <p className="font-mono text-lg font-bold">{current.reference}</p>
          <div className="mt-1 flex gap-2">
            <BookingStatusBadge status={current.status} redeemed={!!current.redeemedAt} />
            <PaymentStatusBadge status={current.paymentStatus} />
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="space-y-5 p-5 text-sm">
        <Section title="Screening">
          <p className="font-display text-2xl">{current.movieTitle}</p>
          <p className="text-fg-muted">
            {formatDateTime(current.startsAt)} · {current.auditorium}
          </p>
        </Section>
        <Section title={current.concessions.length ? "Seats & snacks" : "Seats"}>
          <ul className="space-y-1">
            {current.items.map((i) => (
              <li key={i.seatId} className="flex justify-between">
                <span>
                  <span className="font-semibold">{i.seatId}</span> <span className="text-fg-subtle">{CATEGORY_LABEL[i.category]}</span>
                </span>
                <span className="tabular-nums">{formatUSD(i.priceCents)}</span>
              </li>
            ))}
            {current.concessions.map((c) => (
              <li key={`${c.itemId}:${c.variantId}`} className="flex justify-between">
                <span className="text-fg-muted">{describeLine(c)}</span>
                <span className="tabular-nums">{formatUSD(c.lineCents)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-white/[0.06] pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatUSD(current.totalCents)}</span>
            </li>
          </ul>
        </Section>
        <Section title="Customer">
          <p>{current.customer.name}</p>
          <p className="text-fg-muted">{current.customer.phone}</p>
          {current.customer.email && <p className="text-fg-muted">{current.customer.email}</p>}
        </Section>
        <Section title="History">
          <p className="text-fg-muted">Booked {formatDateTime(current.createdAt)} · {current.paymentMethod === "pay_at_cinema" ? "Pay at cinema" : "Online (demo)"}</p>
          {current.redeemedAt && (
            <p className="text-fg-muted">
              Admitted {formatDateTime(current.redeemedAt)} by {current.redeemedBy}
            </p>
          )}
          {current.cancelReason && <p className="text-fg-muted">{current.cancelReason}</p>}
        </Section>

        {cancellable &&
          (confirming ? (
            <div className="rounded-2xl border border-danger-400/40 bg-danger-700/30 p-4" role="alertdialog" aria-labelledby="cx-title">
              <p id="cx-title" className="font-semibold text-danger-400">
                Cancel booking {current.reference}?
              </p>
              <p className="mt-1 text-fg-muted">
                Seats {current.seats.join(", ")} will be released for sale. {current.paymentStatus === "paid" ? "The demo payment will be marked refunded." : ""}
              </p>
              <label htmlFor="reason" className="label mt-3">
                Reason (optional)
              </label>
              <input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer request" />
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-danger" disabled={busy} onClick={cancel}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Confirm cancellation
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  Keep booking
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-danger w-full" onClick={() => setConfirming(true)}>
              Cancel booking…
            </button>
          ))}
        {error && (
          <p role="alert" className="text-danger-400">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}
