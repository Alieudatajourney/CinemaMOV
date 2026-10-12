import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readDb } from "@/server/store";
import { seatMapView } from "@/server/core/catalog";
import { SeatSelection } from "@/components/booking/SeatSelection";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose your seats" };

export default async function BookPage({ params }: { params: Promise<{ screeningId: string }> }) {
  const { screeningId } = await params;
  const view = await readDb((db, now) => seatMapView(db, now, screeningId));
  if (!view) notFound();
  if (view.screening.status === "cancelled") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">This screening was cancelled</h1>
        <Link href={`/movies/${view.movie.slug}#showtimes`} className="btn btn-primary mt-8">
          Choose another showtime
        </Link>
      </div>
    );
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SeatSelection view={view} />
    </Suspense>
  );
}
