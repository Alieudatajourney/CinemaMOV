import "server-only";
import { dateKey } from "@/lib/format";
import { readDb } from "./store";
import { publishedMovies, scheduleDays, showtimes } from "./core/catalog";

/** Everything the public catalogue pages need, read in one consistent snapshot. */
export function getCatalog() {
  return readDb((db, now) => ({
    movies: publishedMovies(db),
    showtimes: showtimes(db, now),
    days: scheduleDays(db, now),
    todayKey: dateKey(now),
    settings: db.settings,
  }));
}

export function getSettings() {
  return readDb((db) => db.settings);
}
