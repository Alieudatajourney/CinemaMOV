# Build status — Monrovia Cinema Plus MVP

_Last verified: 12 October 2026, Windows 10, Node 24.14, npm 11.9, Next.js 16.4.0, React 19.3, Google Chrome (Playwright `channel: "chrome"`)._

## Summary

The complete connected application is implemented and working: **Home → Movie details → Showtime → Seat selection → Snacks & drinks (optional) → Checkout → Confirmation → Digital ticket → My Tickets → Staff validation → Admin dashboard**.

**Update (second iteration):**
- Added the optional **Snacks & drinks** step: combos, sizes, quantities, Skip, server-side pricing, sold-out handling, snacks on the ticket and at staff check-in, snack revenue in admin, and a **Management → Snacks** menu editor.
- Replaced the fictional catalogue with **8 real films** (6 now showing, 2 coming soon). Posters and backdrops are stored locally, and the studios' official YouTube trailers play inside the app.
- Fixed a YouTube embed failure ("Video player configuration error") caused by the referrer policy.

**Update (third iteration, UX):**
- **"How many tickets?"** prompt on the seat map (dismissible) and a ticket stepper.
- **Best available**: one tap picks the best block of seats together, about two-thirds of the way back and central. It never spans an aisle, avoids accessible spaces and prefers standard seats over pricier VIP. It falls back to the best individual seats, and the picked seats are scrolled into view on phones. Progress hints ("Select 1 more seat") appear when customising.
- **Sticky pay bar on mobile checkout** with the total, hold timer and Pay/Reserve button.
- **Loading skeletons** for the movie, seat, snacks, checkout and ticket pages, so there is no blank flash between steps. Every step reads and writes the same stored booking records. There is no static or bypassed success screen.

No APK was opened or inspected at any point. The repository contained no APK files.

**Update (bug audit):** Three parallel code reviews (server logic, customer flow, security/admin) plus a crawl of every page at desktop and mobile widths. Fixed, with regression tests:
- *Ticketing:* a ticket for a later day could be admitted and used up early. It is now refused as "Different day", with a manager override. Check-only scans were logged as "admitted" and are now logged as "checked". The camera scanner ignored "Check only" (a stale callback), and "Admit now" skipped the normal flow.
- *Booking states:* a Pay-at-Cinema booking made after the film started expired instantly, so it is now refused. A pending payment could be confirmed after sales closed; the window is now capped at the sales cut-off. Cancelling an expired booking showed a misleading error.
- *Admin data integrity:*
  - Screening edits could point at a missing auditorium, which crashed the public listing. They could also move into the past, or move a screening customers already hold tickets for.
  - Runtime increases could create overlapping screenings.
  - Empty prices were saved as $0.
  - Layout edits could silently move booked seats.
  - "Today's bookings" counted cancelled bookings.
- *Security:*
  - The login redirect could be sent off-site (open redirect).
  - Rate limits could be bypassed with a spoofed `X-Forwarded-For` header.
  - Sign-out didn't revoke the session.
  - Demo passwords were shown even when overridden by environment variables.
- *Customer UI:*
  - The movie browser defaulted to a sold-out or finished "today" late at night.
  - A snack cart over the 30-item limit looked empty and blocked checkout without a reason.
  - The ticket counter could go below the seats already chosen.
  - The footer "Coming Soon" link went nowhere useful, and the mobile menu stayed open on same-page links.
  - The hold timer interrupted screen readers every second.
  - The pending-payment countdown refreshed the page every second.
- *Performance:* the admin overview went from about 2.8 s to about 0.4 s by caching the `Intl` date formatters.

## Implemented features

**Customer**
- Cinematic homepage: rotating hero (pauses on hover/focus; no autoplay with reduced motion), date shortcuts, search, and genre/rating/time-of-day filters, all working. Now Showing and Coming Soon. Visit/contact section with placeholder details clearly flagged. Responsive footer.
- Movie details: generated original poster and backdrop, synopsis, runtime, genres, language, rating explanation, release date, director and cast. Trailer modal with a graceful "Trailer coming soon" fallback. Date strip with available and unavailable states. Showtimes grouped by date and auditorium, with prices and seats left. Price panel.
- **Animated seat map**: curved glowing screen, projector beam, curved seat rows, numbered rows and seats, a centre aisle plus side aisles, Standard/VIP/Accessible categories, and Available/Selected/Occupied/Held states. States use shape and icon (×, clock, wheelchair, crown) as well as colour. Selection pop and ripple, shake with an accessible explanation for invalid taps, an animated count-up total, and animated seat chips. Roving-focus keyboard navigation with arrow keys, Home/End and Enter. Live announcements for screen readers, reduced-motion support, auto-sizing seats (minimum 28 px) with horizontal scrolling only when the hall is too wide, a sticky desktop summary, and a safe-area mobile bottom bar. Availability refreshes every 15 seconds, and seats taken by others are removed from the selection with an explanation.
- Checkout: hold countdown, contact validation with an error summary, payment options (Pay at Cinema; **DEMO** simulated online payment with Approve/Pending/Decline; Orange Money and Lonestar MTN Mobile Money marked *Coming soon — not connected*). Processing overlay, retry after a decline, cancel-and-release, double-submit protection, and expiry handling.
- Confirmation with a success animation. Ticket with branding, poster, date and time (Monrovia), auditorium, seats, venue, reference, booking and payment status, and a QR code from an opaque token. Print layout (shows only the ticket). PNG download, with an SVG fallback. Pending-payment and reserved states with demo gateway controls and customer cancellation.
- My Tickets: lookup by reference plus phone or email (handles Liberian `0…`/`+231` formats), with no information leaked on mismatch. Tickets booked on the device are listed.

**Staff:** `/staff` check-in with camera scanning (BarcodeDetector, falling back to jsQR) and manual entry. Clear results for valid/admitted, already redeemed, cancelled, unpaid (collect payment and admit), payment pending, expired, screening ended and invalid. Check-only mode, scan-next workflow and session history.

**Admin:** Overview (today's bookings, tickets sold, demo revenue, occupancy, 7-day revenue chart, booking status counts, upcoming screenings with occupancy meters, recent bookings, all computed from stored records). Movies (create/edit/publish/unpublish/delete with validation, artwork preview and fallback). Screenings (create/edit with conflict prevention; times in Africa/Monrovia). Bookings (search by reference/name/phone/email, movie, date and status; detail drawer; cancellation behind explicit confirmation that releases seats). Tickets (redemption stats, the shared validator, scan log). Settings (contact details, booking rules, demo payment behaviour, default prices, auditorium layout editor with live preview and validation, reset demo data behind a typed confirmation).

**Platform:** typed models and service boundaries; JSON demo persistence adapter with serialised transactions and rollback on error; server-side authorization; signed sessions; same-origin checks; rate limits; Zod validation; self-hosted fonts; a reference PostgreSQL/Supabase schema.

## Commands run and results

| Command | Result |
|---|---|
| `npm test` (Vitest) | **55 passed** across 3 files (includes snack, best-available and audit regression tests) |
| `npm run typecheck` | **0 errors** |
| `npm run lint` | **0 errors, 0 warnings** |
| `npm run build` | **Succeeded** (production build, Turbopack) |
| `npm run test:e2e` (Playwright, real Chrome, production server) | **15 passed** (12 desktop at 1440×900, 3 mobile on Pixel 7 emulation) |

### Unit and integration tests (`tests/unit`)
- Layout parsing, numbering, categories, validation and text round-trip.
- Seat toggle: select/deselect, rejecting occupied and held seats, ticket limit, no duplicates.
- Pricing: itemised totals, de-duplication, unknown seats rejected.
- Seed data scale and no duplicate active seat bookings.
- Holds: per-screening blocking, taken/duplicate/unknown/limit rejection, contested seats, **expiry releases seats**, secret key required.
- Checkout: confirmed demo payment with server-computed total, **idempotency** (same key and same hold), failed payment keeps the hold and the retry succeeds, pending → confirm, pending → expiry releases seats, Pay at Cinema creates an unpaid reservation, customer validation.
- Lookup with matching and mismatched contact details; **redeem exactly once**; invalid, cancelled and unpaid outcomes; collect-and-admit; cancellation releases seats; customers can cancel unpaid bookings only; admitted tickets can't be cancelled.
- Admin: screening conflict detection, UTC storage of Monrovia times, layout edits blocked for booked seats, metrics match stored payments.
- File store: persistence, **6 concurrent holds on one seat → exactly 1 succeeds**, rollback on error, **5 concurrent scans → exactly 1 admission**.

### End-to-end tests (`tests/e2e`)
1. Full pitch flow: home, search, details, tomorrow's showtime, select 3 seats, deselect 1, occupied-seat rejection message, live total, checkout validation, demo approval, ticket with QR, **persistence across refresh**, ticket download (and a 404 with a wrong key), Back navigation shows the seats as occupied with no duplicate booking, My Tickets (device list, wrong contact rejected, local phone format accepted), staff login, **admit → repeat scan rejected → invalid code rejected**, staff blocked from `/admin`, admin sees the booking as Admitted. No unexpected browser console errors.
2. Declined payment → still on checkout with the hold kept → retry approved. Pending payment → gateway confirm → confirmed.
3. Pay at Cinema → staff sees *Unpaid* → collect and admit.
4. Customer cancels a reservation → seat freed.
5. Cancel and release from checkout → seats freed.
6. Admin pages redirect to login with the deep link preserved. Admin/staff APIs return 401 without a session. A forged cookie gets 401. A staff session gets 403 on admin APIs. Wrong password gets 401.
7. Cross-origin POST is blocked (403).
8. Server rejects occupied seats and duplicate holds, ignores client-supplied prices, concurrent double checkout returns one booking, and booking details are private without the key.
9. Admin: overlapping screening rejected (409 with explanation). Admin cancellation from the drawer frees the seat.
10. Mobile: no horizontal page overflow (home, movies, seats, checkout), mobile menu, sticky bar enables Continue, tap targets ≥ 28 px, **last seat row sits above the sticky bar**, no console errors.
11. Reduced motion: selection still works.
12. Keyboard: arrow keys move focus, and Enter selects or explains.

Manual visual checks were done from screenshots of the homepage (desktop/mobile), movie details, seat map (desktop/mobile), checkout (desktop/mobile), ticket (desktop/mobile), print preview, staff check-in and every admin page. Defects found and fixed this way: a CSS cascade-layer issue (the hamburger showed on desktop), the backdrop pushing the details page down, the print-mode monogram rendering black, a lost deep-link on login, a router navigation race after sign-in, and missing Liberian phone-format normalisation in lookup.

Trailer playback was verified for all 8 films with `scripts/check-trailers.mjs`: the embedded YouTube video started playing with no player error.

## Known limitations
- **Trailers need internet** (official YouTube embeds). Posters, backdrops and snack photos are local.
- **Film artwork** is studio promotional material sourced via TMDB for a private pitch. Before any public launch, obtain it from distributors (see `public/media/CREDITS.md`). Release dates and ratings are US/TMDB values, and Liberian release dates were not checked. Most of the current slate is rated R.
- The popcorn photo is a stylised, shallow-focus shot. A sharper product photo would suit the featured combo better.
- **Demo persistence**: one JSON file and a single server process. It is not suitable for multiple instances or serverless hosting. Rate limits are in memory. See README → *Local demo mode vs production*.
- **No real payments**: the online payment is simulated and labelled DEMO. Mobile money is not connected. No PCI or regulatory compliance is claimed.
- The schedule is relative to the last reset. Reset demo data before a pitch.
- QR camera scanning depends on browser camera permission (it needs HTTPS or localhost). Manual entry always works.
- The PNG ticket download is rendered in the browser. If the browser can't convert it, an SVG ticket downloads instead.
- Notifications (SMS/email) are not implemented. Tickets are retrieved through the link or My Tickets.
- Contact details, hours and parking are placeholders and are marked as such.
- Camera scanning was not exercised by automated tests (no camera in the test environment). Manual and reference validation are covered.
- Accessibility was built in and partially tested (keyboard, reduced motion, labels), but there has been no formal audit with screen-reader users.

## Blockers
None for the pitch. Network access during development was intermittent: Google Fonts fetches failed during one build. Fonts are now self-hosted, so builds no longer need network access.

## Developer helper scripts
`scripts/shot.mjs`, `seat-demo.mjs`, `flow-demo.mjs`, `ops-demo.mjs` and `visual-check.mjs` take screenshots against a running dev server and were used for the visual QA above. `scripts/reset-demo.ts` backs `npm run demo:reset`.
