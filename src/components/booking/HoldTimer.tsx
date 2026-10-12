"use client";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Timer } from "lucide-react";

/** Countdown to `expiresAt`, corrected for client/server clock skew. */
export function useCountdown(expiresAt: string | null, skewMs: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Date.parse(expiresAt) - (Date.now() + skewMs)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, skewMs]);
  return left;
}

export function HoldTimer({ msLeft, label = "Seats held for" }: { msLeft: number | null; label?: string }) {
  if (msLeft === null) return null;
  const m = Math.floor(msLeft / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  const urgent = msLeft < 60_000;
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm tabular-nums",
        urgent ? "border-danger-400/40 bg-danger-700/40 text-danger-400" : "border-gold-400/30 bg-gold-400/10 text-gold-200",
      )}
      role="timer"
      aria-live="off"
    >
      <Timer className="h-4 w-4" aria-hidden />
      {label} <strong>{m}:{s.toString().padStart(2, "0")}</strong>
      {/* Announce only at milestones, not every second. */}
      <span className="sr-only" aria-live="polite">
        {msLeft <= 0 ? "Your seat hold has expired." : msLeft <= 60_000 ? "Less than 1 minute left to complete your booking." : msLeft <= 120_000 ? "2 minutes left to complete your booking." : ""}
      </span>
    </p>
  );
}
