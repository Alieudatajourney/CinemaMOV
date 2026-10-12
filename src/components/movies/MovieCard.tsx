"use client";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { PublicMovie, PublicShowtime } from "@/server/core/catalog";
import { formatRuntime, formatTime } from "@/lib/format";
import { MoviePoster } from "../MoviePoster";
import { RatingBadge } from "../ui/badges";

export function MovieCard({
  movie,
  showtimes,
  dayLabel,
  comingSoonDate,
}: {
  movie: PublicMovie;
  showtimes?: PublicShowtime[];
  dayLabel?: string;
  comingSoonDate?: string;
}) {
  return (
    <article className="movie-card surface group relative flex flex-col overflow-hidden">
      <Link href={`/movies/${movie.slug}`} className="block rounded-t-[var(--radius-lg)] focus-visible:outline-offset-[-3px]" aria-label={`${movie.title} — details and showtimes`}>
        <MoviePoster movie={movie} className="aspect-[2/3] w-full" imgClassName="poster-zoom" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-[1.35rem] leading-tight text-fg">
            <Link href={`/movies/${movie.slug}`} className="hover:text-gold-200">
              {movie.title}
            </Link>
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-fg-muted">
            <RatingBadge rating={movie.rating} />
            <span>{movie.genres.join(" · ")}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatRuntime(movie.runtimeMin)}
            </span>
          </p>
        </div>
        {comingSoonDate ? (
          <p className="mt-auto text-sm text-gold-300">In cinemas {comingSoonDate}</p>
        ) : showtimes && showtimes.length > 0 ? (
          <div className="mt-auto">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-subtle">{dayLabel}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label={`${movie.title} showtimes ${dayLabel ?? ""}`}>
              {showtimes.map((s) => (
                <li key={s.id}>
                  {s.onSale && s.seatsLeft > 0 ? (
                    <Link
                      href={`/book/${s.id}`}
                      className="inline-flex min-h-9 items-center rounded-lg border border-white/12 bg-white/[0.03] px-2.5 text-sm font-semibold tabular-nums text-fg transition-colors hover:border-gold-400/70 hover:bg-gold-400/10 hover:text-gold-200"
                      aria-label={`Book ${formatTime(s.startsAt)} in ${s.auditoriumName}`}
                    >
                      {formatTime(s.startsAt)}
                      {s.format === "3D" && <span className="ml-1 text-[0.65rem] text-gold-300">3D</span>}
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-9 items-center rounded-lg border border-white/5 px-2.5 text-sm tabular-nums text-ink-500 line-through" title={s.seatsLeft === 0 ? "Sold out" : "Booking closed"}>
                      {formatTime(s.startsAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-auto text-sm text-fg-subtle">No screenings {dayLabel ? dayLabel.toLowerCase() : ""}</p>
        )}
      </div>
    </article>
  );
}
