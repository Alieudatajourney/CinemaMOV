import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Globe, Play, Clapperboard, Users } from "lucide-react";
import { readDb } from "@/server/store";
import { publicMovie, scheduleDays, showtimes } from "@/server/core/catalog";
import { dateKey, formatDayKey, formatRuntime, formatUSD } from "@/lib/format";
import { MoviePoster } from "@/components/MoviePoster";
import { RatingBadge } from "@/components/ui/badges";
import { ShowtimePicker } from "@/components/movies/ShowtimePicker";
import { TrailerButton } from "@/components/movies/TrailerButton";

export const dynamic = "force-dynamic";

const RATING_TEXT: Record<string, string> = {
  G: "General audiences — all ages admitted.",
  PG: "Parental guidance suggested.",
  "PG-13": "Parents strongly cautioned; some material may be unsuitable for under-13s.",
  R: "Restricted — under-17s must be accompanied by a parent or adult guardian.",
  NR: "Not yet rated.",
  "15": "Suitable for ages 15 and over.",
  "18": "Adults only.",
};

async function load(slug: string) {
  return readDb((db, now) => {
    const m = db.movies.find((x) => x.slug === slug && x.published);
    if (!m) return null;
    const allDays = scheduleDays(db, now);
    const halls = db.auditoriums.map((a) => ({ id: a.id, name: a.name, description: a.description }));
    return { movie: publicMovie(m), showtimes: showtimes(db, now, { movieId: m.id }), days: allDays, todayKey: dateKey(now), halls };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  return data ? { title: data.movie.title, description: data.movie.synopsis } : { title: "Movie not found" };
}

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { movie, showtimes: shows, days, todayKey, halls } = data;
  const days5 = days.length ? days : [todayKey];
  const priceRows = halls
    .map((h) => {
      const s = shows.filter((x) => x.auditoriumId === h.id);
      if (!s.length) return null;
      const min = (k: "standard" | "vip") => Math.min(...s.map((x) => x.prices[k]));
      const max = (k: "standard" | "vip") => Math.max(...s.map((x) => x.prices[k]));
      const range = (k: "standard" | "vip") => (min(k) === max(k) ? formatUSD(min(k)) : `${formatUSD(min(k))} – ${formatUSD(max(k))}`);
      return { ...h, standard: range("standard"), vip: range("vip") };
    })
    .filter(Boolean) as { id: string; name: string; description: string; standard: string; vip: string }[];

  return (
    <article>
      <div className="relative isolate -mt-[var(--header-h)] overflow-hidden pt-[var(--header-h)]">
        <div className="absolute inset-0 -z-10 opacity-70">
          <MoviePoster movie={movie} variant="backdrop" showTitle={false} className="h-full w-full" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/80 to-ink-950/40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/90 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:pb-16">
          <Link href="/movies" className="btn btn-ghost btn-sm -ml-3">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All movies
          </Link>
          <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] lg:gap-12">
            <MoviePoster movie={movie} className="mx-auto aspect-[2/3] w-56 rounded-[var(--radius-lg)] shadow-lift md:w-full" priority />
            <div className="fade-up">
              <p className="eyebrow">{movie.status === "now_showing" ? "Now showing" : `Coming ${formatDayKey(movie.releaseDate)}`}</p>
              <h1 className="font-display mt-3 text-5xl leading-[1] sm:text-6xl lg:text-7xl">{movie.title}</h1>
              {movie.tagline && <p className="font-display mt-4 text-xl italic text-gold-200/90">{movie.tagline}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <RatingBadge rating={movie.rating} />
                {movie.genres.map((g) => (
                  <span key={g} className="chip">
                    {g}
                  </span>
                ))}
              </div>
              <p className="mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-fg-muted">{movie.synopsis}</p>
              <dl className="mt-7 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
                <Fact icon={<Clock className="h-4 w-4" />} label="Runtime" value={formatRuntime(movie.runtimeMin)} />
                <Fact icon={<Globe className="h-4 w-4" />} label="Language" value={movie.language} />
                <Fact icon={<CalendarDays className="h-4 w-4" />} label="Release" value={formatDayKey(movie.releaseDate)} />
                <Fact icon={<Clapperboard className="h-4 w-4" />} label="Director" value={movie.director || "—"} />
              </dl>
              {movie.cast.length > 0 && (
                <p className="mt-5 flex max-w-2xl items-start gap-2 text-sm text-fg-muted">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                  <span>
                    <span className="sr-only">Cast: </span>
                    {movie.cast.join(", ")}
                  </span>
                </p>
              )}
              <p className="mt-3 text-xs text-fg-subtle">
                Rated {movie.rating}: {RATING_TEXT[movie.rating]} Showtimes and prices are sample data for this demonstration.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {movie.status === "now_showing" && (
                  <a href="#showtimes" className="btn btn-primary btn-lg">
                    Choose a showtime
                  </a>
                )}
                <TrailerButton title={movie.title} trailerUrl={movie.trailerUrl} className="btn btn-secondary btn-lg">
                  <Play className="h-4 w-4" aria-hidden /> Watch trailer
                </TrailerButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {movie.status === "now_showing" ? (
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <section id="showtimes" aria-labelledby="st-title" className="min-w-0">
              <h2 id="st-title" className="font-display text-4xl">
                Showtimes
              </h2>
              <p className="mb-5 mt-1 text-sm text-fg-muted">All times are Monrovia time (GMT).</p>
              {shows.length ? (
                <ShowtimePicker showtimes={shows} days={days5} todayKey={todayKey} movieTitle={movie.title} />
              ) : (
                <p className="surface p-6 text-fg-muted">No upcoming screenings are scheduled. Please check back soon.</p>
              )}
            </section>
            <aside aria-labelledby="info-title" className="lg:pt-16">
              <div className="surface p-5">
                <h2 id="info-title" className="font-display text-2xl">
                  Ticket prices
                </h2>
                <div className="mt-4 space-y-4">
                  {priceRows.map((r) => (
                    <div key={r.id} className="border-t border-white/[0.06] pt-4 first:border-0 first:pt-0">
                      <p className="font-semibold">{r.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{r.description}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <dt className="text-fg-muted">Standard</dt>
                        <dd className="text-right tabular-nums">{r.standard}</dd>
                        <dt className="text-velvet-300">VIP Recliner</dt>
                        <dd className="text-right tabular-nums">{r.vip}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-relaxed text-fg-subtle">
                  Accessible spaces are priced as Standard. Matinee prices apply before 5pm. Sample prices for demonstration only.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <section className="surface p-8 text-center">
            <p className="font-display text-3xl">In cinemas {formatDayKey(movie.releaseDate, "long")}</p>
            <p className="mt-2 text-fg-muted">Tickets go on sale once screenings are scheduled.</p>
          </section>
        )}
      </div>
    </article>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
        <span className="text-gold-400" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-fg">{value}</dd>
    </div>
  );
}
