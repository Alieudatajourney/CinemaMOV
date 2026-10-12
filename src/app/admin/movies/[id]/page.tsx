import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { dateKey } from "@/lib/format";
import { AdminHeader } from "@/components/admin/ui";
import { MovieForm } from "@/components/admin/MovieForm";

export const metadata: Metadata = { title: "Edit movie" };

export default async function EditMovie({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageRole(["admin"], `/admin/movies/${id}`);
  const movie = await readDb((db) => db.movies.find((m) => m.id === id) ?? null);
  if (!movie) notFound();
  return (
    <>
      <AdminHeader eyebrow="Movies" title={movie.title} description="Changes apply immediately on the public site." />
      <MovieForm movie={movie} today={dateKey(new Date())} />
    </>
  );
}
