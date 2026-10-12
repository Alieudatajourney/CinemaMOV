import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { adminBookingRow } from "@/server/core/admin";
import { dateKey } from "@/lib/format";
import { AdminHeader } from "@/components/admin/ui";
import { BookingsTable } from "@/components/admin/BookingsTable";

export const metadata: Metadata = { title: "Bookings" };

const STATUSES = ["confirmed", "reserved", "pending_payment", "cancelled", "expired", "admitted"];
const PAGE = 50;

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageRole(["admin"], "/admin/bookings");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const movie = sp.movie ?? "";
  const date = sp.date ?? "";
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, movies } = await readDb((db) => {
    const all = [...db.bookings]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((b) => adminBookingRow(db, b.id))
      .filter((r) => {
        if (q && !`${r.reference} ${r.customer.name} ${r.customer.phone} ${r.customer.email ?? ""}`.toLowerCase().includes(q)) return false;
        if (movie && r.movieId !== movie) return false;
        if (date && dateKey(r.startsAt) !== date) return false;
        if (status === "admitted") return !!r.redeemedAt;
        if (status && r.status !== status) return false;
        return true;
      });
    return {
      total: all.length,
      rows: all.slice((page - 1) * PAGE, page * PAGE),
      movies: db.movies.map((m) => ({ id: m.id, title: m.title })),
    };
  });

  return (
    <>
      <AdminHeader eyebrow="Customers" title="Bookings" description="Search by booking reference, customer, movie, screening date or status. Cancelling releases the seats immediately." />
      <form className="surface mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_auto_auto_auto]" role="search">
        <label>
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={sp.q ?? ""} className="field" placeholder="Reference, name, phone or email" />
        </label>
        <label>
          <span className="sr-only">Movie</span>
          <select name="movie" defaultValue={movie} className="field">
            <option value="">All movies</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Screening date</span>
          <input type="date" name="date" defaultValue={date} className="field" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={status} className="field">
            <option value="">Any status</option>
            <option value="confirmed">Confirmed</option>
            <option value="reserved">Reserved (pay at cinema)</option>
            <option value="pending_payment">Payment pending</option>
            <option value="admitted">Admitted</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          <a href="/admin/bookings" className="btn btn-ghost">
            Reset
          </a>
        </div>
      </form>
      <BookingsTable rows={rows} />
      <div className="mt-4 flex items-center justify-between text-sm text-fg-muted">
        <span>
          {total.toLocaleString("en-US")} booking{total === 1 ? "" : "s"}
          {total > PAGE && ` · page ${page} of ${Math.ceil(total / PAGE)}`}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <a className="btn btn-secondary btn-sm" href={`?${new URLSearchParams({ ...clean(sp), page: String(page - 1) })}`}>
              Previous
            </a>
          )}
          {page * PAGE < total && (
            <a className="btn btn-secondary btn-sm" href={`?${new URLSearchParams({ ...clean(sp), page: String(page + 1) })}`}>
              Next
            </a>
          )}
        </span>
      </div>
    </>
  );
}

function clean(sp: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>;
}
