# Monrovia Cinema Plus

Cinema ticket booking and cinema management platform for **Monrovia Cinema Plus**, Monrovia Super Mall, Monrovia, Liberia.

This is a **client pitch prototype (MVP)**. The whole booking journey works end to end: browse films, choose a showtime, pick seats on an animated auditorium map, add snacks and drinks (or skip), check out, receive a QR ticket, have staff validate it at the door, and see the booking in the management dashboard. All of these steps use the same stored booking records.

> **Demo only.** The films are real current and upcoming releases (details and artwork via TMDB, official trailers on YouTube), but showtimes, prices, contact details and bookings are sample data. No real payments are processed and no card or mobile-money details are collected. Orange Money and Lonestar MTN Mobile Money are shown as *"Coming soon — not connected"*.

---

## Quick start

Requirements: **Node.js 20+** (tested on Node 24) and npm.

```bash
npm install
npm run dev            # http://localhost:3000
```

No environment variables or external services are needed. On first request the app creates `.data/monrovia-cinema-plus.json` and fills it with demo data whose schedule starts **today** (five days of screenings).

For a smoother presentation, run the production build:

```bash
npm run build
npm start              # http://localhost:3000
```

### Demo accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Manager (admin) | `admin@monroviacinemaplus.demo` | `PlusAdmin#2026` | `/admin` and `/staff` |
| Box office (staff) | `staff@monroviacinemaplus.demo` | `PlusStaff#2026` | `/staff` only |

The login page has one-click "Use" buttons for both accounts (hide them with `DEMO_SHOW_CREDENTIALS=0`). Change the passwords with the env vars in `.env.example` before sharing any deployment.

### Resetting demo data

The schedule is generated relative to the day you reset it. **Reset before every pitch.**

- In the app: **Management → Settings → Reset demo data**, then type `RESET` to confirm.
- From the terminal (with the server stopped): `npm run demo:reset`.

The admin overview shows a warning when fewer than three days of screenings remain.

---

## Main routes

| Route | Purpose |
|---|---|
| `/` | Homepage: hero carousel, date shortcuts, search and filters, Now Showing, Coming Soon, visit/contact |
| `/movies`, `/movies/[slug]` | Catalogue; film details, trailer, dates (with available/unavailable states), showtimes, prices |
| `/book/[screeningId]` | **Animated seat selection** with live summary |
| `/snacks/[holdId]` | Optional snacks & drinks step (combos, sizes, quantities); **Skip snacks** goes straight to payment |
| `/checkout/[holdId]` | Contact details, payment options, demo outcomes, hold countdown |
| `/booking/[reference]?k=…` | Confirmation and digital ticket (QR, print, download) |
| `/my-tickets` | Look up a booking by reference plus phone number or email; tickets saved on this device |
| `/staff` | Ticket check-in: camera QR scanning plus manual entry |
| `/admin` | Overview, Movies, Screenings, Bookings, Tickets, Settings |

---

## Deploying (Vercel + Supabase)

When `DATABASE_URL` is set, the app stores its data in **Supabase Postgres** instead of the local file (`src/server/store-pg.ts`).
- The whole state is one JSONB document in the private schema `mcp_private`.
- Every request locks it inside a transaction (`SELECT … FOR UPDATE`), so booking rules stay atomic across all of Vercel's serverless instances.
- Row Level Security is on and the schema is not exposed to Supabase's public API.
- The app connects as a least-privilege role (`mcp_app`) that can only read and update that one table.

| Vercel environment variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** URI (port 6543) for the `mcp_app` role |
| `SESSION_SECRET` | 32+ random characters (signs staff sessions) |

`vercel.json` pins functions to `cdg1` (Paris), next to the Supabase project in `eu-west-3`. Without a `DATABASE_URL` the app falls back to the local JSON file, which is fine for `npm run dev`.

## Architecture

- **Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4**, Lucide icons, `motion` (Framer Motion) for UI animation, `qrcode` for QR generation, and `jsQR` as the camera-scanning fallback when the browser has no `BarcodeDetector`.
- Fonts (Cormorant Garamond and Manrope, SIL OFL) are **self-hosted** in `src/app/fonts`, so the app builds and runs offline.
- **Real films**: the catalogue holds current and upcoming releases. Posters and backdrops are stored locally in `public/media/films`, so they work offline. Trailers are the studios' official YouTube videos, embedded rather than downloaded, so **trailers need an internet connection**. Credits and licensing notes are in `public/media/CREDITS.md`. Generated artwork (`src/components/PosterArt.tsx`) is the fallback for any film without an image.
- **Snack photos** are Unsplash-licensed and stored in `public/media/snacks`. Items without a photo get an illustrated placeholder. The menu is managed in **Management → Snacks**.

```
src/
  app/                    routes (public site in (site)/, /staff, /admin, /api/*)
  components/             UI: booking/ (seat map, checkout), ticket/, staff/, admin/, brand/
  lib/                    shared, pure: types, money/time formatting, seat-layout & pricing logic
  server/                 server-only
    store.ts              demo persistence adapter (JSON file, serialised transactions)
    reconcile.ts          expiry of holds / pending payments / unpaid reservations; seat states
    core/booking.ts       holds, checkout, payments, cancellation, lookup  (trusted pricing)
    core/tickets.ts       QR payload, validation, one-time redemption
    core/admin.ts         metrics, movie/screening CRUD, conflict detection, settings, layouts
    core/catalog.ts       public read models
    auth.ts               signed session cookies, role checks
supabase/schema.sql       reference production schema (PostgreSQL / Supabase)
tests/unit, tests/e2e     Vitest and Playwright suites
```

### Business rules and invariants

| Invariant | How it is enforced |
|---|---|
| Seat availability is per screening | `seatStates(db, screeningId)` combines that screening's bookings and active holds |
| No double booking | Holds and checkout re-check availability inside one serialised transaction; concurrency is tested (`tests/unit/store.test.ts`) |
| Trusted prices | Ticket and snack totals are computed server-side from the screening's price table and the concessions menu (`quoteSeats`, `quoteConcessions`). Prices sent by the client are ignored (e2e-tested). A snack that sells out before payment blocks checkout with a clear message |
| Holds expire | Default 8 minutes (configurable). `reconcile()` runs before every transaction, expires holds and lapsed pending payments, and releases seats |
| Idempotent booking | A hold converts to at most one booking, and repeated submits with the same idempotency key replay the recorded outcome |
| Unpredictable identifiers | Booking reference `MCP-XXXX-XXXX` (~39 bits, crypto RNG). QR token, ticket access key and hold key are each 192-bit random secrets |
| QR contains no personal data | Payload is `MCP1:<opaque token>` only |
| Exactly-once redemption | Validation and redemption happen in one serialised transaction. Repeat scans return *Already redeemed*. Tickets for another day are refused (*Different day*) unless staff use the manager override, so a ticket can't be used up before its show |
| Pending vs confirmed | `pending_payment` (not valid for entry, seats held until the window ends) vs `confirmed`/`paid`. Pay-at-Cinema is `reserved`/`unpaid`; staff can collect payment and admit |
| Unpaid reservations | Released automatically when the screening starts |
| Cancellation | Admin cancellation needs explicit confirmation, marks a paid demo payment as refunded and releases the seats. Admitted tickets and started screenings cannot be cancelled. Customers can cancel only unpaid bookings |
| Screening conflicts | Same-auditorium overlaps (runtime plus changeover buffer) are rejected |
| Layout edits | Seats booked or held for upcoming screenings cannot be removed |
| Time zone and money | All times are shown in `Africa/Monrovia`. Money is stored as integer cents and formatted as USD |

### Security model (demo mode)

- **Authorization happens on the server.** Every `/api/admin/*` handler requires the `admin` role and `/api/staff/validate` requires `staff` or `admin`. Admin and staff layouts and pages also check the role on the server. `src/proxy.ts` only does an optimistic redirect to the login page.
- Sessions are HMAC-signed, `httpOnly`, `SameSite=Lax` cookies. The user is re-loaded from storage on every request, so forged cookies are rejected (e2e-tested). Signing out revokes the session on the server (a per-user session version), so a copied cookie stops working.
- The post-login redirect only accepts same-origin paths. Rate limits ignore spoofable forwarding headers unless `MCP_TRUST_PROXY=1`, and login is also limited per account.
- Cross-site state-changing requests are rejected by an `Origin` check. Login, lookup, hold and checkout endpoints are rate-limited per IP.
- Customers reach a booking only through its secret access link, or by reference **plus** matching phone/email. Unknown references and mismatched details get the same response.
- Inputs are validated with Zod on the server. No service keys exist, and nothing privileged is sent to the browser.

### Local demo mode vs production

The demo persistence adapter (`src/server/store.ts`) stores everything in **one JSON file on the server**. That is reliable for a single presenter on one machine, but:

- it supports a **single server process only** (the transaction lock is in memory), so it is not suitable for multiple instances or serverless deployment;
- it has no backups and no audit-grade history;
- rate limits are kept in memory.

For production, move to PostgreSQL/Supabase (`supabase/schema.sql` enforces the same invariants with a unique partial index on active seat claims, an exclusion constraint on overlapping screenings, and an atomic `redeem_ticket` function). See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

---

## Testing

```bash
npm test               # unit/integration tests (Vitest)
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run test:e2e       # Playwright: builds, starts on :3100 with an isolated data file, runs the suite
```

The e2e suite uses your installed **Google Chrome** (`channel: "chrome"`). To use Playwright's bundled Chromium instead, run `npx playwright install chromium` and then `PW_CHANNEL= npm run test:e2e`. Close any server already running on port 3100 first.

What the suites cover is listed in [BUILD_STATUS.md](BUILD_STATUS.md).

## Pitch

A 3–5 minute presentation script is in [PITCH_SCRIPT.md](PITCH_SCRIPT.md).

## Font licences

Cormorant Garamond and Manrope are licensed under the SIL Open Font License 1.1 (see `src/app/fonts/LICENSE-*.txt`).
