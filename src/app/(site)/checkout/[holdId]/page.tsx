import type { Metadata } from "next";
import { readDb } from "@/server/store";
import { Checkout } from "@/components/booking/Checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  // Non-sensitive display context only. Hold details and prices are fetched with the secret hold key.
  const context = await readDb((db) => {
    const hold = db.holds.find((h) => h.id === holdId);
    const screening = hold && db.screenings.find((s) => s.id === hold.screeningId);
    const movie = screening && db.movies.find((m) => m.id === screening.movieId);
    const aud = screening && db.auditoriums.find((a) => a.id === screening.auditoriumId);
    if (!screening || !movie || !aud) return null;
    return {
      movie: { title: movie.title, slug: movie.slug, rating: movie.rating, art: movie.art, posterUrl: movie.posterUrl, runtimeMin: movie.runtimeMin },
      screening: { id: screening.id, startsAt: screening.startsAt, format: screening.format },
      auditorium: { name: aud.name, shortName: aud.shortName },
      demoPaymentMode: db.settings.demoPaymentMode,
    };
  });
  return <Checkout holdId={holdId} context={context} />;
}
