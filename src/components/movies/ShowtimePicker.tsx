"use client";
import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Armchair, Crown } from "lucide-react";
import type { PublicShowtime } from "@/server/core/catalog";
import { dayParts, formatDayKey, formatTime, formatUSD, relativeDayLabel } from "@/lib/format";

export function ShowtimePicker({
  showtimes,
  days,
  todayKey,
  movieTitle,
}: {
  showtimes: PublicShowtime[];
  days: string[];
  todayKey: string;
  movieTitle: string;
}) {
  const reduce = useReducedMotion();
  const bookableDays = days.filter((d) => showtimes.some((s) => s.day === d && s.onSale && s.seatsLeft > 0));
  const [day, setDay] = useState(bookableDays[0] ?? days[0]);
  const forDay = showtimes.filter((s) => s.day === day);
  const halls = [...new Set(forDay.map((s) => s.auditoriumName))];

  return (
    <div>
      <div role="group" aria-label="Screening dates" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scroll-fade-x sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {days.map((d) => {
          const p = dayParts(d);
          const rel = relativeDayLabel(d, todayKey);
          const has = showtimes.some((s) => s.day === d);
          const bookable = bookableDays.includes(d);
          const active = d === day;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              disabled={!has}
              onClick={() => setDay(d)}
              aria-label={`${formatDayKey(d, "long")}${!has ? " — no screenings" : !bookable ? " — no seats available" : ""}`}
              className={clsx(
                "flex min-w-[4.8rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition-all duration-200",
                active && "border-gold-400/70 bg-gradient-to-b from-gold-400/20 to-gold-400/5 text-fg",
                !active && has && "border-white/10 bg-white/[0.02] text-fg-muted hover:border-white/25 hover:text-fg",
                !has && "cursor-not-allowed border-dashed border-white/[0.07] text-ink-500",
              )}
            >
              <span className={clsx("text-[0.66rem] font-semibold uppercase tracking-[0.16em]", active && "text-gold-300")}>{rel ?? p.weekday}</span>
              <span className="font-display text-2xl leading-tight">{p.day}</span>
              <span className="text-[0.7rem]">{has ? p.month : "No shows"}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-6 space-y-8"
        >
          <h3 className="font-display text-2xl">{formatDayKey(day, "long")}</h3>
          {halls.length === 0 && <p className="text-fg-muted">No screenings of {movieTitle} on this date.</p>}
          {halls.map((hall) => (
            <section key={hall} aria-label={hall}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">{hall}</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {forDay
                  .filter((s) => s.auditoriumName === hall)
                  .map((s) => {
                    const ok = s.onSale && s.seatsLeft > 0;
                    const low = ok && s.seatsLeft <= s.capacity * 0.15;
                    const body = (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-3xl tabular-nums leading-none">{formatTime(s.startsAt)}</p>
                            <p className="mt-2 text-xs text-fg-muted">
                              {s.auditoriumShort} · {s.format}
                            </p>
                          </div>
                          <span
                            className={clsx(
                              "chip",
                              !ok && "text-fg-subtle",
                              low && "border-warning-400/40 text-warning-400",
                              ok && !low && "border-success-400/30 text-success-400",
                            )}
                          >
                            {!s.onSale ? "Booking closed" : s.seatsLeft === 0 ? "Sold out" : low ? `Only ${s.seatsLeft} left` : `${s.seatsLeft} seats`}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                          <span className="flex flex-wrap gap-x-3 gap-y-1 text-fg-muted">
                            <span className="inline-flex items-center gap-1">
                              <Armchair className="h-3.5 w-3.5" aria-hidden /> {formatUSD(s.prices.standard)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-velvet-300">
                              <Crown className="h-3.5 w-3.5" aria-hidden /> VIP {formatUSD(s.prices.vip)}
                            </span>
                          </span>
                          {ok && (
                            <span className="inline-flex items-center gap-1 font-semibold text-gold-300 transition-transform group-hover:translate-x-0.5">
                              Seats <ArrowRight className="h-4 w-4" aria-hidden />
                            </span>
                          )}
                        </div>
                      </>
                    );
                    return (
                      <li key={s.id}>
                        {ok ? (
                          <Link
                            href={`/book/${s.id}`}
                            className="group surface block p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-lift"
                            aria-label={`${formatTime(s.startsAt)}, ${s.auditoriumName}, ${s.format}. ${s.seatsLeft} seats available. Choose seats`}
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className="surface block p-4 opacity-55" aria-disabled="true">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
