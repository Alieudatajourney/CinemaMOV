"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Minus, Plus, RotateCcw, ShoppingBag, Sparkles } from "lucide-react";
import type { ConcessionItem, ConcessionSelection, Movie, Screening, Auditorium } from "@/lib/types";
import { CATEGORY_ORDER, MAX_UNITS_PER_LINE, MAX_UNITS_TOTAL, describeCart, describeLine } from "@/lib/concessions";
import { formatDateLong, formatTime, formatUSD } from "@/lib/format";
import { api, holdStore, type ApiError, type HoldRef } from "@/lib/client-store";
import { AnimatedUSD } from "../booking/AnimatedNumber";
import { BookingSteps } from "../booking/BookingSteps";
import { HoldTimer, useCountdown } from "../booking/HoldTimer";
import { SnackImage } from "./SnackImage";

interface HoldData {
  hold: { id: string; status: string; seatIds: string[]; expiresAt: string; screeningId: string; extras: ConcessionSelection[] };
  quote: { totalCents: number };
  booking: { reference: string; accessKey: string } | null;
  serverNow: string;
}

interface Context {
  movie: Pick<Movie, "title" | "slug">;
  screening: Pick<Screening, "id" | "startsAt" | "format">;
  auditorium: Pick<Auditorium, "name">;
}

type Phase = "loading" | "ready" | "saving" | "expired" | "missing";

export function SnackStep({ holdId, menu, context }: { holdId: string; menu: ConcessionItem[]; context: Context | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [ref, setRef] = useState<HoldRef | null>(null);
  const [data, setData] = useState<HoldData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [skew, setSkew] = useState(0);
  const [cart, setCart] = useState<ConcessionSelection[]>([]);
  const [variantOf, setVariantOf] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [active, setActive] = useState(CATEGORY_ORDER[0].id);
  const saving = useRef(false);

  const load = useCallback(async () => {
    const r = holdStore.get(holdId);
    setRef(r);
    const finished = holdStore.done(holdId);
    if (!r && finished) {
      router.replace(`/booking/${finished.reference}?k=${encodeURIComponent(finished.accessKey)}`);
      return;
    }
    if (!r) return setPhase("missing");
    try {
      const d = await api<HoldData>(`/api/holds/${holdId}`, { headers: { "x-hold-key": r.holdKey } });
      if (d.booking) {
        holdStore.clear(r);
        router.replace(`/booking/${d.booking.reference}?k=${encodeURIComponent(d.booking.accessKey)}`);
        return;
      }
      setData(d);
      setSkew(Date.parse(d.serverNow) - Date.now());
      setCart(d.hold.extras);
      setVariantOf(Object.fromEntries(d.hold.extras.map((e) => [e.itemId, e.variantId])));
      setPhase(d.hold.status === "active" ? "ready" : "expired");
    } catch {
      setPhase("missing");
    }
  }, [holdId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, [load]);

  const left = useCountdown(data?.hold.status === "active" ? data.hold.expiresAt : null, skew);
  if (left === 0 && phase === "ready") setPhase("expired");

  const cartView = useMemo(() => describeCart(cart, menu), [cart, menu]);
  const { lines, units, totalCents: snackTotal, problems } = cartView;
  const cartOk = problems.length === 0;
  const atLimit = units >= MAX_UNITS_TOTAL;
  const ticketsTotal = data?.quote.totalCents ?? 0;
  const seatCount = data?.hold.seatIds.length ?? 1;

  const qtyOf = (itemId: string, variantId: string) => cart.find((c) => c.itemId === itemId && c.variantId === variantId)?.qty ?? 0;

  const change = (item: ConcessionItem, variantId: string, delta: number) => {
    const current = qtyOf(item.id, variantId);
    if (delta > 0 && cart.reduce((n, c) => n + c.qty, 0) >= MAX_UNITS_TOTAL) {
      setError(`Orders are limited to ${MAX_UNITS_TOTAL} snack items.`);
      setAnnounce(`Orders are limited to ${MAX_UNITS_TOTAL} snack items.`);
      return;
    }
    const next = Math.max(0, Math.min(MAX_UNITS_PER_LINE, current + delta));
    if (next === current) return;
    const variant = item.variants.find((v) => v.id === variantId)!;
    setCart((c) => {
      const rest = c.filter((x) => !(x.itemId === item.id && x.variantId === variantId));
      return next ? [...rest, { itemId: item.id, variantId, qty: next }] : rest;
    });
    setError(null);
    setAnnounce(`${item.name}${item.variants.length > 1 ? ` ${variant.label}` : ""}: ${next} in your order.`);
  };

  const save = async (extras: ConcessionSelection[]) => {
    if (!ref || saving.current) return;
    saving.current = true;
    setPhase("saving");
    setError(null);
    try {
      await api(`/api/holds/${holdId}/extras`, { method: "PUT", json: { holdKey: ref.holdKey, extras } });
      router.push(`/checkout/${holdId}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "HOLD_EXPIRED") setPhase("expired");
      else {
        setError(err.message);
        setPhase("ready");
      }
      saving.current = false;
    }
  };

  const chooseAgainHref = `/book/${data?.hold.screeningId ?? context?.screening.id ?? ""}${data ? `?seats=${data.hold.seatIds.join(",")}` : ""}`;

  if (phase === "loading") {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]" aria-busy="true" aria-label="Loading snacks">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-72" />
          ))}
        </div>
        <div className="skeleton h-80" />
      </div>
    );
  }

  if (phase === "missing" || phase === "expired" || !context) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <div className="surface fade-up p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            {phase === "expired" ? <RotateCcw className="h-8 w-8 text-gold-300" /> : <AlertTriangle className="h-8 w-8 text-warning-400" />}
          </div>
          <h1 className="font-display mt-5 text-3xl">{phase === "expired" ? "Your seat hold expired" : "This order isn't available"}</h1>
          <p className="mt-3 text-fg-muted">
            {phase === "expired"
              ? "Held seats are released when the timer runs out. Your seats may still be free."
              : "Seat holds belong to the browser tab where they were created. Please choose your seats again."}
          </p>
          <Link href={context ? chooseAgainHref : "/movies"} className="btn btn-primary mt-8">
            Choose seats again
          </Link>
        </div>
      </div>
    );
  }

  const featured = menu.find((m) => m.featured && m.category === "combos" && m.available);
  const busy = phase === "saving";

  return (
    <div className="pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-16">
      <div className="border-b border-white/[0.06] bg-ink-950/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href={chooseAgainHref} className="btn btn-ghost btn-sm -ml-2">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Change seats
            </Link>
            <div>
              <h1 className="font-display text-3xl">Snacks & drinks</h1>
              <p className="text-xs text-fg-muted">
                {context.movie.title} · {formatDateLong(context.screening.startsAt)}, {formatTime(context.screening.startsAt)} · {context.auditorium.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <HoldTimer msLeft={left} />
            <BookingSteps current={2} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:pt-8">
        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Optional</p>
              <p className="mt-1 max-w-xl text-fg-muted">Pre-order now and skip the queue — collect at the concession counter with your ticket.</p>
            </div>
            <button type="button" className="btn btn-secondary self-start sm:self-auto" disabled={busy} onClick={() => save([])}>
              Skip snacks <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {featured && (
            <FeaturedCombo
              item={featured}
              seatCount={seatCount}
              qty={qtyOf(featured.id, featured.variants[0].id)}
              onChange={(d) => change(featured, featured.variants[0].id, d)}
              blockAdd={atLimit}
            />
          )}

          <nav aria-label="Menu categories" className="sticky top-[var(--header-h)] z-20 -mx-4 mb-4 mt-8 flex gap-2 overflow-x-auto bg-ink-950/90 px-4 py-3 backdrop-blur-md [scrollbar-width:none] sm:mx-0 sm:px-0">
            {CATEGORY_ORDER.filter((c) => menu.some((m) => m.category === c.id)).map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setActive(c.id)}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active === c.id ? "border-gold-400/60 bg-gold-400/10 text-gold-200" : "border-white/10 text-fg-muted hover:text-fg",
                )}
              >
                {c.label}
              </a>
            ))}
          </nav>

          {CATEGORY_ORDER.map((cat) => {
            const items = menu.filter((m) => m.category === cat.id);
            if (!items.length) return null;
            return (
              <section key={cat.id} id={`cat-${cat.id}`} aria-labelledby={`h-${cat.id}`} className="mb-10 scroll-mt-[calc(var(--header-h)+72px)]">
                <h2 id={`h-${cat.id}`} className="font-display mb-4 text-3xl">
                  {cat.label}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const vId = variantOf[item.id] ?? item.variants[Math.min(1, item.variants.length - 1)].id;
                    return (
                      <li key={item.id}>
                        <SnackCard
                          item={item}
                          variantId={vId}
                          onVariant={(id) => setVariantOf((v) => ({ ...v, [item.id]: id }))}
                          qty={qtyOf(item.id, vId)}
                          totalQty={cart.filter((c) => c.itemId === item.id).reduce((n, c) => n + c.qty, 0)}
                          onChange={(d) => change(item, vId, d)}
                          blockAdd={atLimit}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </div>

        {/* Order summary (desktop) */}
        <aside className="hidden lg:block" aria-label="Order summary">
          <div className="surface sticky top-[calc(var(--header-h)+16px)] p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              <ShoppingBag className="h-4 w-4 text-gold-400" aria-hidden /> Your order
            </p>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-fg-muted">
                {seatCount} {seatCount === 1 ? "ticket" : "tickets"} · {data!.hold.seatIds.join(", ")}
              </span>
              <span className="tabular-nums">{formatUSD(ticketsTotal)}</span>
            </div>
            <ul className="mt-3 space-y-2 border-t border-white/[0.06] pt-3 text-sm" aria-label="Snacks in your order">
              <AnimatePresence initial={false}>
                {lines.length === 0 && (
                  <motion.li key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-fg-subtle">
                    No snacks yet — add some or skip.
                  </motion.li>
                )}
                {lines.map((l) => (
                  <motion.li
                    key={`${l.itemId}:${l.variantId}`}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                    className="flex justify-between gap-3"
                  >
                    <span className="text-fg-muted">{describeLine(l)}</span>
                    <span className="tabular-nums">{formatUSD(l.lineCents)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-4 flex items-end justify-between border-t border-white/[0.06] pt-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-fg-subtle">Total</p>
                <p className="text-xs text-fg-muted">{units ? `${units} snack item${units > 1 ? "s" : ""}` : "Tickets only"}</p>
              </div>
              <AnimatedUSD cents={ticketsTotal + snackTotal} className="font-display text-4xl tabular-nums text-gold-200" />
            </div>
            {(error || problems.length > 0) && (
              <p role="alert" className="mt-3 text-sm text-danger-400">
                {problems[0] ?? error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg mt-5 w-full" disabled={busy || !cartOk} onClick={() => save(cart)}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {lines.length ? "Continue to payment" : "Continue without snacks"}
              {!busy && <ArrowRight className="h-5 w-5" aria-hidden />}
            </button>
            {cart.length > 0 && (
              <button type="button" className="btn btn-ghost mt-2 w-full" disabled={busy} onClick={() => { setCart([]); setError(null); }}>
                Clear snacks
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-900/95 px-4 pt-3 backdrop-blur-xl lg:hidden" aria-label="Order total">
        {(error || problems.length > 0) && (
          <p role="alert" className="mb-2 flex items-center justify-between gap-2 text-xs text-danger-400">
            <span>{problems[0] ?? error}</span>
            {problems.length > 0 && (
              <button type="button" className="shrink-0 underline" onClick={() => { setCart([]); setError(null); }}>
                Clear snacks
              </button>
            )}
          </p>
        )}
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-fg-muted">
              {seatCount} {seatCount === 1 ? "ticket" : "tickets"}
              {units ? ` + ${units} snack${units > 1 ? "s" : ""}` : ""}
            </p>
            <AnimatedUSD cents={ticketsTotal + snackTotal} className="font-display text-2xl tabular-nums text-gold-200" />
          </div>
          {cart.length === 0 && (
            <button type="button" className="btn btn-ghost btn-sm shrink-0" disabled={busy} onClick={() => save([])}>
              Skip
            </button>
          )}
          <button type="button" className="btn btn-primary shrink-0" disabled={busy || !cartOk} onClick={() => save(cart)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Continue
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ name, qty, onChange, disabled }: { name: string; qty: number; onChange: (d: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-gold-400/50 bg-gold-400/10 p-1" role="group" aria-label={`${name} quantity`}>
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-gold-200 hover:bg-white/10" onClick={() => onChange(-1)} aria-label={`Remove one ${name}`}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-7 text-center font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-gold-200 hover:bg-white/10 disabled:opacity-40"
        onClick={() => onChange(1)}
        disabled={disabled}
        aria-label={`Add one more ${name}`}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function SnackCard({
  item,
  variantId,
  onVariant,
  qty,
  totalQty,
  onChange,
  blockAdd,
}: {
  item: ConcessionItem;
  variantId: string;
  onVariant: (id: string) => void;
  qty: number;
  totalQty: number;
  onChange: (d: number) => void;
  blockAdd?: boolean;
}) {
  const variant = item.variants.find((v) => v.id === variantId)!;
  const fullName = item.variants.length > 1 ? `${variant.label} ${item.name}` : item.name;
  return (
    <article className={clsx("movie-card surface flex h-full flex-col overflow-hidden", !item.available && "opacity-60")} aria-label={item.name}>
      <div className="relative">
        <SnackImage item={item} className="aspect-[4/3] w-full" />
        {totalQty > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 text-xs font-bold text-ink-950 shadow-lift">{totalQty} added</span>
        )}
        {!item.available && <span className="absolute left-3 top-3 rounded-full bg-ink-950/85 px-2.5 py-1 text-xs font-semibold">Sold out</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-lg font-semibold">{item.name}</h3>
          <p className="mt-1 text-sm text-fg-muted">{item.description}</p>
        </div>
        {item.variants.length > 1 && (
          <div className="flex gap-1.5" role="radiogroup" aria-label={`${item.name} size`}>
            {item.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variantId}
                onClick={() => onVariant(v.id)}
                disabled={!item.available}
                className={clsx(
                  "flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl border px-2 py-1 text-xs transition-colors",
                  v.id === variantId ? "border-gold-400/70 bg-gold-400/10 text-gold-200" : "border-white/10 text-fg-muted hover:border-white/25",
                )}
              >
                <span className="font-semibold">{v.label}</span>
                <span className="tabular-nums">{formatUSD(v.priceCents)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="font-display text-2xl tabular-nums">{formatUSD(variant.priceCents)}</span>
          {!item.available ? (
            <span className="text-sm text-fg-subtle">Unavailable</span>
          ) : qty > 0 ? (
            <Stepper name={fullName} qty={qty} onChange={onChange} disabled={qty >= MAX_UNITS_PER_LINE || !!blockAdd} />
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(1)} aria-label={`Add ${fullName}`}>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FeaturedCombo({
  item,
  seatCount,
  qty,
  onChange,
  blockAdd,
}: {
  item: ConcessionItem;
  seatCount: number;
  qty: number;
  onChange: (d: number) => void;
  blockAdd?: boolean;
}) {
  const price = item.variants[0].priceCents;
  return (
    <section className="surface relative grid overflow-hidden sm:grid-cols-[1.1fr_1fr]" aria-label={`Recommended: ${item.name}`}>
      <SnackImage item={item} className="aspect-[16/10] w-full sm:aspect-auto sm:h-full" />
      <div className="relative flex flex-col justify-center gap-3 p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
          <Sparkles className="h-4 w-4" aria-hidden /> {seatCount >= 2 ? `Perfect for ${seatCount} guests` : "Most popular"}
        </p>
        <h2 className="font-display text-4xl leading-tight">{item.name}</h2>
        <p className="text-fg-muted">{item.description}</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="font-display text-3xl tabular-nums text-gold-200">{formatUSD(price)}</span>
          {qty > 0 ? (
            <Stepper name={item.name} qty={qty} onChange={onChange} disabled={qty >= MAX_UNITS_PER_LINE || !!blockAdd} />
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => onChange(1)}>
              <Plus className="h-4 w-4" aria-hidden /> Add combo
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
