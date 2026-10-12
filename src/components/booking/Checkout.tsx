"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, Building2, CreditCard, Loader2, Lock, Popcorn, RotateCcw, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import type { Quote } from "@/lib/seating";
import type { Auditorium, ConcessionLine, Movie, Screening, DemoPaymentMode } from "@/lib/types";
import { describeLine } from "@/lib/concessions";
import { CATEGORY_LABEL, formatDateLong, formatTime, formatUSD } from "@/lib/format";
import { api, holdStore, ticketStore, type ApiError, type HoldRef } from "@/lib/client-store";
import { MoviePoster } from "../MoviePoster";
import { DemoBadge, RatingBadge } from "../ui/badges";
import { BookingSteps } from "./BookingSteps";
import { HoldTimer, useCountdown } from "./HoldTimer";

interface HoldData {
  hold: { id: string; status: "active" | "converted" | "released" | "expired"; seatIds: string[]; expiresAt: string; screeningId: string };
  quote: Quote;
  extras: { lines: ConcessionLine[]; totalCents: number; error?: string };
  grandTotalCents: number;
  booking: { reference: string; accessKey: string; status: string } | null;
  lastPayment: { outcome: string; reference: string } | null;
  serverNow: string;
}
interface Context {
  movie: Pick<Movie, "title" | "slug" | "rating" | "art" | "posterUrl" | "runtimeMin">;
  screening: Pick<Screening, "id" | "startsAt" | "format">;
  auditorium: Pick<Auditorium, "name" | "shortName">;
  demoPaymentMode: DemoPaymentMode;
}

type Method = "pay_at_cinema" | "demo_online";
type Outcome = "succeeded" | "pending" | "failed";
type Phase = "loading" | "ready" | "processing" | "failed" | "expired" | "missing";

const MIN_PROCESSING_MS = 1400;

export function Checkout({ holdId, context }: { holdId: string; context: Context | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [ref, setRef] = useState<HoldRef | null>(null);
  const [data, setData] = useState<HoldData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [skew, setSkew] = useState(0);
  const [method, setMethod] = useState<Method>("demo_online");
  const [outcome, setOutcome] = useState<Outcome>("succeeded");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const inFlight = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);

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
      setData(d);
      setSkew(Date.parse(d.serverNow) - Date.now());
      if (d.hold.status === "converted" && d.booking) {
        // Refresh/back after completing: never re-book — go to the existing booking.
        holdStore.clear(r);
        router.replace(`/booking/${d.booking.reference}?k=${encodeURIComponent(d.booking.accessKey)}`);
        return;
      }
      setPhase(d.hold.status === "active" ? (d.lastPayment?.outcome === "failed" ? "failed" : "ready") : "expired");
      if (d.lastPayment?.outcome === "failed") setFailure("Your last payment attempt was declined (demo). You can try again or choose another method.");
    } catch {
      setPhase("missing");
    }
  }, [holdId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, [load]);

  const left = useCountdown(data?.hold.status === "active" ? data.hold.expiresAt : null, skew);
  if (left === 0 && (phase === "ready" || phase === "failed")) setPhase("expired");

  const chooseAgainHref = `/book/${data?.hold.screeningId ?? context?.screening.id ?? ""}${data ? `?seats=${data.hold.seatIds.join(",")}` : ""}`;

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter the name for this booking.";
    const digits = form.phone.replace(/\D/g, "");
    if (!/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim()) || digits.length < 7) e.phone = "Enter a valid phone number, e.g. +231 77 123 4567.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email address or leave it blank.";
    setErrors(e);
    if (Object.keys(e).length) setTimeout(() => errorSummary.current?.focus(), 0);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (inFlight.current || !ref || !data) return; // double-click protection
    if (!validate()) return;
    inFlight.current = true;
    setFailure(null);
    setPhase("processing");
    const idempotencyKey = crypto.randomUUID();
    const started = Date.now();
    try {
      const res = await api<
        { kind: "booking"; reference: string; accessKey: string; status: string } | { kind: "payment_failed"; message: string; paymentReference: string }
      >("/api/checkout", {
        method: "POST",
        json: {
          holdId,
          holdKey: ref.holdKey,
          idempotencyKey,
          method,
          demoOutcome: method === "demo_online" ? outcome : undefined,
          customer: { name: form.name, phone: form.phone, email: form.email },
        },
      });
      // Keep the processing state visible briefly so it reads as a real gateway hand-off;
      // the booking itself is already committed at this point.
      const wait = MIN_PROCESSING_MS - (Date.now() - started);
      if (wait > 0 && !reduce) await new Promise((r) => setTimeout(r, wait));
      if (res.kind === "payment_failed") {
        setFailure(`${res.message} Reference ${res.paymentReference}. Your seats are still held — try again or choose Pay at Cinema.`);
        setPhase("failed");
        return;
      }
      holdStore.clear(ref);
      holdStore.markDone(holdId, { reference: res.reference, accessKey: res.accessKey });
      if (context) {
        ticketStore.add({ reference: res.reference, accessKey: res.accessKey, title: context.movie.title, startsAt: context.screening.startsAt, seats: data.hold.seatIds });
      }
      router.replace(`/booking/${res.reference}?k=${encodeURIComponent(res.accessKey)}&new=1`);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "HOLD_EXPIRED") setPhase("expired");
      else if (err.data?.fields) {
        const f = err.data.fields as Record<string, string>;
        setErrors({ name: f["customer.name"], phone: f["customer.phone"], email: f["customer.email"] });
        setPhase("ready");
      } else {
        setFailure(err.message);
        setPhase("failed");
      }
    } finally {
      inFlight.current = false;
    }
  };

  const cancel = async () => {
    if (!ref) return;
    setCancelling(true);
    try {
      await api(`/api/holds/${holdId}`, { method: "DELETE", headers: { "x-hold-key": ref.holdKey } });
    } catch {}
    holdStore.clear(ref);
    router.push(context ? `/movies/${context.movie.slug}#showtimes` : "/movies");
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]" aria-busy="true" aria-label="Loading checkout">
        <div className="skeleton h-[480px]" />
        <div className="skeleton h-[380px]" />
      </div>
    );
  }

  if (phase === "missing" || !context) {
    return (
      <StateCard
        icon={<AlertTriangle className="h-8 w-8 text-warning-400" />}
        title="This checkout isn't available"
        body="Seat holds belong to the browser tab where they were created. If you refreshed in a new tab or the hold was released, please choose your seats again."
        action={
          <Link href={context ? `/book/${context.screening.id}` : "/movies"} className="btn btn-primary">
            Choose seats
          </Link>
        }
      />
    );
  }

  if (phase === "expired") {
    return (
      <StateCard
        icon={<RotateCcw className="h-8 w-8 text-gold-300" />}
        title="Your seat hold expired"
        body={`To keep seats fair for everyone, held seats are released after the timer runs out. ${data?.hold.seatIds.join(", ")} may still be free.`}
        action={
          <Link href={chooseAgainHref} className="btn btn-primary">
            Choose seats again
          </Link>
        }
      />
    );
  }

  const q = data!.quote;
  const snacks = data!.extras;
  const total = data!.grandTotalCents;
  const { movie, screening, auditorium } = context;
  const customerChoice = context.demoPaymentMode === "customer_choice";

  const payLabel =
    phase === "processing"
      ? "Processing…"
      : method === "pay_at_cinema"
        ? "Reserve — pay at cinema"
        : phase === "failed"
          ? `Retry demo payment · ${formatUSD(total)}`
          : `Pay ${formatUSD(total)} (demo)`;

  return (
    <div className="pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-16">
      <div className="border-b border-white/[0.06] bg-ink-950/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/snacks/${holdId}`} className="btn btn-ghost btn-sm -ml-2">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Snacks
            </Link>
            <h1 className="font-display text-3xl">Checkout</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <HoldTimer msLeft={left} />
            <BookingSteps current={3} />
          </div>
        </div>
      </div>

      <form id="checkout-form" onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {Object.values(errors).some(Boolean) && (
            <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-xl border border-danger-400/40 bg-danger-700/40 p-4 text-sm text-danger-400">
              <p className="font-semibold">Please check your details:</p>
              <ul className="mt-1 list-inside list-disc">
                {Object.entries(errors)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <li key={k}>
                      <a href={`#f-${k}`} className="underline">
                        {v}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <fieldset className="surface p-5 sm:p-6">
            <legend className="sr-only">Your details</legend>
            <h2 className="font-display text-2xl" aria-hidden>
              Your details
            </h2>
            <p className="mt-1 text-sm text-fg-muted">Used to find your booking in My Tickets. We never show these details on the ticket QR code.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field id="name" label="Full name" error={errors.name} className="sm:col-span-2">
                <input id="f-name" className="field" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? "e-name" : undefined} required />
              </Field>
              <Field id="phone" label="Mobile number" hint="Liberian or international format" error={errors.phone}>
                <input id="f-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="+231 77 123 4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "e-phone" : "h-phone"} required />
              </Field>
              <Field id="email" label="Email (optional)" error={errors.email}>
                <input id="f-email" className="field" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} aria-describedby={errors.email ? "e-email" : undefined} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="surface p-5 sm:p-6">
            <legend className="sr-only">Payment method</legend>
            <h2 className="font-display text-2xl" aria-hidden>
              Payment
            </h2>
            <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Payment method">
              <MethodOption
                checked={method === "demo_online"}
                onSelect={() => setMethod("demo_online")}
                icon={<CreditCard className="h-5 w-5" />}
                title="Simulated online payment"
                badge={<DemoBadge />}
                body="Demonstrates an online payment. No card or mobile-money details are collected and no money moves."
              />
              <MethodOption
                checked={method === "pay_at_cinema"}
                onSelect={() => setMethod("pay_at_cinema")}
                icon={<Building2 className="h-5 w-5" />}
                title="Pay at Cinema"
                body="Reserve now and pay at the Monrovia Cinema Plus box office before the film (snacks included). Unpaid reservations are released when the screening starts."
              />
              <MethodOption disabled icon={<Smartphone className="h-5 w-5" />} title="Orange Money" badge={<span className="chip">Coming soon — not connected</span>} body="Not available in this prototype." />
              <MethodOption disabled icon={<Smartphone className="h-5 w-5" />} title="Lonestar MTN Mobile Money" badge={<span className="chip">Coming soon — not connected</span>} body="Not available in this prototype." />
            </div>

            <AnimatePresence initial={false}>
              {method === "demo_online" && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? undefined : { opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 rounded-2xl border border-warning-400/30 bg-warning-700/20 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-warning-400">
                      <DemoBadge /> Demo payment simulator
                    </p>
                    {customerChoice ? (
                      <>
                        <p className="mt-2 text-sm text-fg-muted">Choose how the simulated gateway responds:</p>
                        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Simulated payment outcome">
                          {(
                            [
                              ["succeeded", "Approve"],
                              ["pending", "Pending"],
                              ["failed", "Decline"],
                            ] as const
                          ).map(([v, l]) => (
                            <button
                              key={v}
                              type="button"
                              role="radio"
                              aria-checked={outcome === v}
                              onClick={() => setOutcome(v)}
                              className={clsx(
                                "min-h-11 rounded-xl border text-sm font-semibold transition-colors",
                                outcome === v ? "border-gold-400 bg-gold-400/15 text-gold-200" : "border-white/10 text-fg-muted hover:border-white/25",
                              )}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-fg-muted">The outcome is set by cinema management in Settings ({context.demoPaymentMode.replace(/_/g, " ")}).</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </fieldset>

          <AnimatePresence>
            {failure && (
              <motion.div
                role="alert"
                initial={reduce ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3 rounded-2xl border border-danger-400/40 bg-danger-700/40 p-4 text-sm"
              >
                <XCircle className="h-5 w-5 shrink-0 text-danger-400" aria-hidden />
                <div>
                  <p className="font-semibold text-danger-400">Payment not completed</p>
                  <p className="mt-1 text-fg-muted">{failure}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order summary */}
        <aside aria-label="Order summary" className="lg:row-span-2">
          <div className="surface sticky top-[calc(var(--header-h)+16px)] overflow-hidden">
            <div className="flex gap-4 border-b border-white/[0.06] p-5">
              <MoviePoster movie={movie} className="aspect-[2/3] w-20 shrink-0 rounded-lg" showTitle={false} />
              <div className="min-w-0">
                <p className="font-display text-2xl leading-tight">{movie.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                  <RatingBadge rating={movie.rating} /> {screening.format}
                </p>
                <p className="mt-2 text-sm text-fg-muted">{formatDateLong(screening.startsAt)}</p>
                <p className="text-sm text-fg">
                  {formatTime(screening.startsAt)} · {auditorium.name}
                </p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Seats</p>
              <p className="mt-2 font-display text-2xl text-gold-200">{q.items.map((i) => i.seatId).join(", ")}</p>
              <Link href={`/snacks/${holdId}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-gold-300 underline-offset-4 hover:underline">
                <Popcorn className="h-4 w-4" aria-hidden /> {snacks.lines.length ? "Edit snacks & drinks" : "Add snacks & drinks"}
              </Link>
              {snacks.error && (
                <p role="alert" className="mt-2 text-sm text-danger-400">
                  {snacks.error}
                </p>
              )}
              <dl className="mt-4 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
                {q.byCategory.map((c) => (
                  <div key={c.category} className="flex justify-between">
                    <dt className="text-fg-muted">
                      {c.count} × {CATEGORY_LABEL[c.category]} @ {formatUSD(c.unitCents)}
                    </dt>
                    <dd className="tabular-nums">{formatUSD(c.lineCents)}</dd>
                  </div>
                ))}
                {snacks.lines.map((l) => (
                  <div key={`${l.itemId}:${l.variantId}`} className="flex justify-between">
                    <dt className="text-fg-muted">{describeLine(l)}</dt>
                    <dd className="tabular-nums">{formatUSD(l.lineCents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between text-fg-subtle">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatUSD(q.subtotalCents + snacks.totalCents)}</dd>
                </div>
                <div className="flex justify-between text-fg-subtle">
                  <dt>Booking fee</dt>
                  <dd className="tabular-nums">{formatUSD(q.feesCents)}</dd>
                </div>
                <div className="flex items-end justify-between border-t border-white/[0.06] pt-3">
                  <dt className="text-xs uppercase tracking-[0.18em] text-fg-subtle">Total (USD)</dt>
                  <dd className="font-display text-4xl tabular-nums text-gold-200">{formatUSD(total)}</dd>
                </div>
              </dl>
              <button type="submit" className="btn btn-primary btn-lg mt-5 w-full" disabled={phase === "processing" || cancelling} aria-disabled={phase === "processing"}>
                {phase === "processing" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                {payLabel}
              </button>
              <button type="button" onClick={cancel} disabled={phase === "processing" || cancelling} className="btn btn-ghost mt-2 w-full">
                {cancelling ? "Releasing seats…" : "Cancel and release seats"}
              </button>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg-subtle">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Prices are confirmed by the cinema system at checkout. This is a demonstration: no real payment is taken.
              </p>
            </div>
          </div>
        </aside>
      </form>

      {/* Mobile: total and pay action always within reach */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-900/95 px-4 pt-3 backdrop-blur-xl lg:hidden" aria-label="Payment summary">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-xs text-fg-muted">
              <span className="tabular-nums">
                {q.items.length} {q.items.length === 1 ? "ticket" : "tickets"}
                {snacks.lines.length ? ` + snacks` : ""}
              </span>
              {left !== null && (
                <span className={left < 60_000 ? "text-danger-400" : "text-gold-300"}>
                  · held {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}
                </span>
              )}
            </p>
            <p className="font-display text-2xl tabular-nums text-gold-200">{formatUSD(total)}</p>
          </div>
          <button type="submit" form="checkout-form" className="btn btn-primary shrink-0" disabled={phase === "processing" || cancelling}>
            {phase === "processing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
            {phase === "processing" ? "Processing…" : method === "pay_at_cinema" ? "Reserve" : phase === "failed" ? "Retry" : "Pay (demo)"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {phase === "processing" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-6 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="assertive"
          >
            <div className="surface w-full max-w-sm p-8 text-center">
              <div className="relative mx-auto h-16 w-16">
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-gold-400/20 border-t-gold-300" />
                <Lock className="absolute inset-0 m-auto h-6 w-6 text-gold-300" aria-hidden />
              </div>
              <p className="font-display mt-5 text-2xl">{method === "pay_at_cinema" ? "Reserving your seats" : "Processing demo payment"}</p>
              <p className="mt-2 text-sm text-fg-muted">Please don&apos;t close this page.</p>
              {method === "demo_online" && (
                <p className="mt-4">
                  <DemoBadge>DEMO · NO REAL CHARGE</DemoBadge>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ id, label, hint, error, className, children }: { id: string; label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={`f-${id}`} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`e-${id}`} className="mt-1.5 text-sm text-danger-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`h-${id}`} className="mt-1.5 text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MethodOption({
  checked,
  onSelect,
  disabled,
  icon,
  title,
  badge,
  body,
}: {
  checked?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all",
        checked && "border-gold-400/70 bg-gold-400/[0.07] shadow-[0_0_0_1px_rgba(226,189,103,0.25)]",
        !checked && !disabled && "border-white/10 hover:border-white/25",
        disabled && "cursor-not-allowed border-dashed border-white/[0.08] opacity-55",
      )}
    >
      <span
        className={clsx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", checked ? "border-gold-300" : "border-white/30")}
        aria-hidden
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-gold-300" />}
      </span>
      <span className="flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          <span className="text-gold-400" aria-hidden>
            {icon}
          </span>
          {title} {badge}
        </span>
        <span className="mt-1 block text-sm text-fg-muted">{body}</span>
      </span>
    </button>
  );
}

function StateCard({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24">
      <div className="surface fade-up p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">{icon}</div>
        <h1 className="font-display mt-5 text-3xl">{title}</h1>
        <p className="mt-3 text-fg-muted">{body}</p>
        <div className="mt-8">{action}</div>
      </div>
    </div>
  );
}
