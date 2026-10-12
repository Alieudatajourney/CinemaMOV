import { z } from "zod";
import type { Auditorium, Database, Movie, Screening } from "@/lib/types";
import { addDaysKey, dateKey, formatDateTime, monroviaToUtc } from "@/lib/format";
import { capacity, parseLayout, validateLayout } from "@/lib/seating";
import { fail } from "../errors";
import { newId } from "../ids";
import { SEAT_BLOCKING_STATUSES, seatStates } from "../reconcile";

// ── Metrics (computed from stored records only) ─────────────────────────

export function dashboardMetrics(db: Database, now: Date) {
  const today = dateKey(now);
  const live = db.bookings.filter((b) => b.status !== "expired" && b.status !== "cancelled");
  const todays = live.filter((b) => dateKey(b.createdAt) === today);
  const paid = db.bookings.filter((b) => b.paymentStatus === "paid");
  const sold = db.bookings.filter((b) => b.status === "confirmed");
  const ticketsSold = sold.reduce((n, b) => n + b.items.length, 0);
  const revenueCents = paid.reduce((n, b) => n + b.totalCents, 0);
  const snackRevenueCents = paid.reduce((n, b) => n + (b.concessions ?? []).reduce((m, c) => m + c.lineCents, 0), 0);
  const snackAttachRate = paid.length ? paid.filter((b) => b.concessions?.length).length / paid.length : 0;
  const todayRevenueCents = paid.filter((b) => dateKey(b.confirmedAt ?? b.createdAt) === today).reduce((n, b) => n + b.totalCents, 0);

  const occupancyFor = (s: Screening) => {
    const aud = db.auditoriums.find((a) => a.id === s.auditoriumId)!;
    const cap = capacity(aud);
    const states = seatStates(db, s.id, now);
    const occupied = [...states.values()].filter((v) => v === "occupied").length;
    const held = [...states.values()].filter((v) => v === "held").length;
    return { capacity: cap, occupied, held, pct: cap ? occupied / cap : 0 };
  };

  const upcoming = db.screenings
    .filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now.getTime() - 15 * 60_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      movieTitle: db.movies.find((m) => m.id === s.movieId)?.title ?? "Unknown",
      auditorium: db.auditoriums.find((a) => a.id === s.auditoriumId)?.name ?? "",
      ...occupancyFor(s),
    }));

  const todaysScreenings = db.screenings.filter((s) => dateKey(s.startsAt) === today && s.status === "scheduled");
  const todayOcc = todaysScreenings.map(occupancyFor);
  const todayCap = todayOcc.reduce((n, o) => n + o.capacity, 0);
  const todayOccupied = todayOcc.reduce((n, o) => n + o.occupied, 0);

  // Revenue for the last 7 days (by payment/confirmation date).
  const revenueByDay = Array.from({ length: 7 }, (_, i) => {
    const key = addDaysKey(today, i - 6);
    const cents = paid.filter((b) => dateKey(b.confirmedAt ?? b.createdAt) === key).reduce((n, b) => n + b.totalCents, 0);
    return { day: key, cents };
  });

  const recent = [...db.bookings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((b) => adminBookingRow(db, b.id));

  const statusCounts = db.bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const futureDays = new Set(db.screenings.filter((s) => Date.parse(s.startsAt) > now.getTime()).map((s) => dateKey(s.startsAt)));

  return {
    todayBookings: todays.length,
    todayTickets: todays.reduce((n, b) => n + b.items.length, 0),
    ticketsSold,
    revenueCents,
    snackRevenueCents,
    snackAttachRate,
    todayRevenueCents,
    todayOccupancyPct: todayCap ? todayOccupied / todayCap : 0,
    todayScreenings: todaysScreenings.length,
    upcoming,
    recent,
    revenueByDay,
    statusCounts,
    redeemedCount: db.bookings.filter((b) => b.redeemedAt).length,
    futureScheduleDays: futureDays.size,
  };
}

export function adminBookingRow(db: Database, bookingId: string) {
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const s = db.screenings.find((x) => x.id === b.screeningId);
  const m = s && db.movies.find((x) => x.id === s.movieId);
  const a = s && db.auditoriums.find((x) => x.id === s.auditoriumId);
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    customer: b.customer,
    seats: b.items.map((i) => i.seatId),
    items: b.items,
    concessions: b.concessions ?? [],
    totalCents: b.totalCents,
    createdAt: b.createdAt,
    redeemedAt: b.redeemedAt,
    redeemedBy: b.redeemedBy,
    cancelReason: b.cancelReason,
    screeningId: b.screeningId,
    startsAt: s?.startsAt ?? "",
    movieTitle: m?.title ?? "Unknown film",
    movieId: m?.id ?? "",
    auditorium: a?.name ?? "",
    seeded: !!b.seeded,
  };
}
export type AdminBookingRow = ReturnType<typeof adminBookingRow>;

// ── Movies ───────────────────────────────────────────────────────────────

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v) || /^\/[^\s]*$/.test(v), "Use an https:// URL or a /local path.");

export const movieInput = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  tagline: z.string().trim().max(160).default(""),
  synopsis: z.string().trim().min(20, "Synopsis should be at least 20 characters.").max(2000),
  genres: z.array(z.string().trim().min(1).max(30)).min(1, "Add at least one genre.").max(5),
  runtimeMin: z.coerce.number().int().min(30, "Runtime must be at least 30 minutes.").max(300),
  language: z.string().trim().min(2).max(40),
  rating: z.enum(["G", "PG", "PG-13", "R", "NR", "15", "18"]),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  status: z.enum(["now_showing", "coming_soon"]),
  published: z.boolean(),
  director: z.string().trim().max(80).default(""),
  cast: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  posterUrl: optionalUrl,
  backdropUrl: optionalUrl,
  trailerUrl: optionalUrl,
  featured: z.boolean().optional(),
  art: z
    .object({
      hueA: z.number().int().min(0).max(360),
      hueB: z.number().int().min(0).max(360),
      motif: z.enum(["orbit", "waves", "sun", "shards", "rings", "grid", "palms", "stars"]),
    })
    .optional(),
});

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "movie"
  );
}

export function createMovie(db: Database, now: Date, input: z.infer<typeof movieInput>): Movie {
  let slug = slugify(input.title);
  for (let i = 2; db.movies.some((m) => m.slug === slug); i++) slug = `${slugify(input.title)}-${i}`;
  const iso = now.toISOString();
  const hue = Math.floor(Math.random() * 360);
  const movie: Movie = {
    id: newId("mov"),
    slug,
    ...input,
    art: input.art ?? { hueA: hue, hueB: (hue + 140) % 360, motif: "rings" },
    createdAt: iso,
    updatedAt: iso,
  };
  if (movie.featured) db.movies.forEach((m) => (m.featured = false));
  db.movies.push(movie);
  return movie;
}

export function updateMovie(db: Database, now: Date, id: string, input: z.infer<typeof movieInput>): Movie {
  const movie = db.movies.find((m) => m.id === id);
  if (!movie) fail("NOT_FOUND", "Movie not found.");
  if (input.runtimeMin > movie.runtimeMin) {
    const upcoming = db.screenings.filter((s) => s.movieId === id && s.status === "scheduled" && Date.parse(s.startsAt) > now.getTime());
    for (const s of upcoming) {
      const clash = findConflict(db, { id: s.id, auditoriumId: s.auditoriumId, movieId: id, startsAt: s.startsAt }, { movieId: id, runtimeMin: input.runtimeMin });
      if (clash) {
        fail("CONFLICT", `A ${input.runtimeMin}-minute runtime would make the ${formatDateTime(s.startsAt)} screening overlap: ${conflictMessage(db, clash)} Move or cancel one of them first.`);
      }
    }
  }
  if (input.featured) db.movies.forEach((m) => (m.featured = false));
  Object.assign(movie, { ...input, art: input.art ?? movie.art, updatedAt: now.toISOString() });
  return movie;
}

export function deleteMovie(db: Database, now: Date, id: string) {
  const movie = db.movies.find((m) => m.id === id);
  if (!movie) fail("NOT_FOUND", "Movie not found.");
  const screeningIds = new Set(db.screenings.filter((s) => s.movieId === id).map((s) => s.id));
  const activeFuture = db.bookings.some(
    (b) => screeningIds.has(b.screeningId) && SEAT_BLOCKING_STATUSES.has(b.status) &&
      Date.parse(db.screenings.find((s) => s.id === b.screeningId)!.startsAt) > now.getTime(),
  );
  if (activeFuture) {
    fail("CONFLICT", "This movie has upcoming screenings with active bookings. Unpublish it or cancel those bookings first.");
  }
  if (db.bookings.some((b) => screeningIds.has(b.screeningId))) {
    fail("CONFLICT", "This movie has booking history. Unpublish it instead to keep records intact.");
  }
  db.screenings = db.screenings.filter((s) => s.movieId !== id);
  db.holds = db.holds.filter((h) => !screeningIds.has(h.screeningId));
  db.movies = db.movies.filter((m) => m.id !== id);
}

// ── Screenings ───────────────────────────────────────────────────────────

// Money must arrive as integer cents. No coercion: "" or null must not silently become $0.00.
const cents = z.number({ error: "Enter a price." }).int("Prices must be whole cents.").min(0).max(100_000);
export const screeningInput = z.object({
  movieId: z.string().min(1),
  auditoriumId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time."),
  format: z.enum(["2D", "3D"]),
  prices: z.object({ standard: cents, vip: cents, accessible: cents }),
  status: z.enum(["scheduled", "cancelled"]).default("scheduled"),
});

/** Screenings in the same auditorium may not overlap (runtime + cleaning buffer). */
export function findConflict(
  db: Database,
  candidate: { id?: string; auditoriumId: string; movieId: string; startsAt: string },
  runtimeOverride?: { movieId: string; runtimeMin: number },
) {
  const movie = db.movies.find((m) => m.id === candidate.movieId);
  if (!movie) fail("BAD_REQUEST", "Choose a movie.");
  const runtimeOf = (movieId: string, fallback: number) =>
    runtimeOverride?.movieId === movieId ? runtimeOverride.runtimeMin : (db.movies.find((x) => x.id === movieId)?.runtimeMin ?? fallback);
  const buffer = db.settings.cleaningBufferMin * 60_000;
  const start = Date.parse(candidate.startsAt);
  const end = start + runtimeOf(movie.id, movie.runtimeMin) * 60_000 + buffer;
  return db.screenings.find((s) => {
    if (s.id === candidate.id || s.auditoriumId !== candidate.auditoriumId || s.status === "cancelled") return false;
    const sStart = Date.parse(s.startsAt);
    const sEnd = sStart + runtimeOf(s.movieId, 120) * 60_000 + buffer;
    return start < sEnd && sStart < end;
  });
}

function conflictMessage(db: Database, c: Screening) {
  const m = db.movies.find((x) => x.id === c.movieId);
  const a = db.auditoriums.find((x) => x.id === c.auditoriumId);
  const time = formatDateTime(c.startsAt);
  return `Conflicts with "${m?.title}" in ${a?.name} at ${time} (including the ${db.settings.cleaningBufferMin}-minute changeover).`;
}

export function createScreening(db: Database, now: Date, input: z.infer<typeof screeningInput>) {
  if (!db.auditoriums.some((a) => a.id === input.auditoriumId)) fail("BAD_REQUEST", "Choose an auditorium.");
  const startsAt = monroviaToUtc(input.date, input.time);
  if (Date.parse(startsAt) < now.getTime()) fail("BAD_REQUEST", "Screenings must be scheduled in the future.");
  const conflict = findConflict(db, { auditoriumId: input.auditoriumId, movieId: input.movieId, startsAt });
  if (conflict) fail("CONFLICT", conflictMessage(db, conflict));
  const screening: Screening = {
    id: newId("scr"),
    movieId: input.movieId,
    auditoriumId: input.auditoriumId,
    startsAt,
    format: input.format,
    prices: input.prices,
    status: input.status,
    createdAt: now.toISOString(),
  };
  db.screenings.push(screening);
  return screening;
}

export function updateScreening(db: Database, now: Date, id: string, input: z.infer<typeof screeningInput>) {
  const screening = db.screenings.find((s) => s.id === id);
  if (!screening) fail("NOT_FOUND", "Screening not found.");
  if (!db.auditoriums.some((a) => a.id === input.auditoriumId)) fail("BAD_REQUEST", "Choose an auditorium.");
  if (!db.movies.some((m) => m.id === input.movieId)) fail("BAD_REQUEST", "Choose a movie.");
  const startsAt = monroviaToUtc(input.date, input.time);
  const timeChanged = startsAt !== screening.startsAt;
  if (timeChanged && Date.parse(startsAt) < now.getTime()) fail("BAD_REQUEST", "Screenings can't be moved into the past.");
  const hasActive = db.bookings.some((b) => b.screeningId === id && SEAT_BLOCKING_STATUSES.has(b.status));
  if (hasActive && timeChanged) {
    fail("CONFLICT", "Customers already hold tickets for this time, so it can't be moved. Create a new screening instead, or cancel these bookings first.");
  }
  if (hasActive && (input.auditoriumId !== screening.auditoriumId || input.movieId !== screening.movieId)) {
    fail("CONFLICT", "This screening has active bookings, so its movie and auditorium can't change. Cancel the bookings first.");
  }
  if (hasActive && input.status === "cancelled") {
    fail("CONFLICT", "Cancel this screening's active bookings before cancelling the screening.");
  }
  if (input.status === "scheduled") {
    const conflict = findConflict(db, { id, auditoriumId: input.auditoriumId, movieId: input.movieId, startsAt });
    if (conflict) fail("CONFLICT", conflictMessage(db, conflict));
  }
  // Prices only affect new bookings; existing bookings keep the price they were sold at.
  Object.assign(screening, { movieId: input.movieId, auditoriumId: input.auditoriumId, startsAt, format: input.format, prices: input.prices, status: input.status });
  return screening;
}

// ── Settings & auditoriums ───────────────────────────────────────────────

export const settingsInput = z.object({
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().max(120),
  addressLine: z.string().trim().min(3).max(200),
  hours: z.string().trim().max(120),
  mapUrl: z.string().trim().max(500).refine((v) => !v || v.startsWith("https://"), "Map link must start with https://"),
  contactIsPlaceholder: z.boolean(),
  holdMinutes: z.coerce.number().int().min(2).max(30),
  pendingPaymentMinutes: z.coerce.number().int().min(5).max(120),
  maxTicketsPerBooking: z.coerce.number().int().min(1).max(12),
  cleaningBufferMin: z.coerce.number().int().min(0).max(90),
  demoPaymentMode: z.enum(["customer_choice", "always_succeed", "always_pending", "always_fail", "random"]),
  defaultPrices: z.object({ standard: cents, vip: cents, accessible: cents }),
});

export function updateSettings(db: Database, input: z.infer<typeof settingsInput>) {
  // Name and location are fixed brand facts and cannot be edited here.
  Object.assign(db.settings, input);
  return db.settings;
}

export const auditoriumInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  rows: z.array(z.object({ label: z.string(), pattern: z.string() })).min(1).max(26),
});

export function updateAuditorium(db: Database, now: Date, id: string, input: z.infer<typeof auditoriumInput>): Auditorium {
  const aud = db.auditoriums.find((a) => a.id === id);
  if (!aud) fail("NOT_FOUND", "Auditorium not found.");
  const v = validateLayout(input.rows);
  if (!v.ok) fail("BAD_REQUEST", v.errors.join(" "));
  // Seat ids are positional, so a booked or held seat must keep its id, position and category —
  // otherwise a ticket would silently point at a different chair. Screenings in progress count too.
  const before = new Map(parseLayout(aud.rows).map((s) => [s.id, s]));
  const after = new Map(parseLayout(input.rows).map((s) => [s.id, s]));
  const live = db.screenings.filter((s) => {
    if (s.auditoriumId !== id) return false;
    const runtime = db.movies.find((m) => m.id === s.movieId)?.runtimeMin ?? 180;
    return Date.parse(s.startsAt) + runtime * 60_000 > now.getTime();
  });
  const affected = new Set<string>();
  for (const s of live) {
    for (const seatId of seatStates(db, s.id, now).keys()) {
      const was = before.get(seatId);
      const now_ = after.get(seatId);
      if (!now_ || !was || now_.col !== was.col || now_.category !== was.category) affected.add(seatId);
    }
  }
  if (affected.size) {
    fail("CONFLICT", `These seats are booked or held for upcoming screenings and can't be removed, moved or re-categorised: ${[...affected].slice(0, 12).join(", ")}${affected.size > 12 ? "…" : ""}`);
  }
  aud.name = input.name;
  aud.description = input.description;
  aud.rows = input.rows;
  return aud;
}

export function screeningsForAdmin(db: Database, now: Date, fromKey?: string) {
  const from = fromKey ?? dateKey(now);
  return db.screenings
    .filter((s) => dateKey(s.startsAt) >= from)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => {
      const aud = db.auditoriums.find((a) => a.id === s.auditoriumId)!;
      const states = seatStates(db, s.id, now);
      return {
        ...s,
        movieTitle: db.movies.find((m) => m.id === s.movieId)?.title ?? "Unknown",
        auditoriumName: aud.name,
        capacity: capacity(aud),
        occupied: [...states.values()].filter((v) => v === "occupied").length,
        held: [...states.values()].filter((v) => v === "held").length,
        hasBookings: db.bookings.some((b) => b.screeningId === s.id && SEAT_BLOCKING_STATUSES.has(b.status)),
      };
    });
}

// ── Concessions menu ─────────────────────────────────────────────────────

export const concessionInput = z.object({
  name: z.string().trim().min(2, "Name is required.").max(60),
  description: z.string().trim().max(200).default(""),
  category: z.enum(["combos", "popcorn", "drinks", "snacks", "sweets"]),
  imageUrl: optionalUrl,
  available: z.boolean(),
  featured: z.boolean().optional(),
  variants: z
    .array(z.object({ id: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(30), priceCents: cents }))
    .min(1, "Add at least one size or price.")
    .max(5)
    .refine((v) => new Set(v.map((x) => x.id)).size === v.length, "Size codes must be unique."),
});

export function createConcession(db: Database, input: z.infer<typeof concessionInput>) {
  const item = { id: newId("con"), ...input };
  db.concessions.push(item);
  return item;
}

export function updateConcession(db: Database, id: string, input: z.infer<typeof concessionInput>) {
  const item = db.concessions.find((c) => c.id === id);
  if (!item) fail("NOT_FOUND", "Menu item not found.");
  // Bookings keep the name and price they were sold at, so editing never changes past orders.
  Object.assign(item, input);
  return item;
}

export function deleteConcession(db: Database, id: string) {
  if (!db.concessions.some((c) => c.id === id)) fail("NOT_FOUND", "Menu item not found.");
  db.concessions = db.concessions.filter((c) => c.id !== id);
}
