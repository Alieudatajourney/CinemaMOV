"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Accessibility, ArrowLeft, ArrowRight, CalendarDays, Clock3, Info, Loader2, MapPin, Minus, Plus, Sparkles, X } from "lucide-react";
import type { SeatMapView } from "@/server/core/catalog";
import { CATEGORY_LABEL, formatDateLong, formatTime, formatUSD } from "@/lib/format";
import { bestAvailableSeats, parseLayout, quoteSeats, toggleSeat } from "@/lib/seating";
import { api, holdStore, type ApiError } from "@/lib/client-store";
import { MoviePoster } from "../MoviePoster";
import { RatingBadge } from "../ui/badges";
import { AnimatedUSD } from "./AnimatedNumber";
import { BookingSteps } from "./BookingSteps";
import { LegendSeat } from "./SeatGlyph";
import { SeatMap, type VisualState } from "./SeatMap";

type States = Record<string, "occupied" | "held">;

const REASON: Record<string, (id: string, limit: number) => string> = {
  occupied: (id) => `Seat ${id} is already booked. Please choose another seat.`,
  held: (id) => `Seat ${id} is being held by another customer at checkout. It may become available again in a few minutes.`,
  limit: (_id, limit) => `You can book up to ${limit} tickets at a time.`,
  unknown: (id) => `Seat ${id} is not available.`,
};

export function SeatSelection({ view }: { view: SeatMapView }) {
  const router = useRouter();
  const search = useSearchParams();
  const reduce = useReducedMotion();
  const { screening, movie, auditorium } = view;
  const [states, setStates] = useState<States>(view.states as States);
  const [selection, setSelection] = useState<string[]>([]);
  const [pop, setPop] = useState<{ ids: string[]; n: number } | null>(null);
  /** Party size: null = not asked yet, 0 = customer chose to pick seats manually. */
  const [party, setParty] = useState<number | null>(null);
  /** True while the selection is exactly what "best available" picked (so changing the count re-picks). */
  const [auto, setAuto] = useState(false);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const [announce, setAnnounce] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [onSale, setOnSale] = useState(view.onSale);
  const nonce = useRef(0);
  const msgTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const seatIndex = useMemo(() => new Map(parseLayout(auditorium.rows).map((s) => [s.id, s])), [auditorium]);
  const quote = useMemo(() => quoteSeats(selection, auditorium, screening.prices), [selection, auditorium, screening.prices]);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ states: States; onSale: boolean }>(`/api/screenings/${screening.id}/seats`);
      setStates(data.states);
      setOnSale(data.onSale);
      return data.states;
    } catch {
      return null;
    }
  }, [screening.id]);

  // Returning from checkout (back button / "change seats"): release our own hold and restore the selection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const own = holdStore.forScreening(screening.id);
      let restore: string[] = (search.get("seats") ?? "").split(",").filter((s) => seatIndex.has(s));
      if (own) {
        try {
          const r = await api<{ status: string }>(`/api/holds/${own.holdId}`, { method: "DELETE", headers: { "x-hold-key": own.holdKey } });
          if (r.status === "released") restore = own.seatIds;
        } catch {}
        holdStore.clear(own);
      }
      const latest = await refresh();
      if (cancelled || !restore.length) return;
      const free = restore.filter((id) => !latest?.[id]).slice(0, view.maxTickets);
      setSelection(free);
      setParty(free.length || restore.length);
      if (free.length < restore.length) setMessage({ text: "Some of your previous seats were taken in the meantime.", tone: "warn" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // After "best available", bring the chosen seats into view (they may be off-screen on phones).
  useEffect(() => {
    if (!pop || pop.ids.length < 2) return;
    const el = document.getElementById(`seat-${pop.ids[Math.floor(pop.ids.length / 2)]}`);
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center", inline: "center" });
  }, [pop, reduce]);

  // Keep availability live while the customer is choosing.
  useEffect(() => {
    const t = setInterval(refresh, 15_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // If another customer takes a seat we had selected, drop it and explain.
  const [lastStates, setLastStates] = useState(states);
  if (lastStates !== states) {
    setLastStates(states);
    const lost = selection.filter((id) => states[id]);
    if (lost.length) {
      setSelection(selection.filter((id) => !states[id]));
      setMessage({ text: `${lost.join(", ")} ${lost.length > 1 ? "were" : "was"} just taken by another customer and removed from your selection.`, tone: "warn" });
    }
  }

  const stateOf = useCallback(
    (id: string): VisualState => (selection.includes(id) ? "selected" : (states[id] ?? "available")),
    [selection, states],
  );

  const flash = (text: string, tone: "info" | "warn") => {
    setMessage({ text, tone });
    setAnnounce(text);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(null), 4500);
  };

  const onSeat = (id: string) => {
    const r = toggleSeat(selection, id, { exists: seatIndex.has(id), state: states[id] ?? "available", limit: view.maxTickets });
    nonce.current += 1;
    if (!r.ok) {
      setShake({ id, n: nonce.current });
      setTimeout(() => setShake((s) => (s?.id === id ? null : s)), 400);
      flash(REASON[r.reason](id, view.maxTickets), "warn");
      return;
    }
    setSelection(r.selection);
    setMessage(null);
    setAuto(false);
    if (r.action === "added" && party !== null && r.selection.length > party) setParty(r.selection.length);
    if (party === null) setParty(0);
    const q = quoteSeats(r.selection, auditorium, screening.prices);
    if (r.action === "added") setPop({ ids: [id], n: nonce.current });
    setAnnounce(
      `Seat ${id} ${r.action === "added" ? "selected" : "removed"}. ${r.selection.length} ${r.selection.length === 1 ? "seat" : "seats"} selected, total ${formatUSD(q.totalCents)}.`,
    );
  };

  /** Select the best block of `n` seats (server still re-validates availability on Continue). */
  const pickBest = (n: number) => {
    const count = Math.max(1, Math.min(view.maxTickets, n));
    const ids = bestAvailableSeats(auditorium, (id) => !!states[id], count);
    nonce.current += 1;
    setParty(count);
    if (!ids.length) {
      setSelection([]);
      flash("Sorry — this screening is sold out. Please choose another showtime.", "warn");
      return;
    }
    setSelection(ids);
    setAuto(true);
    setPop({ ids, n: nonce.current });
    const q = quoteSeats(ids, auditorium, screening.prices);
    const together = ids.length > 1 && new Set(ids.map((id) => seatIndex.get(id)!.row)).size === 1;
    if (ids.length < count) flash(`Only ${ids.length} seats are left for this screening.`, "warn");
    else setMessage({ text: `Best available: ${ids.join(", ")}${together ? " — seated together" : ""}. Tap any seat to change.`, tone: "info" });
    setAnnounce(`Best available seats selected: ${ids.join(", ")}. Total ${formatUSD(q.totalCents)}.`);
  };

  const changeParty = (delta: number) => {
    const next = Math.max(1, Math.min(view.maxTickets, (party || selection.length || 1) + delta));
    if (!auto && next < selection.length) {
      flash("To book fewer tickets, tap one of your selected seats to remove it.", "info");
      return;
    }
    if (auto || selection.length === 0) pickBest(next);
    else setParty(next);
  };

  const onContinue = async () => {
    if (!selection.length || submitting) return;
    setSubmitting(true);
    try {
      const res = await api<{ holdId: string; holdKey: string; seatIds: string[] }>("/api/holds", {
        method: "POST",
        json: { screeningId: screening.id, seatIds: selection },
      });
      holdStore.save({ holdId: res.holdId, holdKey: res.holdKey, screeningId: screening.id, seatIds: res.seatIds });
      router.push(`/snacks/${res.holdId}`);
    } catch (e) {
      const err = e as ApiError;
      setSubmitting(false);
      if (err.code === "SEAT_UNAVAILABLE") {
        await refresh();
      }
      if (err.code === "SCREENING_CLOSED") setOnSale(false);
      flash(err.message, "warn");
    }
  };

  const seatsLabel = selection.length === 1 ? "1 seat" : `${selection.length} seats`;
  const remaining = party ? Math.max(0, party - selection.length) : 0;
  const progressHint = remaining ? `Select ${remaining} more seat${remaining > 1 ? "s" : ""}` : null;
  const canContinue = selection.length > 0 && onSale && !submitting;

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Context header */}
      <div className="border-b border-white/[0.06] bg-ink-950/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/movies/${movie.slug}#showtimes`} className="btn btn-ghost btn-sm -ml-2 shrink-0" aria-label="Back to showtimes">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Showtimes</span>
            </Link>
            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl sm:text-3xl">{movie.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-gold-400" aria-hidden />
                  {formatDateLong(screening.startsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-gold-400" aria-hidden />
                  {formatTime(screening.startsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gold-400" aria-hidden />
                  {auditorium.name} · {screening.format}
                </span>
              </p>
            </div>
          </div>
          <BookingSteps current={1} />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pt-10">
        <section aria-labelledby="aud-title" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="aud-title" className="font-display text-3xl">
              {auditorium.name} <span className="text-lg text-fg-subtle">· {auditorium.shortName}</span>
            </h2>
            <p className="text-sm text-fg-muted">Choose up to {view.maxTickets} seats</p>
          </div>

          {!onSale && (
            <p role="alert" className="mb-4 rounded-xl border border-warning-400/30 bg-warning-700/30 px-4 py-3 text-sm text-warning-400">
              Online booking for this screening has closed.{" "}
              <Link href={`/movies/${movie.slug}#showtimes`} className="underline">
                Choose another showtime
              </Link>
              .
            </p>
          )}

          <AnimatePresence initial={false} mode="wait">
            {party === null && selection.length === 0 && onSale ? (
              <motion.div
                key="ask"
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                className="surface mb-4 p-5"
                role="group"
                aria-labelledby="party-q"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p id="party-q" className="font-display text-2xl">
                      How many tickets?
                    </p>
                    <p className="mt-1 text-sm text-fg-muted">We&apos;ll pick the best seats together. You can change them on the map.</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm self-start md:self-center" onClick={() => setParty(0)}>
                    I&apos;ll choose seats myself
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {Array.from({ length: Math.min(8, view.maxTickets) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => pickBest(n)}
                      className="flex min-h-14 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] font-display text-2xl transition-all hover:-translate-y-0.5 hover:border-gold-400/70 hover:bg-gold-400/10 hover:text-gold-200"
                      aria-label={`${n} ${n === 1 ? "ticket" : "tickets"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="bar"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-fg-muted">Tickets</span>
                  <div className="flex items-center gap-1 rounded-full border border-white/12 p-1" role="group" aria-label="Number of tickets">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
                      onClick={() => changeParty(-1)}
                      disabled={(party || selection.length || 1) <= 1}
                      aria-label="One fewer ticket"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="w-7 text-center font-bold tabular-nums" aria-live="polite">
                      {party || selection.length || 1}
                    </span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
                      onClick={() => changeParty(1)}
                      disabled={(party || selection.length || 1) >= view.maxTickets}
                      aria-label="One more ticket"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {progressHint && <span className="text-sm text-gold-300">{progressHint}</span>}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!onSale} onClick={() => pickBest(party || selection.length || 2)}>
                  <Sparkles className="h-4 w-4 text-gold-300" aria-hidden /> Best available
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="surface relative overflow-hidden px-2 pb-5 pt-8 sm:px-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold-400/[0.06] to-transparent" aria-hidden />
            <SeatMap auditorium={auditorium} prices={screening.prices} stateOf={stateOf} onSeat={onSeat} pop={pop} shake={shake} />
          </div>

          {/* Inline status message (visible) */}
          <div className="min-h-[3.25rem] pt-3">
            <AnimatePresence>
              {message && (
                <motion.p
                  key={message.text}
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={clsx(
                    "flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm",
                    message.tone === "warn" ? "border-warning-400/30 bg-warning-700/25 text-warning-400" : "border-white/10 bg-white/5 text-fg-muted",
                  )}
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {message.text}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announce}
          </p>

          <Legend prices={screening.prices} holdMinutes={view.holdMinutes} />
        </section>

        {/* Desktop summary */}
        <aside className="hidden lg:block" aria-label="Booking summary">
          <div className="surface sticky top-[calc(var(--header-h)+16px)] overflow-hidden">
            <div className="flex gap-4 border-b border-white/[0.06] p-5">
              <MoviePoster movie={movie} className="aspect-[2/3] w-16 shrink-0 rounded-lg" showTitle={false} />
              <div className="min-w-0">
                <p className="font-display text-xl leading-tight">{movie.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                  <RatingBadge rating={movie.rating} /> {screening.format}
                </p>
                <p className="mt-2 text-sm text-fg-muted">
                  {formatDateLong(screening.startsAt)}
                  <br />
                  {formatTime(screening.startsAt)} · {auditorium.name}
                </p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Your seats</p>
              <ul className="mt-3 flex min-h-10 flex-wrap gap-2" aria-label="Selected seats">
                <AnimatePresence initial={false} mode="popLayout">
                  {selection.length === 0 && (
                    <motion.li key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-fg-subtle">
                      Tap a seat on the map to select it.
                    </motion.li>
                  )}
                  {quote.items.map((it) => (
                    <motion.li
                      key={it.seatId}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, scale: 0.6, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      transition={{ type: "spring", stiffness: 520, damping: 30 }}
                    >
                      <SeatChip id={it.seatId} category={it.category} onRemove={() => onSeat(it.seatId)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              {quote.byCategory.length > 0 && (
                <dl className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
                  {quote.byCategory.map((c) => (
                    <div key={c.category} className="flex justify-between gap-3">
                      <dt className="text-fg-muted">
                        {c.count} × {CATEGORY_LABEL[c.category]} <span className="text-fg-subtle">@ {formatUSD(c.unitCents)}</span>
                      </dt>
                      <dd className="tabular-nums">{formatUSD(c.lineCents)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 text-fg-subtle">
                    <dt>Subtotal</dt>
                    <dd className="tabular-nums">{formatUSD(quote.subtotalCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 text-fg-subtle">
                    <dt>Booking fee</dt>
                    <dd className="tabular-nums">{formatUSD(quote.feesCents)}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-4 flex items-end justify-between border-t border-white/[0.06] pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-fg-subtle">Total</p>
                  <p className="text-sm text-fg-muted">{selection.length ? seatsLabel : "No seats yet"}</p>
                  {progressHint && <p className="text-xs text-gold-300">{progressHint}</p>}
                </div>
                <AnimatedUSD cents={quote.totalCents} className="font-display text-4xl tabular-nums text-gold-200" />
              </div>

              <button type="button" onClick={onContinue} disabled={!canContinue} className="btn btn-primary btn-lg mt-5 w-full">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
                {submitting ? "Holding your seats…" : "Continue"}
                {!submitting && <ArrowRight className="h-5 w-5" aria-hidden />}
              </button>
              <p className="mt-3 text-center text-xs text-fg-subtle">
                Seats are held for {view.holdMinutes} minutes once you continue.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-900/95 px-4 pt-3 backdrop-blur-xl lg:hidden" aria-label="Booking summary">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-fg-muted">
              {selection.length ? (
                <>
                  <span className="font-semibold text-fg">{progressHint ?? seatsLabel}</span> · {quote.items.map((i) => i.seatId).join(", ")}
                </>
              ) : (
                "Select your seats"
              )}
            </p>
            <AnimatedUSD cents={quote.totalCents} className="font-display text-2xl tabular-nums text-gold-200" />
          </div>
          <button type="button" onClick={onContinue} disabled={!canContinue} className="btn btn-primary shrink-0">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? "Holding…" : "Continue"}
            {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SeatChip({ id, category, onRemove }: { id: string; category: string; onRemove: () => void }) {
  return (
    <span
      className={clsx(
        "inline-flex h-9 items-center gap-1.5 rounded-full border pl-3 pr-1 text-sm font-bold tabular-nums",
        category === "vip" ? "border-velvet-400/60 bg-velvet-700/50 text-velvet-300" : "border-gold-400/60 bg-gold-400/15 text-gold-200",
      )}
    >
      {category === "accessible" && <Accessibility className="h-3.5 w-3.5" aria-hidden />}
      {id}
      <button type="button" onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10" aria-label={`Remove seat ${id}`}>
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
}

function Legend({ prices, holdMinutes }: { prices: SeatMapView["screening"]["prices"]; holdMinutes: number }) {
  const items: { label: string; sub?: string; el: React.ReactNode }[] = [
    { label: "Available", sub: `Standard ${formatUSD(prices.standard)}`, el: <LegendSeat state="available" /> },
    { label: "Selected", sub: "Your choice", el: <LegendSeat state="selected" /> },
    { label: "Occupied", sub: "Already booked", el: <LegendSeat state="occupied"><X className="seat-icon" strokeWidth={2.5} /></LegendSeat> },
    { label: "Temporarily held", sub: `At checkout (up to ${holdMinutes} min)`, el: <LegendSeat state="held"><Clock3 className="seat-icon" strokeWidth={2.4} /></LegendSeat> },
    { label: "VIP Recliner", sub: formatUSD(prices.vip), el: <LegendSeat state="available" category="vip" /> },
    { label: "Accessible", sub: `Wheelchair space · ${formatUSD(prices.accessible)}`, el: <LegendSeat state="available" category="accessible"><Accessibility className="seat-icon" strokeWidth={2.4} /></LegendSeat> },
  ];
  return (
    <div className="mt-2">
      <h3 className="sr-only">Seat legend</h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3">
            {i.el}
            <span className="text-sm leading-tight">
              {i.label}
              {i.sub && <span className="block text-xs text-fg-subtle">{i.sub}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
