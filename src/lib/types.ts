// Domain models for Monrovia Cinema Plus.
// Money is always stored as integer US cents. Instants are ISO-8601 UTC strings;
// they are always *displayed* in Africa/Monrovia.

export type SeatCategory = "standard" | "vip" | "accessible";

/**
 * A row in an auditorium layout. `pattern` is read left→right:
 *   S = standard seat, V = VIP seat, A = accessible (wheelchair / companion) space,
 *   _ = aisle, . = empty floor (no seat).
 * Seats are numbered 1..n from the left, counting only seat characters.
 */
export interface AuditoriumRow {
  label: string;
  pattern: string;
}

export interface Auditorium {
  id: string;
  name: string;
  shortName: string;
  description: string;
  rows: AuditoriumRow[];
}

export interface SeatDef {
  id: string; // e.g. "F7" — identical to the label shown on the map and ticket
  row: string;
  number: number;
  category: SeatCategory;
  col: number; // grid column index including aisles/gaps
}

export type AgeRating = "G" | "PG" | "PG-13" | "R" | "NR" | "15" | "18";
export type MovieStatus = "now_showing" | "coming_soon";
export type PosterMotif = "orbit" | "waves" | "sun" | "shards" | "rings" | "grid" | "palms" | "stars";

export interface MovieArt {
  hueA: number;
  hueB: number;
  motif: PosterMotif;
}

export interface Movie {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  runtimeMin: number;
  language: string;
  rating: AgeRating;
  releaseDate: string; // YYYY-MM-DD
  status: MovieStatus;
  published: boolean;
  director: string;
  cast: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  art: MovieArt;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTable {
  standard: number; // cents
  vip: number;
  accessible: number;
}

export type ScreeningFormat = "2D" | "3D";

export interface Screening {
  id: string;
  movieId: string;
  auditoriumId: string;
  startsAt: string;
  format: ScreeningFormat;
  prices: PriceTable;
  status: "scheduled" | "cancelled";
  createdAt: string;
}

// ── Concessions (snacks & drinks) ───────────────────────────────────────

export type ConcessionCategory = "combos" | "popcorn" | "drinks" | "snacks" | "sweets";

export interface ConcessionVariant {
  id: string; // e.g. "m"
  label: string; // e.g. "Medium"
  priceCents: number;
}

export interface ConcessionItem {
  id: string;
  name: string;
  description: string;
  category: ConcessionCategory;
  imageUrl?: string;
  imageCredit?: string;
  available: boolean;
  featured?: boolean;
  variants: ConcessionVariant[];
}

/** What the customer chose (stored on the hold; priced by the server). */
export interface ConcessionSelection {
  itemId: string;
  variantId: string;
  qty: number;
}

/** A priced concession line, frozen onto the booking at checkout. */
export interface ConcessionLine extends ConcessionSelection {
  name: string;
  variantLabel: string;
  unitCents: number;
  lineCents: number;
}

export type HoldStatus = "active" | "converted" | "released" | "expired";

export interface SeatHold {
  id: string;
  screeningId: string;
  seatIds: string[];
  keyHash: string; // sha256 of the secret hold key given to the customer's browser
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
  bookingId?: string;
  extras?: ConcessionSelection[];
  seeded?: boolean;
}

export interface TicketItem {
  seatId: string;
  category: SeatCategory;
  priceCents: number;
}

/**
 * pending_payment — online (demo) payment awaiting confirmation; seats blocked until expiresAt.
 * reserved        — Pay at Cinema; seats blocked, payment collected at the box office.
 * confirmed       — paid; ticket valid for admission.
 * cancelled       — cancelled by customer/staff; seats released.
 * expired         — hold/payment window elapsed; seats released.
 */
export type BookingStatus = "pending_payment" | "reserved" | "confirmed" | "cancelled" | "expired";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded" | "void";
export type PaymentMethod = "pay_at_cinema" | "demo_online";

export interface Customer {
  name: string;
  phone: string;
  email?: string;
}

export interface Booking {
  id: string;
  reference: string; // MCP-XXXX-XXXX
  screeningId: string;
  holdId?: string;
  items: TicketItem[];
  concessions?: ConcessionLine[];
  /** Tickets + concessions, before fees. */
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency: "USD";
  customer: Customer;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  accessKey: string; // secret used in the customer's ticket URL
  ticketToken: string; // opaque secret encoded in the QR code
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string; // pending payment window
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  redeemedAt?: string;
  redeemedBy?: string;
  concessionsCollectedAt?: string;
  seeded?: boolean;
}

export type PaymentOutcome = "succeeded" | "pending" | "failed" | "cancelled";

export interface PaymentAttempt {
  id: string;
  reference: string; // DEMO-PAY-xxxx
  holdId: string;
  bookingId?: string;
  method: PaymentMethod;
  outcome: PaymentOutcome;
  amountCents: number;
  idempotencyKey: string;
  createdAt: string;
  note?: string;
}

export type ValidationOutcome =
  | "admitted"
  | "already_redeemed"
  | "cancelled"
  | "unpaid"
  | "pending_payment"
  | "expired"
  | "screening_ended"
  | "not_today"
  | "invalid";

export interface RedemptionRecord {
  id: string;
  at: string;
  by: string; // staff email
  outcome: ValidationOutcome | "checked"; // "checked" = validated in check-only mode, not admitted
  bookingId?: string;
  inputKind: "qr" | "token" | "reference" | "unknown";
}

export type Role = "admin" | "staff";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string; // scrypt$salt$hash
  /** Incremented on sign-out; sessions signed with an older version are rejected. */
  sessionVersion?: number;
}

export type DemoPaymentMode = "customer_choice" | "always_succeed" | "always_pending" | "always_fail" | "random";

export interface CinemaSettings {
  name: string;
  venue: string;
  city: string;
  country: string;
  addressLine: string;
  phone: string;
  email: string;
  hours: string;
  mapUrl: string;
  contactIsPlaceholder: boolean;
  holdMinutes: number;
  pendingPaymentMinutes: number;
  maxTicketsPerBooking: number;
  cleaningBufferMin: number;
  demoPaymentMode: DemoPaymentMode;
  defaultPrices: PriceTable;
}

export interface Database {
  schemaVersion: number;
  seededAt: string;
  settings: CinemaSettings;
  auditoriums: Auditorium[];
  movies: Movie[];
  concessions: ConcessionItem[];
  screenings: Screening[];
  holds: SeatHold[];
  bookings: Booking[];
  payments: PaymentAttempt[];
  redemptions: RedemptionRecord[];
  users: User[];
}

export type SeatState = "available" | "occupied" | "held";
