import type { Database, Movie, Screening } from "@/lib/types";
import { dateKey } from "@/lib/format";
import { capacity } from "@/lib/seating";
import { seatStates } from "../reconcile";
import { isOnSale } from "./booking";

export interface PublicShowtime {
  id: string;
  movieId: string;
  startsAt: string;
  day: string;
  auditoriumId: string;
  auditoriumName: string;
  auditoriumShort: string;
  format: Screening["format"];
  prices: Screening["prices"];
  onSale: boolean;
  seatsLeft: number;
  capacity: number;
}

/** Public movie fields only (no internal timestamps). */
export function publicMovie(m: Movie) {
  const { createdAt: _c, updatedAt: _u, ...rest } = m;
  return rest;
}
export type PublicMovie = ReturnType<typeof publicMovie>;

export function publishedMovies(db: Database) {
  return db.movies.filter((m) => m.published).map(publicMovie);
}

export function showtimes(db: Database, now: Date, filter?: { movieId?: string }): PublicShowtime[] {
  const published = new Set(db.movies.filter((m) => m.published).map((m) => m.id));
  return db.screenings
    .filter((s) => s.status === "scheduled" && published.has(s.movieId) && (!filter?.movieId || s.movieId === filter.movieId))
    .filter((s) => dateKey(s.startsAt) >= dateKey(now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => {
      const aud = db.auditoriums.find((a) => a.id === s.auditoriumId)!;
      const cap = capacity(aud);
      const blocked = seatStates(db, s.id, now).size;
      return {
        id: s.id,
        movieId: s.movieId,
        startsAt: s.startsAt,
        day: dateKey(s.startsAt),
        auditoriumId: aud.id,
        auditoriumName: aud.name,
        auditoriumShort: aud.shortName,
        format: s.format,
        prices: s.prices,
        onSale: isOnSale(db, s.id, now),
        seatsLeft: cap - blocked,
        capacity: cap,
      };
    });
}

export function scheduleDays(db: Database, now: Date): string[] {
  return [...new Set(showtimes(db, now).map((s) => s.day))].sort();
}

/** Full seat-map payload for one screening. */
export function seatMapView(db: Database, now: Date, screeningId: string) {
  const s = db.screenings.find((x) => x.id === screeningId);
  if (!s) return null;
  const movie = db.movies.find((m) => m.id === s.movieId);
  const aud = db.auditoriums.find((a) => a.id === s.auditoriumId);
  if (!movie || !aud || !movie.published) return null;
  const states = seatStates(db, s.id, now);
  return {
    screening: { id: s.id, startsAt: s.startsAt, format: s.format, prices: s.prices, status: s.status },
    movie: publicMovie(movie),
    auditorium: aud,
    states: Object.fromEntries(states),
    onSale: isOnSale(db, s.id, now),
    maxTickets: db.settings.maxTicketsPerBooking,
    holdMinutes: db.settings.holdMinutes,
    serverNow: now.toISOString(),
  };
}
export type SeatMapView = NonNullable<ReturnType<typeof seatMapView>>;
