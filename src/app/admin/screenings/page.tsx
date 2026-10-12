import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { screeningsForAdmin } from "@/server/core/admin";
import { dateKey } from "@/lib/format";
import { AdminHeader } from "@/components/admin/ui";
import { ScreeningManager } from "@/components/admin/ScreeningManager";

export const metadata: Metadata = { title: "Screenings" };

export default async function AdminScreenings() {
  await requirePageRole(["admin"], "/admin/screenings");
  const data = await readDb((db, now) => ({
    screenings: screeningsForAdmin(db, now),
    movies: db.movies.map((m) => ({ id: m.id, title: m.title, runtimeMin: m.runtimeMin, published: m.published })),
    auditoriums: db.auditoriums.map((a) => ({ id: a.id, name: a.name })),
    defaults: db.settings.defaultPrices,
    buffer: db.settings.cleaningBufferMin,
    today: dateKey(now),
  }));
  return (
    <>
      <AdminHeader
        eyebrow="Schedule"
        title="Screenings"
        description={`All times are Africa/Monrovia (GMT). Screenings in the same auditorium can't overlap, including a ${data.buffer}-minute changeover.`}
      />
      <ScreeningManager {...data} />
    </>
  );
}
