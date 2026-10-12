import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCatalog } from "@/server/queries";
import { formatDayKey } from "@/lib/format";
import { Hero } from "@/components/home/Hero";
import { VisitSection } from "@/components/home/VisitSection";
import { MovieBrowser } from "@/components/movies/MovieBrowser";
import { MovieCard } from "@/components/movies/MovieCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { movies, showtimes, days, todayKey, settings } = await getCatalog();
  const nowShowing = movies.filter((m) => m.status === "now_showing");
  const comingSoon = movies.filter((m) => m.status === "coming_soon");
  const featured = [...nowShowing].sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).slice(0, 4);

  return (
    <>
      <Hero movies={featured} />

      <section id="showtimes" aria-labelledby="now-showing" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Showtimes</p>
            <h2 id="now-showing" className="font-display mt-2 text-4xl sm:text-5xl">
              Now Showing
            </h2>
          </div>
          <Link href="/movies" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            All movies <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <MovieBrowser movies={movies} showtimes={showtimes} days={days} todayKey={todayKey} />
      </section>

      {comingSoon.length > 0 && (
        <section id="coming-soon" aria-labelledby="coming-soon-title" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
          <p className="eyebrow">On the horizon</p>
          <h2 id="coming-soon-title" className="font-display mt-2 text-4xl sm:text-5xl">
            Coming Soon
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {comingSoon.map((m) => (
              <li key={m.id} className="flex">
                <MovieCard movie={m} comingSoonDate={formatDayKey(m.releaseDate)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <VisitSection settings={settings} />
    </>
  );
}
