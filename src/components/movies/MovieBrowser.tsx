"use client";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { PublicMovie, PublicShowtime } from "@/server/core/catalog";
import { dayParts, formatDayKey, relativeDayLabel, timeKey } from "@/lib/format";
import { MovieCard } from "./MovieCard";

const RATINGS = ["G", "PG", "PG-13", "15", "18"];

export function MovieBrowser({
  movies,
  showtimes,
  days,
  todayKey,
  initialDay,
}: {
  movies: PublicMovie[];
  showtimes: PublicShowtime[];
  days: string[];
  todayKey: string;
  initialDay?: string;
}) {
  const reduce = useReducedMotion();
  const nowShowing = movies.filter((m) => m.status === "now_showing");
  const genres = useMemo(() => [...new Set(nowShowing.flatMap((m) => m.genres))].sort(), [nowShowing]);
  // Default to the first day that still has something bookable (late at night "today" may be over).
  const firstBookable = days.find((d) => showtimes.some((s) => s.day === d && s.onSale && s.seatsLeft > 0));
  const [day, setDay] = useState(initialDay && days.includes(initialDay) ? initialDay : (firstBookable ?? days[0] ?? todayKey));
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [time, setTime] = useState<"any" | "matinee" | "evening">("any");

  const filtered = nowShowing.filter((m) => {
    const q = query.trim().toLowerCase();
    if (q && !`${m.title} ${m.genres.join(" ")} ${m.cast.join(" ")} ${m.director}`.toLowerCase().includes(q)) return false;
    if (genre && !m.genres.includes(genre)) return false;
    if (rating && m.rating !== rating) return false;
    return true;
  });

  const slotsFor = (movieId: string) =>
    showtimes.filter((s) => {
      if (s.movieId !== movieId || s.day !== day) return false;
      const hour = Number(timeKey(s.startsAt).slice(0, 2));
      if (time === "matinee") return hour < 17;
      if (time === "evening") return hour >= 17;
      return true;
    });

  // Films playing on the chosen day come first.
  const ordered = [...filtered].sort((a, b) => Number(slotsFor(b.id).length > 0) - Number(slotsFor(a.id).length > 0));
  const activeFilters = !!(query || genre || rating || time !== "any");
  const dayLabel = relativeDayLabel(day, todayKey) ?? formatDayKey(day);

  return (
    <div>
      {/* Date shortcuts */}
      <div role="group" aria-label="Choose a date" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scroll-fade-x sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {days.map((d) => {
          const p = dayParts(d);
          const rel = relativeDayLabel(d, todayKey);
          const active = d === day;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setDay(d)}
              className={clsx(
                "flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition-all duration-200",
                active
                  ? "border-gold-400/70 bg-gradient-to-b from-gold-400/20 to-gold-400/5 text-fg shadow-[0_0_0_1px_rgba(226,189,103,0.25)]"
                  : "border-white/10 bg-white/[0.02] text-fg-muted hover:border-white/25 hover:text-fg",
              )}
            >
              <span className={clsx("text-[0.66rem] font-semibold uppercase tracking-[0.16em]", active ? "text-gold-300" : "")}>{rel ?? p.weekday}</span>
              <span className="font-display text-2xl leading-tight">{p.day}</span>
              <span className="text-[0.7rem]">{p.month}</span>
            </button>
          );
        })}
      </div>

      {/* Search & filters */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1 lg:max-w-sm">
          <span className="sr-only">Search movies</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, genre or cast"
            className="field pl-10"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <SlidersHorizontal className="hidden h-4 w-4 text-fg-subtle lg:block" aria-hidden />
          <FilterSelect label="Genre" value={genre} options={genres} onChange={setGenre} />
          <FilterSelect label="Rating" value={rating} options={RATINGS} onChange={setRating} />
          <div className="flex rounded-full border border-white/10 p-0.5" role="group" aria-label="Time of day">
            {(["any", "matinee", "evening"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={time === t}
                onClick={() => setTime(t)}
                className={clsx("min-h-9 rounded-full px-3 text-sm capitalize transition-colors", time === t ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg")}
              >
                {t === "any" ? "All day" : t === "matinee" ? "Before 5pm" : "Evening"}
              </button>
            ))}
          </div>
          {activeFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQuery("");
                setGenre(null);
                setRating(null);
                setTime("any");
              }}
            >
              <X className="h-4 w-4" aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {ordered.length} {ordered.length === 1 ? "film" : "films"} showing {dayLabel}
      </p>

      {ordered.length === 0 ? (
        <div className="surface mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="font-display text-2xl">No films match those filters</p>
          <p className="text-sm text-fg-muted">Try another genre, rating or date.</p>
        </div>
      ) : (
        <motion.ul layout={!reduce} className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {ordered.map((m) => (
              <motion.li
                key={m.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex"
              >
                <MovieCard movie={m} showtimes={slotsFor(m.id)} dayLabel={dayLabel} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        className="field min-h-10 w-auto rounded-full py-1.5 pl-4 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{`Any ${label.toLowerCase()}`}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
