"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock, Play, Ticket } from "lucide-react";
import type { PublicMovie } from "@/server/core/catalog";
import { formatRuntime } from "@/lib/format";
import { MoviePoster } from "../MoviePoster";
import { RatingBadge } from "../ui/badges";
import { TrailerButton } from "../movies/TrailerButton";

export function Hero({ movies }: { movies: PublicMovie[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const movie = movies[index];

  const go = useCallback((i: number) => setIndex((i + movies.length) % movies.length), [movies.length]);

  useEffect(() => {
    if (reduce || paused || movies.length < 2) return;
    const t = setTimeout(() => go(index + 1), 8000);
    return () => clearTimeout(t);
  }, [index, paused, reduce, go, movies.length]);

  if (!movie) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured films"
      className="relative isolate -mt-[var(--header-h)] min-h-[620px] overflow-hidden sm:min-h-[680px] lg:min-h-[760px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={movie.id}
          className="absolute inset-0 -z-10"
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <MoviePoster movie={movie} variant="backdrop" showTitle={false} className="h-full w-full" priority />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/75 to-ink-950/10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/60" />
      <div className="grain absolute inset-0 -z-10" />

      <div className="mx-auto flex h-full min-h-[inherit] max-w-7xl flex-col justify-end px-4 pb-16 pt-[calc(var(--header-h)+3rem)] sm:px-6 lg:pb-24">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={movie.id}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
            aria-live={paused ? "polite" : "off"}
          >
            <p className="eyebrow">{movie.status === "now_showing" ? "Now showing" : "Coming soon"} · Monrovia Super Mall</p>
            <h1 className="font-display mt-4 text-[2.9rem] leading-[0.98] text-fg sm:text-6xl lg:text-[5.2rem]">{movie.title}</h1>
            <p className="mt-4 text-lg italic text-gold-200/90 font-display sm:text-xl">{movie.tagline}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
              <RatingBadge rating={movie.rating} />
              <span>{movie.genres.join(" · ")}</span>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden />
                {formatRuntime(movie.runtimeMin)}
              </span>
              <span aria-hidden>•</span>
              <span>{movie.language}</span>
            </div>
            <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-fg-muted line-clamp-3 sm:line-clamp-none">{movie.synopsis}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/movies/${movie.slug}#showtimes`} className="btn btn-primary btn-lg">
                <Ticket className="h-5 w-5" aria-hidden />
                Book tickets
              </Link>
              <TrailerButton title={movie.title} trailerUrl={movie.trailerUrl} className="btn btn-secondary btn-lg">
                <Play className="h-4 w-4" aria-hidden /> Watch trailer
              </TrailerButton>
            </div>
          </motion.div>
        </AnimatePresence>

        {movies.length > 1 && (
          <div className="mt-12 flex items-center gap-3" role="group" aria-label="Choose featured film">
            {movies.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${m.title}`}
                aria-current={i === index ? "true" : undefined}
                className="group flex h-8 items-center"
              >
                <span
                  className={clsx(
                    "block h-1 rounded-full transition-all duration-500",
                    i === index ? "w-12 bg-gold-400" : "w-6 bg-white/25 group-hover:bg-white/50",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
