"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertOctagon, Ban, CalendarClock, Camera, CameraOff, CheckCircle2, Clock3, Loader2, RotateCcw, ScanLine, ShieldAlert, Wallet, XCircle } from "lucide-react";
import type { ValidationOutcome } from "@/lib/types";
import { CATEGORY_LABEL, formatDateTime, formatTime, formatUSD } from "@/lib/format";
import { api, type ApiError } from "@/lib/client-store";
import { describeLine } from "@/lib/concessions";

interface Result {
  outcome: ValidationOutcome;
  admitted: boolean;
  message: string;
  booking: {
    reference: string;
    customerName: string;
    seats: { seatId: string; category: string }[];
    concessions: { name: string; variantLabel: string; qty: number }[];
    status: string;
    paymentStatus: string;
    totalCents: number;
    redeemedAt?: string;
    redeemedBy?: string;
    movieTitle: string;
    rating: string;
    startsAt: string;
    auditorium: string;
    format: string;
  } | null;
}

const LOOK: Record<ValidationOutcome, { title: string; tone: "ok" | "warn" | "bad"; icon: React.ReactNode }> = {
  admitted: { title: "Valid — admit", tone: "ok", icon: <CheckCircle2 className="h-10 w-10" /> },
  already_redeemed: { title: "Already redeemed", tone: "bad", icon: <ShieldAlert className="h-10 w-10" /> },
  cancelled: { title: "Cancelled booking", tone: "bad", icon: <Ban className="h-10 w-10" /> },
  unpaid: { title: "Unpaid reservation", tone: "warn", icon: <Wallet className="h-10 w-10" /> },
  pending_payment: { title: "Payment pending", tone: "warn", icon: <Clock3 className="h-10 w-10" /> },
  expired: { title: "Expired booking", tone: "bad", icon: <XCircle className="h-10 w-10" /> },
  screening_ended: { title: "Screening ended", tone: "bad", icon: <XCircle className="h-10 w-10" /> },
  not_today: { title: "Different day", tone: "warn", icon: <CalendarClock className="h-10 w-10" /> },
  invalid: { title: "Invalid ticket", tone: "bad", icon: <AlertOctagon className="h-10 w-10" /> },
};

type ValidateOpts = { collectPayment?: boolean; allowOtherDay?: boolean; admit?: boolean };

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
  }
}

export function TicketValidator() {
  const reduce = useReducedMotion();
  const [code, setCode] = useState("");
  const [checkOnly, setCheckOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lastCode, setLastCode] = useState("");
  /** Options used for the last check, so follow-up actions (admit, collect, override) keep them. */
  const [lastOpts, setLastOpts] = useState<ValidateOpts>({});
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ at: string; ref: string; outcome: ValidationOutcome }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const validate = useCallback(
    async (value: string, opts: ValidateOpts = {}) => {
      const v = value.trim();
      if (!v || busy) return;
      setBusy(true);
      setError(null);
      try {
        const r = await api<Result>("/api/staff/validate", {
          method: "POST",
          json: { code: v, admit: opts.admit ?? !checkOnly, collectPayment: !!opts.collectPayment, allowOtherDay: !!opts.allowOtherDay },
        });
        setResult(r);
        setLastCode(v);
        setLastOpts(opts);
        setHistory((h) => [{ at: new Date().toISOString(), ref: r.booking?.reference ?? "Unknown code", outcome: r.outcome }, ...h].slice(0, 8));
        setTimeout(() => resultRef.current?.focus(), 30);
      } catch (e) {
        const err = e as ApiError;
        setError(err.status === 401 || err.status === 403 ? "Your session has expired. Please sign in again." : err.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, checkOnly],
  );

  const next = () => {
    setResult(null);
    setCode("");
    setLastCode("");
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const look = result ? LOOK[result.outcome] : null;
  const checkedOnly = result?.outcome === "admitted" && !result.admitted;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <CameraScanner onCode={(c) => !busy && !result && validate(c)} paused={!!result || busy} />

        <form
          className="surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            validate(code);
          }}
        >
          <label htmlFor="code" className="label">
            Manual entry — booking reference or ticket code
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="code"
              className="field font-mono"
              placeholder="MCP-XXXX-XXXX or scanned code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !code.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanLine className="h-4 w-4" aria-hidden />}
              {checkOnly ? "Check" : "Validate"}
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" checked={checkOnly} onChange={(e) => setCheckOnly(e.target.checked)} className="h-4 w-4 accent-[var(--gold-400)]" />
            Check only — don&apos;t mark as admitted
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-400">
              {error}
            </p>
          )}
        </form>

        {history.length > 0 && (
          <section className="surface p-5" aria-labelledby="hist">
            <h2 id="hist" className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              This session
            </h2>
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-mono">{h.ref}</span>
                  <span className={clsx("text-xs font-semibold", LOOK[h.outcome].tone === "ok" ? "text-success-400" : LOOK[h.outcome].tone === "warn" ? "text-warning-400" : "text-danger-400")}>
                    {LOOK[h.outcome].title}
                  </span>
                  <span className="text-xs text-fg-subtle tabular-nums">{formatTime(h.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {result && look ? (
            <motion.div
              key={`${result.booking?.reference}-${result.outcome}-${history.length}`}
              ref={resultRef}
              tabIndex={-1}
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={clsx(
                "overflow-hidden rounded-[var(--radius-xl)] border",
                look.tone === "ok" && !checkedOnly && "border-success-400/50 bg-success-700/40",
                (look.tone === "warn" || checkedOnly) && "border-warning-400/50 bg-warning-700/30",
                look.tone === "bad" && "border-danger-400/50 bg-danger-700/40",
              )}
              data-outcome={result.outcome}
            >
              <div className={clsx("flex items-center gap-4 p-6", look.tone === "ok" ? "text-success-400" : look.tone === "warn" ? "text-warning-400" : "text-danger-400")}>
                <span aria-hidden>{look.icon}</span>
                <div>
                  <p className="font-display text-4xl text-fg">{checkedOnly ? "Valid ticket" : look.title}</p>
                  <p className="mt-1 text-sm">{result.message}</p>
                </div>
              </div>
              {result.booking && (
                <div className="border-t border-white/10 bg-ink-950/50 p-6">
                  <p className="font-display text-2xl">{result.booking.movieTitle}</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {formatDateTime(result.booking.startsAt)} · {result.booking.auditorium} · {result.booking.format}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                    {result.booking.seats.length} admission{result.booking.seats.length > 1 ? "s" : ""}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {result.booking.seats.map((s) => (
                      <li key={s.seatId} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-lg font-bold">
                        {s.seatId} <span className="text-xs font-normal text-fg-muted">{CATEGORY_LABEL[s.category]}</span>
                      </li>
                    ))}
                  </ul>
                  {result.booking.concessions.length > 0 && (
                    <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">Pre-ordered snacks</p>
                      <ul className="mt-1 text-sm">
                        {result.booking.concessions.map((c, i) => (
                          <li key={i}>{describeLine(c)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-fg-subtle">Reference</dt>
                      <dd className="font-mono">{result.booking.reference}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Name</dt>
                      <dd>{result.booking.customerName}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-subtle">Payment</dt>
                      <dd className="capitalize">
                        {result.booking.paymentStatus} · {formatUSD(result.booking.totalCents)}
                      </dd>
                    </div>
                    {result.booking.redeemedAt && (
                      <div>
                        <dt className="text-fg-subtle">Admitted</dt>
                        <dd>
                          {formatDateTime(result.booking.redeemedAt)}
                          {result.booking.redeemedBy && <span className="block text-xs text-fg-subtle">{result.booking.redeemedBy}</span>}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
                {result.outcome === "not_today" && (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => validate(lastCode, { ...lastOpts, allowOtherDay: true })}>
                    <CalendarClock className="h-4 w-4" aria-hidden /> {checkOnly ? "Check anyway" : "Admit anyway (manager override)"}
                  </button>
                )}
                {result.outcome === "unpaid" && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => validate(lastCode, { ...lastOpts, collectPayment: true, admit: true })}>
                    <Wallet className="h-4 w-4" aria-hidden /> Collect {formatUSD(result.booking?.totalCents ?? 0)} & admit
                  </button>
                )}
                {checkedOnly && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => validate(lastCode, { ...lastOpts, admit: true })}
                  >
                    Admit now
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={next} autoFocus>
                  <RotateCcw className="h-4 w-4" aria-hidden /> Scan next
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-white/10 p-8 text-center">
              <ScanLine className="h-12 w-12 text-gold-400" aria-hidden />
              <p className="font-display mt-4 text-3xl">Ready to scan</p>
              <p className="mt-2 max-w-sm text-sm text-fg-muted">Scan a ticket QR code with the camera, or type the booking reference. Every ticket is checked against the booking records.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Camera QR scanning: native BarcodeDetector when available, otherwise jsQR on canvas frames. */
function CameraScanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  // The scan loop is created once; read the latest callback through a ref so toggles like
  // "Check only" apply to camera scans immediately.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setStatus(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera scanning isn't supported in this browser. Use manual entry below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setOn(true);
      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const loop = async () => {
        if (!streamRef.current) return;
        if (!pausedRef.current && video.readyState >= 2) {
          let value: string | null = null;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              value = codes[0]?.rawValue ?? null;
            } else if (jsQR) {
              const w = (canvas.width = Math.min(640, video.videoWidth));
              const h = (canvas.height = Math.round((video.videoHeight / video.videoWidth) * w));
              ctx.drawImage(video, 0, 0, w, h);
              value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          } catch {}
          const now = Date.now();
          if (value && !(value === lastRef.current.code && now - lastRef.current.at < 4000)) {
            lastRef.current = { code: value, at: now };
            onCodeRef.current(value);
          }
        }
        setTimeout(() => requestAnimationFrame(loop), 120);
      };
      loop();
    } catch {
      setStatus("Camera permission was denied or no camera is available. Use manual entry below.");
      stop();
    }
  };

  return (
    <section className="surface overflow-hidden" aria-label="Camera scanner">
      <div className="relative aspect-[4/3] bg-ink-950">
        <video ref={videoRef} className={clsx("h-full w-full object-cover", !on && "hidden")} muted playsInline aria-label="Camera preview" />
        {on && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="h-3/5 w-3/5 max-w-[260px] rounded-3xl border-2 border-gold-300/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {!on && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="h-10 w-10 text-fg-subtle" aria-hidden />
            <p className="text-sm text-fg-muted">Point the camera at the QR code on the customer&apos;s ticket.</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        {on ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>
            <CameraOff className="h-4 w-4" aria-hidden /> Stop camera
          </button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={start}>
            <Camera className="h-4 w-4" aria-hidden /> Start camera
          </button>
        )}
        <p className="text-xs text-fg-subtle">{on ? (paused ? "Paused — tap Scan next" : "Scanning…") : "Camera optional"}</p>
      </div>
      {status && (
        <p role="status" className="border-t border-white/[0.06] px-4 py-3 text-sm text-warning-400">
          {status}
        </p>
      )}
    </section>
  );
}
