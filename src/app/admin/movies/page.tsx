import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { AdminHeader } from "@/components/admin/ui";
import { MovieList } from "@/components/admin/MovieList";

export const metadata: Metadata = { title: "Movies" };

export default async function AdminMovies() {
  await requirePageRole(["admin"], "/admin/movies");
  const movies = await readDb((db, now) =>
    db.movies.map((m) => ({
      ...m,
      upcoming: db.screenings.filter((s) => s.movieId === m.id && s.status === "scheduled" && Date.parse(s.startsAt) > now.getTime()).length,
    })),
  );
  return (
    <>
      <AdminHeader
        eyebrow="Catalogue"
        title="Movies"
        description="Film details and artwork come from TMDB; showtimes and prices are sample data. Unpublished movies are hidden from customers and cannot be booked."
        actions={
          <Link href="/admin/movies/new" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" aria-hidden /> Add movie
          </Link>
        }
      />
      <MovieList movies={movies} />
    </>
  );
}
