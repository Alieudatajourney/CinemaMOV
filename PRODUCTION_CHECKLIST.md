# Production deployment and real payments: checklist

This MVP is a **pitch prototype**. It is **not production-ready, not PCI-compliant, and not integrated with any real payment or mobile-money provider.** The items below are required before taking real customers or money.

## Data and infrastructure
- [ ] Replace the JSON demo adapter (`src/server/store.ts`) with PostgreSQL/Supabase using `supabase/schema.sql` as the starting point (seat-claim partial unique index, screening overlap exclusion constraint, atomic `redeem_ticket`).
- [ ] Wrap hold → checkout → payment confirmation in database transactions (`SELECT … FOR UPDATE` / conditional `UPDATE … RETURNING`).
- [ ] Schedule `release_expired()` (pg_cron or a worker) every minute, in addition to the lazy expiry before reads.
- [ ] Automated backups, point-in-time recovery, and a migration tool (e.g. Supabase migrations).
- [ ] Hash the stored ticket tokens and access keys (the schema stores hashes; the demo stores raw secrets).
- [ ] Move rate limiting to a shared store (Redis/Upstash) or the edge/WAF.
- [ ] Deploy to a host that supports the chosen database (Vercel + Supabase, or a container platform). Set `SESSION_SECRET` and `MCP_REQUIRE_SECRET=1`.
- [ ] HTTPS only, HSTS, a Content-Security-Policy, and monitoring/alerting (errors, uptime, slow queries).

## Identity and access
- [ ] Replace the demo accounts with real staff accounts (Supabase Auth or similar): unique users, strong passwords or SSO, MFA for admins, and password reset.
- [ ] Remove the demo credentials panel (`DEMO_SHOW_CREDENTIALS=0`) and the seeded passwords.
- [ ] Audit log for admin actions (cancellations, refunds, price/schedule/layout changes).
- [ ] Session revocation and shorter admin session lifetimes.

## Payments (Orange Money, Lonestar MTN MoMo, cards)
- [ ] Commercial agreements and sandbox credentials with each provider (Orange Money Liberia, Lonestar Cell MTN MoMo, a card acquirer/aggregator if cards are needed).
- [ ] Server-side payment initiation only. Provider secrets live in server environment variables and are never sent to the browser.
- [ ] Use hosted or redirect flows, or the provider's push-to-phone (USSD/STK) confirmation, so the app **never handles PINs or card numbers**. This keeps PCI scope minimal (SAQ A).
- [ ] Webhook endpoint with **signature verification**, idempotency on the provider transaction ID, and replay protection. Confirm bookings only from verified callbacks or a server-side status query, never from the browser.
- [ ] Reconciliation job: pending payments vs provider reports. Handle late success after expiry (auto-refund or rebook).
- [ ] Refund flow through the provider API, partial refunds, and finance reporting/export.
- [ ] Remove or hide the demo payment simulator and the customer "simulate confirmation" controls.
- [ ] Decide on currency handling (USD and/or LRD), exchange rates, receipts, and tax/VAT requirements under Liberian regulations.

## Cinema operations
- [ ] Verify and enter real details: address, phone, email, opening hours, map link. Untick "placeholder" in Settings.
- [ ] Replace the demo artwork (sourced via TMDB for the pitch) with artwork and trailers from the distributors' press kits under the cinema's exhibition agreements. Confirm Liberian release dates and local classifications. If you use the TMDB API for metadata, follow its attribution terms.
- [ ] Concessions: real menu, prices and photos; stock and sold-out handling linked to the counter's point of sale; a "mark collected" step at the counter; kitchen/counter display of pre-orders per screening.
- [ ] Real auditorium layouts, seat numbering convention, accessible-seating policy and prices.
- [ ] Box-office (walk-in) sales screen, cash handling and end-of-day reports.
- [ ] Policy decisions: refund and cancellation rules, release time for unpaid reservations, ticket limits, child/concession ticket types.
- [ ] Hardware: test scanning with the actual entrance devices, lighting and phone screens; consider dedicated scanners.

## Customer communication and legal
- [ ] SMS/WhatsApp and email confirmations with the ticket link (e.g. via an SMS gateway serving Liberian networks).
- [ ] Privacy policy, terms of sale and data-retention policy compliant with Liberian law; a consent notice for contact details.
- [ ] Accessibility audit (WCAG 2.2 AA) with real assistive-technology users.
- [ ] Load test for opening-night peaks (concurrent seat selection on a single screening).
- [ ] Penetration test before launch.
