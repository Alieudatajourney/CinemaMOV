import type { Metadata } from "next";
import { readDb } from "@/server/store";
import { SnackStep } from "@/components/snacks/SnackStep";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Snacks & drinks", robots: { index: false } };

export default async function SnacksPage({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const { menu, context } = await readDb((db) => {
    const hold = db.holds.find((h) => h.id === holdId);
    const screening = hold && db.screenings.find((s) => s.id === hold.screeningId);
    const movie = screening && db.movies.find((m) => m.id === screening.movieId);
    const aud = screening && db.auditoriums.find((a) => a.id === screening.auditoriumId);
    return {
      menu: db.concessions,
      context:
        screening && movie && aud
          ? {
              movie: { title: movie.title, slug: movie.slug },
              screening: { id: screening.id, startsAt: screening.startsAt, format: screening.format },
              auditorium: { name: aud.name },
            }
          : null,
    };
  });
  return <SnackStep holdId={holdId} menu={menu} context={context} />;
}
