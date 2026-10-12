import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { dateKey } from "@/lib/format";
import { AdminHeader } from "@/components/admin/ui";
import { MovieForm } from "@/components/admin/MovieForm";

export const metadata: Metadata = { title: "Add movie" };

export default async function NewMovie() {
  await requirePageRole(["admin"], "/admin/movies/new");
  return (
    <>
      <AdminHeader eyebrow="Movies" title="Add a movie" description="New movies start hidden. Publish when artwork and details are ready." />
      <MovieForm today={dateKey(new Date())} />
    </>
  );
}
