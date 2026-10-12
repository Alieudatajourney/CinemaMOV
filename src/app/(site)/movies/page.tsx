import type { Metadata } from "next";
import { getCatalog } from "@/server/queries";
import { formatDayKey } from "@/lib/format";
import { MovieBrowser } from "@/components/movies/MovieBrowser";
import { MovieCard } from "@/components/movies/MovieCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Movies & Showtimes" };

export default async function MoviesPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const { movies, showtimes, days, todayKey } = await getCatalog();
  const comingSoon = movies.filter((m) => m.status === "coming_soon");

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <header className="mb-8">
        <p className="eyebrow">Monrovia Super Mall</p>
        <h1 className="font-display mt-2 text-5xl sm:text-6xl">Movies & Showtimes</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">Choose a date, pick a film and tap a showtime to choose your seats. All times are Monrovia time.</p>
      </header>
      <section id="showtimes" aria-label="Now showing">
        <MovieBrowser movies={movies} showtimes={showtimes} days={days} todayKey={todayKey} initialDay={day} />
      </section>
      {comingSoon.length > 0 && (
        <section id="coming-soon" aria-labelledby="cs" className="mt-20">
          <h2 id="cs" className="font-display text-4xl">
            Coming Soon
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {comingSoon.map((m) => (
              <li key={m.id} className="flex">
                <MovieCard movie={m} comingSoonDate={formatDayKey(m.releaseDate)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
