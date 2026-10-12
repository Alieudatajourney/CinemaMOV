// Demo seed data. Films are real (see SEED_MOVIES); everything else — schedules, prices, customers,
// contact details and bookings exist only to demonstrate the product.
import { createHash, randomBytes } from "node:crypto";
import type {
  Auditorium,
  Booking,
  BookingStatus,
  CinemaSettings,
  ConcessionItem,
  ConcessionSelection,
  Database,
  Movie,
  PaymentStatus,
  PriceTable,
  RedemptionRecord,
  Screening,
  SeatHold,
} from "@/lib/types";
import { addDaysKey, dateKey, monroviaToUtc } from "@/lib/format";
import { parseLayout, quoteSeats } from "@/lib/seating";
import { quoteConcessions } from "@/lib/concessions";
import { DEMO_ACCOUNTS, hashPassword } from "./passwords";

export const SCHEMA_VERSION = 1;

/** Sample concession menu. Prices are fictional. Photos live in public/media/snacks (see CREDITS.md). */
export const SEED_CONCESSIONS: ConcessionItem[] = [
  {
    id: "con_combo_night",
    name: "Movie Night Combo",
    description: "Large butter popcorn and two medium soft drinks — made for sharing.",
    category: "combos",
    imageUrl: "/media/snacks/popcorn.jpg",
    available: true,
    featured: true,
    variants: [{ id: "r", label: "Regular", priceCents: 1100 }],
  },
  {
    id: "con_combo_solo",
    name: "Solo Combo",
    description: "Medium butter popcorn and a medium soft drink.",
    category: "combos",
    imageUrl: "/media/snacks/popcorn.jpg",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 650 }],
  },
  {
    id: "con_popcorn",
    name: "Butter Popcorn",
    description: "Freshly popped, warm and lightly salted.",
    category: "popcorn",
    imageUrl: "/media/snacks/popcorn.jpg",
    available: true,
    featured: true,
    variants: [
      { id: "s", label: "Small", priceCents: 300 },
      { id: "m", label: "Medium", priceCents: 450 },
      { id: "l", label: "Large", priceCents: 600 },
    ],
  },
  {
    id: "con_popcorn_caramel",
    name: "Caramel Popcorn",
    description: "Crunchy popcorn coated in golden caramel.",
    category: "popcorn",
    imageUrl: "/media/snacks/popcorn.jpg",
    available: true,
    variants: [
      { id: "m", label: "Medium", priceCents: 500 },
      { id: "l", label: "Large", priceCents: 650 },
    ],
  },
  {
    id: "con_soda",
    name: "Soft Drink",
    description: "Ice-cold fountain soda. Choose your flavour at the counter.",
    category: "drinks",
    imageUrl: "/media/snacks/soda.jpg",
    available: true,
    variants: [
      { id: "s", label: "Small", priceCents: 150 },
      { id: "m", label: "Medium", priceCents: 200 },
      { id: "l", label: "Large", priceCents: 275 },
    ],
  },
  {
    id: "con_water",
    name: "Bottled Water",
    description: "500 ml still water.",
    category: "drinks",
    imageUrl: "/media/snacks/water.jpg",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 100 }],
  },
  {
    id: "con_nachos",
    name: "Nachos & Cheese",
    description: "Crispy tortilla chips with warm cheese sauce.",
    category: "snacks",
    imageUrl: "/media/snacks/nachos.jpg",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 450 }],
  },
  {
    id: "con_hotdog",
    name: "Classic Hot Dog",
    description: "Grilled sausage in a soft bun with your choice of toppings.",
    category: "snacks",
    imageUrl: "/media/snacks/hotdog.jpg",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 400 }],
  },
  {
    id: "con_chocolate",
    name: "Chocolate Bar",
    description: "A classic cinema treat.",
    category: "sweets",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 200 }],
  },
  {
    id: "con_icecream",
    name: "Ice Cream Cup",
    description: "Vanilla or chocolate — chosen at the counter.",
    category: "sweets",
    imageUrl: "/media/snacks/icecream.jpg",
    available: true,
    variants: [{ id: "r", label: "Regular", priceCents: 300 }],
  },
];

export const DEFAULT_SETTINGS: CinemaSettings = {
  name: "Monrovia Cinema Plus",
  venue: "Monrovia Super Mall",
  city: "Monrovia",
  country: "Liberia",
  addressLine: "Monrovia Super Mall, Monrovia, Liberia",
  phone: "+231 000 000 000",
  email: "hello@monroviacinemaplus.example",
  hours: "Daily, 10:30 – 23:30 (placeholder)",
  mapUrl: "https://www.openstreetmap.org/search?query=Monrovia%20Super%20Mall%2C%20Monrovia%2C%20Liberia",
  contactIsPlaceholder: true,
  holdMinutes: 8,
  pendingPaymentMinutes: 20,
  maxTicketsPerBooking: 8,
  cleaningBufferMin: 15,
  demoPaymentMode: "customer_choice",
  defaultPrices: { standard: 700, vip: 1200, accessible: 700 },
};

export const SEED_AUDITORIUMS: Auditorium[] = [
  {
    id: "aud_grand",
    name: "Grand Hall",
    shortName: "Hall 1",
    description: "Our largest auditorium: stadium seating with a curved screen and VIP recliners in the back rows.",
    rows: [
      { label: "A", pattern: ".SS_SSSSS_SSSSS_SS." },
      { label: "B", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "C", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "D", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "E", pattern: "AA._SSSSS_SSSSS_.AA" },
      { label: "F", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "G", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "H", pattern: "SSS_SSSSS_SSSSS_SSS" },
      { label: "J", pattern: "SSS_VVVVV_VVVVV_SSS" },
      { label: "K", pattern: "..._VVVVV_VVVVV_..." },
    ],
  },
  {
    id: "aud_lounge",
    name: "Studio Lounge",
    shortName: "Hall 2",
    description: "An intimate premium room with wider rows and a full back section of VIP recliners.",
    rows: [
      { label: "A", pattern: "SS_SSSSSS_SS" },
      { label: "B", pattern: "SS_SSSSSS_SS" },
      { label: "C", pattern: "SS_SSSSSS_SS" },
      { label: "D", pattern: "A._SSSSSS_.A" },
      { label: "E", pattern: "VV_VVVVVV_VV" },
      { label: "F", pattern: "VV_VVVVVV_VV" },
    ],
  },
];

type MovieSeed = Omit<Movie, "createdAt" | "updatedAt">;

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const art = (slug: string) => ({ posterUrl: `/media/films/${slug}-poster.jpg`, backdropUrl: `/media/films/${slug}-backdrop.jpg` });

/**
 * Real films (titles, credits, release dates and ratings from TMDB; trailers are the studios'
 * official YouTube uploads). Synopses and taglines are our own short descriptions. Showtimes and
 * prices generated below are SAMPLE data — they are not this cinema's real programme.
 * Artwork is studio promotional material sourced via TMDB — see public/media/CREDITS.md.
 */
export const SEED_MOVIES: MovieSeed[] = [
  {
    id: "mov_forgotten_island",
    slug: "forgotten-island",
    title: "Forgotten Island",
    tagline: "Some friendships are worth remembering.",
    synopsis:
      "On their final night together after graduation, lifelong best friends Jo and Raissa tumble through a magical portal to the island of Nakali. The only way home costs them every memory they share — so the pair race to find another way out before they forget each other.",
    genres: ["Animation", "Adventure", "Family"],
    runtimeMin: 109,
    language: "English",
    rating: "PG",
    releaseDate: "2026-09-25",
    status: "now_showing",
    published: true,
    featured: true,
    director: "Januel Mercado, Joel Crawford",
    cast: ["H.E.R.", "Liza Soberano", "Dave Franco", "Jenny Slate"],
    trailerUrl: yt("a8RHqN93qfo"),
    ...art("forgotten-island"),
    art: { hueA: 200, hueB: 290, motif: "palms" },
  },
  {
    id: "mov_digger",
    slug: "digger",
    title: "Digger",
    tagline: "He broke the world. Now he wants the credit for fixing it.",
    synopsis:
      "Digger Rockwell, the most powerful man on Earth, sets off a catastrophe that threatens to wipe out everything — and races the clock to convince the world that he alone can save it, in this darkly comic story.",
    genres: ["Comedy", "Drama"],
    runtimeMin: 129,
    language: "English",
    rating: "R",
    releaseDate: "2026-10-02",
    status: "now_showing",
    published: true,
    director: "Alejandro G. Iñárritu",
    cast: ["Tom Cruise", "Riz Ahmed", "John Goodman", "Sandra Hüller"],
    trailerUrl: yt("qORTe1wW3Wg"),
    ...art("digger"),
    art: { hueA: 18, hueB: 40, motif: "sun" },
  },
  {
    id: "mov_verity",
    slug: "verity",
    title: "Verity",
    tagline: "Every story has a version you were never meant to read.",
    synopsis:
      "Struggling writer Lowen Ashleigh is hired to finish a bestselling series for injured author Verity Crawford and moves into the family home — where an unpublished manuscript full of disturbing confessions makes her question everything about the people she is living with.",
    genres: ["Mystery", "Thriller"],
    runtimeMin: 114,
    language: "English",
    rating: "R",
    releaseDate: "2026-10-02",
    status: "now_showing",
    published: true,
    director: "Michael Showalter",
    cast: ["Anne Hathaway", "Dakota Johnson", "Josh Hartnett", "Brady Wagner"],
    trailerUrl: yt("xdPMKhjMSFs"),
    ...art("verity"),
    art: { hueA: 350, hueB: 20, motif: "shards" },
  },
  {
    id: "mov_other_mommy",
    slug: "other-mommy",
    title: "Other Mommy",
    tagline: "She looks just like Mommy. She isn't.",
    synopsis:
      "Young Bela starts to notice that something in her house is wearing her mother's face. As the imposter tightens its grip on the family, Bela is pulled into a nightmare only she seems able to see.",
    genres: ["Horror"],
    runtimeMin: 93,
    language: "English",
    rating: "R",
    releaseDate: "2026-10-09",
    status: "now_showing",
    published: true,
    director: "Rob Savage",
    cast: ["Jessica Chastain", "Jay Duplass", "Arabella Olivia Clark", "Karen Allen"],
    trailerUrl: yt("bEpTgowZ1dI"),
    ...art("other-mommy"),
    art: { hueA: 0, hueB: 340, motif: "rings" },
  },
  {
    id: "mov_social_reckoning",
    slug: "the-social-reckoning",
    title: "The Social Reckoning",
    tagline: "The truth was always in the data.",
    synopsis:
      "Data scientist Frances Haugen decides to expose what she has seen inside the world's biggest social network, teaming up with journalist Jeff Horwitz to bring the evidence to light — two people against one of the most powerful companies on the planet.",
    genres: ["Drama", "History", "Thriller"],
    runtimeMin: 112,
    language: "English",
    rating: "R",
    releaseDate: "2026-10-09",
    status: "now_showing",
    published: true,
    director: "Aaron Sorkin",
    cast: ["Mikey Madison", "Jeremy Allen White", "Jeremy Strong", "Bill Burr"],
    trailerUrl: yt("MfHEZw7Xw_c"),
    ...art("the-social-reckoning"),
    art: { hueA: 210, hueB: 230, motif: "grid" },
  },
  {
    id: "mov_resident_evil",
    slug: "resident-evil",
    title: "Resident Evil",
    tagline: "One delivery. One night. No way out.",
    synopsis:
      "Bryan, a medical courier on a routine delivery run, is caught up in an outbreak that turns one ordinary night into a fight for survival. As the chaos spreads, he has to keep moving — and keep breathing — until sunrise.",
    genres: ["Horror", "Sci-Fi", "Adventure"],
    runtimeMin: 95,
    language: "English",
    rating: "R",
    releaseDate: "2026-09-18",
    status: "now_showing",
    published: true,
    director: "Zach Cregger",
    cast: ["Austin Abrams", "Paul Walter Hauser", "Kali Reis", "Zach Cherry"],
    trailerUrl: yt("mNd1gb19A-c"),
    ...art("resident-evil"),
    art: { hueA: 355, hueB: 0, motif: "orbit" },
  },
  {
    id: "mov_sunrise_reaping",
    slug: "the-hunger-games-sunrise-on-the-reaping",
    title: "The Hunger Games: Sunrise on the Reaping",
    tagline: "Every legend begins with a reaping.",
    synopsis:
      "Decades before Katniss, a teenage Haymitch Abernathy of District 12 is reaped for the 50th Hunger Games — a Quarter Quell that sends twice the usual number of tributes into the arena — and must decide what he is willing to risk to defy the Capitol.",
    genres: ["Sci-Fi", "Action", "Adventure"],
    runtimeMin: 158,
    language: "English",
    rating: "PG-13",
    releaseDate: "2026-11-20",
    status: "coming_soon",
    published: true,
    director: "Francis Lawrence",
    cast: ["Joseph Zada", "Ralph Fiennes", "Jesse Plemons", "Mckenna Grace"],
    trailerUrl: yt("lYXtL5TreOE"),
    ...art("sunrise-on-the-reaping"),
    art: { hueA: 40, hueB: 120, motif: "sun" },
  },
  {
    id: "mov_avengers_doomsday",
    slug: "avengers-doomsday",
    title: "Avengers: Doomsday",
    tagline: "Doom has a plan. The heroes need one.",
    synopsis:
      "Victor von Doom rises as a threat on a scale Earth's heroes have never faced. Avengers old and new must unite with allies from across the multiverse — but a team fractured by the past will struggle to stand together in time.",
    genres: ["Action", "Sci-Fi", "Adventure"],
    runtimeMin: 165,
    language: "English",
    rating: "NR",
    releaseDate: "2026-12-18",
    status: "coming_soon",
    published: true,
    director: "Anthony Russo, Joe Russo",
    cast: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Pedro Pascal"],
    trailerUrl: yt("irVNGjRFZGk"),
    ...art("avengers-doomsday"),
    art: { hueA: 140, hueB: 160, motif: "stars" },
  },
];

const HALL_SLOTS: Record<string, string[]> = {
  aud_grand: ["11:00", "14:00", "17:15", "20:30"],
  aud_lounge: ["12:00", "15:00", "18:00", "21:00"],
};

const HALL_PRICES: Record<string, { matinee: PriceTable; evening: PriceTable }> = {
  aud_grand: {
    matinee: { standard: 600, vip: 1100, accessible: 600 },
    evening: { standard: 700, vip: 1200, accessible: 700 },
  },
  aud_lounge: {
    matinee: { standard: 800, vip: 1400, accessible: 800 },
    evening: { standard: 900, vip: 1500, accessible: 900 },
  },
};

const FIRST = ["Musu", "Emmanuel", "Fatu", "Joseph", "Comfort", "Samuel", "Patience", "Moses", "Hawa", "Prince", "Esther", "Varney", "Mercy", "Abraham", "Precious", "Kollie", "Victoria", "Isaac", "Martha", "Sekou"];
const LAST = ["Kollie", "Doe", "Johnson", "Kamara", "Sirleaf", "Tarpeh", "Gbollie", "Weah", "Nimley", "Toe", "Flomo", "Massaquoi", "Paye", "Cooper", "Sumo", "Karnga", "Freeman", "Dolo", "Wesseh", "Bility"];

/** Deterministic PRNG so the same screening always gets a plausible-looking pattern. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string) {
  return createHash("sha256").update(s).digest().readUInt32LE(0);
}
const secret = (n = 24) => randomBytes(n).toString("base64url");
const REF = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
function ref(used: Set<string>) {
  for (;;) {
    const b = randomBytes(8);
    const r = `MCP-${[...b.subarray(0, 4)].map((x) => REF[x % REF.length]).join("")}-${[...b.subarray(4)].map((x) => REF[x % REF.length]).join("")}`;
    if (!used.has(r)) {
      used.add(r);
      return r;
    }
  }
}

export function buildSeedDatabase(now: Date): Database {
  const nowIso = now.toISOString();
  const today = dateKey(now);

  const movies: Movie[] = SEED_MOVIES.map((m) => ({
    ...m,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const showing = movies.filter((m) => m.status === "now_showing");
  const screenings: Screening[] = [];
  for (let d = 0; d < 5; d++) {
    const day = addDaysKey(today, d);
    for (const [h, aud] of SEED_AUDITORIUMS.entries()) {
      HALL_SLOTS[aud.id].forEach((time, i) => {
        const movie = showing[(d + i * 2 + h * 3) % showing.length];
        const evening = time >= "17:00";
        screenings.push({
          id: `scr_${day.replace(/-/g, "")}_${aud.id.slice(4)}_${time.replace(":", "")}`,
          movieId: movie.id,
          auditoriumId: aud.id,
          startsAt: monroviaToUtc(day, time),
          format: movie.id === "mov_forgotten_island" && aud.id === "aud_grand" && evening ? "3D" : "2D",
          prices: { ...HALL_PRICES[aud.id][evening ? "evening" : "matinee"] },
          status: "scheduled",
          createdAt: nowIso,
        });
      });
    }
  }

  const bookings: Booking[] = [];
  const holds: SeatHold[] = [];
  const redemptions: RedemptionRecord[] = [];
  const usedRefs = new Set<string>();
  const t = now.getTime();
  let customerIdx = 0;

  for (const scr of screenings) {
    const aud = SEED_AUDITORIUMS.find((a) => a.id === scr.auditoriumId)!;
    const seats = parseLayout(aud.rows);
    const byRow = new Map<string, string[]>();
    for (const s of seats) byRow.set(s.row, [...(byRow.get(s.row) ?? []), s.id]);
    const rand = mulberry32(hashSeed(scr.id));
    const start = Date.parse(scr.startsAt);
    const daysOut = Math.max(0, Math.floor((start - t) / 86_400_000));
    const evening = scr.startsAt.slice(11, 16) >= "17:00";
    const target = Math.round(seats.length * Math.max(0.06, (evening ? 0.5 : 0.28) - daysOut * 0.08 + rand() * 0.12));
    const taken = new Set<string>();
    let guard = 0;

    while (taken.size < target && guard++ < 400) {
      const rows = [...byRow.keys()];
      const row = rows[Math.floor(rand() * rows.length)];
      const rowSeats = byRow.get(row)!;
      const size = 1 + Math.floor(rand() * Math.min(4, rowSeats.length));
      const startIdx = Math.floor(rand() * (rowSeats.length - size + 1));
      const group = rowSeats.slice(startIdx, startIdx + size);
      if (group.some((id) => taken.has(id))) continue;
      group.forEach((id) => taken.add(id));

      const past = start <= t;
      const roll = rand();
      let status: BookingStatus = "confirmed";
      let paymentStatus: PaymentStatus = "paid";
      let method: Booking["paymentMethod"] = rand() < 0.65 ? "demo_online" : "pay_at_cinema";
      if (!past && roll < 0.18) {
        status = "reserved";
        paymentStatus = "unpaid";
        method = "pay_at_cinema";
      } else if (roll > 0.93) {
        status = "cancelled";
        paymentStatus = method === "demo_online" ? "refunded" : "void";
      }
      const createdAt = new Date(
        Math.min(t - 60_000 * (5 + Math.floor(rand() * 600)), start - 3_600_000) - Math.floor(rand() * 7) * 86_400_000,
      ).toISOString();
      const q = quoteSeats(group, aud, scr.prices);
      // Roughly a third of guests pre-order snacks.
      const snackRoll = rand();
      const snackPick: ConcessionSelection[] =
        snackRoll < 0.12
          ? [{ itemId: "con_combo_night", variantId: "r", qty: 1 }]
          : snackRoll < 0.24
            ? [{ itemId: "con_popcorn", variantId: "l", qty: 1 }, { itemId: "con_soda", variantId: "m", qty: group.length }]
            : snackRoll < 0.33
              ? [{ itemId: "con_combo_solo", variantId: "r", qty: group.length }]
              : [];
      const snacks = quoteConcessions(snackPick, SEED_CONCESSIONS);
      const snackLines = snacks.ok ? snacks.lines : [];
      const snackCents = snacks.ok ? snacks.totalCents : 0;
      const name = `${FIRST[customerIdx % FIRST.length]} ${LAST[(customerIdx * 7 + 3) % LAST.length]}`;
      customerIdx++;
      const booking: Booking = {
        id: `bkg_seed_${bookings.length}`,
        reference: ref(usedRefs),
        screeningId: scr.id,
        items: q.items,
        concessions: snackLines.length ? snackLines : undefined,
        subtotalCents: q.subtotalCents + snackCents,
        feesCents: q.feesCents,
        totalCents: q.totalCents + snackCents,
        currency: "USD",
        customer: {
          name,
          phone: `+231 770 000 ${String(100 + (customerIdx % 900)).padStart(3, "0")}`,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        },
        status,
        paymentStatus,
        paymentMethod: method,
        accessKey: secret(),
        ticketToken: secret(),
        idempotencyKey: secret(12),
        createdAt,
        updatedAt: createdAt,
        confirmedAt: status === "confirmed" ? createdAt : undefined,
        cancelledAt: status === "cancelled" ? createdAt : undefined,
        cancelReason: status === "cancelled" ? "Customer request (demo)" : undefined,
        seeded: true,
      };
      if (past && status === "confirmed" && rand() < 0.85) {
        booking.redeemedAt = new Date(start - 600_000 + Math.floor(rand() * 900_000)).toISOString();
        booking.redeemedBy = DEMO_ACCOUNTS.staff.email;
        redemptions.push({
          id: `red_seed_${redemptions.length}`,
          at: booking.redeemedAt,
          by: DEMO_ACCOUNTS.staff.email,
          outcome: "admitted",
          bookingId: booking.id,
          inputKind: "qr",
        });
      }
      // Cancelled bookings released their seats.
      if (status === "cancelled") group.forEach((id) => taken.delete(id));
      bookings.push(booking);
    }
  }

  // A few live holds ("another customer is checking out") on upcoming screenings.
  const upcoming = screenings.filter((s) => Date.parse(s.startsAt) > t + 3_600_000).slice(0, 6);
  for (const [i, scr] of upcoming.entries()) {
    const aud = SEED_AUDITORIUMS.find((a) => a.id === scr.auditoriumId)!;
    const blocked = new Set(
      bookings.filter((b) => b.screeningId === scr.id && b.status !== "cancelled").flatMap((b) => b.items.map((x) => x.seatId)),
    );
    const free = parseLayout(aud.rows).filter((s) => !blocked.has(s.id) && s.category === "standard");
    const pick = free.slice(Math.floor(free.length / 2), Math.floor(free.length / 2) + 2).map((s) => s.id);
    if (pick.length < 2) continue;
    holds.push({
      id: `hold_seed_${i}`,
      screeningId: scr.id,
      seatIds: pick,
      keyHash: createHash("sha256").update(secret()).digest("hex"),
      status: "active",
      createdAt: nowIso,
      expiresAt: new Date(t + (90 + i * 15) * 60_000).toISOString(),
      seeded: true,
    });
  }

  // One pending online payment, to show the pending state in admin.
  const pendingScr = upcoming[upcoming.length - 1];
  if (pendingScr) {
    const aud = SEED_AUDITORIUMS.find((a) => a.id === pendingScr.auditoriumId)!;
    const blocked = new Set([
      ...bookings.filter((b) => b.screeningId === pendingScr.id && b.status !== "cancelled").flatMap((b) => b.items.map((x) => x.seatId)),
      ...holds.filter((h) => h.screeningId === pendingScr.id).flatMap((h) => h.seatIds),
    ]);
    const vip = parseLayout(aud.rows).filter((s) => !blocked.has(s.id) && s.category === "vip").slice(0, 2).map((s) => s.id);
    if (vip.length === 2) {
      const q = quoteSeats(vip, aud, pendingScr.prices);
      bookings.push({
        id: `bkg_seed_${bookings.length}`,
        reference: ref(usedRefs),
        screeningId: pendingScr.id,
        items: q.items,
        subtotalCents: q.subtotalCents,
        feesCents: 0,
        totalCents: q.totalCents,
        currency: "USD",
        customer: { name: "Grace Wleh", phone: "+231 770 000 999", email: "grace.wleh@example.com" },
        status: "pending_payment",
        paymentStatus: "pending",
        paymentMethod: "demo_online",
        accessKey: secret(),
        ticketToken: secret(),
        idempotencyKey: secret(12),
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAt: new Date(t + 60 * 60_000).toISOString(),
        seeded: true,
      });
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: nowIso,
    settings: structuredClone(DEFAULT_SETTINGS),
    auditoriums: structuredClone(SEED_AUDITORIUMS),
    movies,
    concessions: structuredClone(SEED_CONCESSIONS),
    screenings,
    holds,
    bookings,
    payments: [],
    redemptions,
    users: [
      {
        id: "usr_admin",
        email: DEMO_ACCOUNTS.admin.email,
        name: "Demo Administrator",
        role: "admin",
        passwordHash: hashPassword(DEMO_ACCOUNTS.admin.password),
      },
      {
        id: "usr_staff",
        email: DEMO_ACCOUNTS.staff.email,
        name: "Demo Box Office",
        role: "staff",
        passwordHash: hashPassword(DEMO_ACCOUNTS.staff.password),
      },
    ],
  };
}
