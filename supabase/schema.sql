-- Monrovia Cinema Plus — reference PostgreSQL / Supabase schema
-- ------------------------------------------------------------------
-- STATUS: reference design for production. The MVP runs on the JSON demo adapter
-- (src/server/store.ts) and does NOT use this schema yet. It mirrors src/lib/types.ts
-- and moves the business invariants into the database, where they belong in production.

create extension if not exists pgcrypto;

create type seat_category  as enum ('standard', 'vip', 'accessible');
create type booking_status as enum ('pending_payment', 'reserved', 'confirmed', 'cancelled', 'expired');
create type payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'void');
create type payment_method as enum ('pay_at_cinema', 'online');
create type hold_status    as enum ('active', 'converted', 'released', 'expired');
create type staff_role     as enum ('admin', 'staff');

create table cinema_settings (
  id                     int primary key default 1 check (id = 1),
  name                   text not null default 'Monrovia Cinema Plus',
  venue                  text not null default 'Monrovia Super Mall',
  address_line           text not null,
  phone                  text not null,
  email                  text not null,
  hours                  text not null,
  hold_minutes           int  not null default 8  check (hold_minutes between 2 and 30),
  pending_payment_minutes int not null default 20,
  max_tickets_per_booking int not null default 8,
  cleaning_buffer_min    int  not null default 15,
  time_zone              text not null default 'Africa/Monrovia'
);

create table staff_users (
  id         uuid primary key default gen_random_uuid(),
  auth_user  uuid unique,                 -- Supabase auth.users.id
  email      text not null unique,
  name       text not null,
  role       staff_role not null
);

create table movies (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  tagline      text not null default '',
  synopsis     text not null,
  genres       text[] not null,
  runtime_min  int not null check (runtime_min between 30 and 300),
  language     text not null,
  rating       text not null check (rating in ('G','PG','PG-13','15','18')),
  release_date date not null,
  status       text not null check (status in ('now_showing','coming_soon')),
  published    boolean not null default false,
  poster_url   text,
  backdrop_url text,
  trailer_url  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table auditoriums (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text not null,
  description text not null default ''
);

create table seats (
  auditorium_id uuid not null references auditoriums(id),
  seat_id       text not null,            -- 'F7' — identical to map and ticket label
  row_label     text not null,
  number        int  not null,
  col           int  not null,
  category      seat_category not null,
  active        boolean not null default true,
  primary key (auditorium_id, seat_id)
);

create table screenings (
  id            uuid primary key default gen_random_uuid(),
  movie_id      uuid not null references movies(id),
  auditorium_id uuid not null references auditoriums(id),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,     -- starts_at + runtime + cleaning buffer
  format        text not null default '2D',
  price_standard_cents   int not null check (price_standard_cents >= 0),
  price_vip_cents        int not null check (price_vip_cents >= 0),
  price_accessible_cents int not null check (price_accessible_cents >= 0),
  status        text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- No two scheduled screenings may overlap in the same auditorium.
create extension if not exists btree_gist;
alter table screenings add constraint screenings_no_overlap
  exclude using gist (auditorium_id with =, tstzrange(starts_at, ends_at) with &&)
  where (status = 'scheduled');

create table seat_holds (
  id           uuid primary key default gen_random_uuid(),
  screening_id uuid not null references screenings(id),
  key_hash     text not null,             -- sha256 of the secret given to the browser
  status       hold_status not null default 'active',
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create table bookings (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,   -- MCP-XXXX-XXXX (random, unpredictable)
  screening_id    uuid not null references screenings(id),
  hold_id         uuid unique references seat_holds(id),   -- one booking per hold (idempotency)
  idempotency_key text not null unique,
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text,
  status          booking_status not null,
  payment_status  payment_status not null,
  payment_method  payment_method not null,
  subtotal_cents  int not null,
  fees_cents      int not null default 0,
  total_cents     int not null,
  access_key_hash text not null,          -- customer ticket link secret (hashed)
  ticket_token_hash text not null unique, -- QR token (hashed); QR carries only the raw token
  expires_at      timestamptz,
  redeemed_at     timestamptz,
  redeemed_by     uuid references staff_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Seats claimed by holds and bookings. One row per (screening, seat) while active:
-- the partial unique index makes double-booking impossible even under concurrency.
create table seat_claims (
  screening_id uuid not null references screenings(id),
  seat_id      text not null,
  hold_id      uuid references seat_holds(id),
  booking_id   uuid references bookings(id),
  category     seat_category not null,
  price_cents  int not null,
  active       boolean not null default true,
  expires_at   timestamptz,               -- null once owned by a reserved/confirmed booking
  created_at   timestamptz not null default now()
);
create unique index seat_claims_one_active_per_seat
  on seat_claims (screening_id, seat_id) where active;

create table payment_attempts (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references bookings(id),
  hold_id         uuid references seat_holds(id),
  provider        text not null,          -- 'demo' | 'orange_money' | 'mtn_momo' | ...
  provider_ref    text,
  outcome         text not null check (outcome in ('succeeded','pending','failed','cancelled')),
  amount_cents    int not null,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);

create table ticket_redemptions (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references bookings(id),
  staff_id    uuid references staff_users(id),
  outcome     text not null,
  created_at  timestamptz not null default now()
);

-- Release expired holds/payments (run from pg_cron every minute, and lazily before reads).
create or replace function release_expired() returns void language sql as $$
  update seat_claims set active = false where active and expires_at is not null and expires_at <= now();
  update seat_holds  set status = 'expired' where status = 'active' and expires_at <= now();
  update bookings    set status = 'expired', payment_status = 'void', updated_at = now()
   where status = 'pending_payment' and expires_at <= now();
$$;

-- Atomic, exactly-once redemption: only one concurrent caller can flip redeemed_at.
create or replace function redeem_ticket(p_token_hash text, p_staff uuid)
returns bookings language plpgsql as $$
declare b bookings;
begin
  update bookings
     set redeemed_at = now(), redeemed_by = p_staff, updated_at = now()
   where ticket_token_hash = p_token_hash
     and status = 'confirmed'
     and redeemed_at is null
  returning * into b;
  insert into ticket_redemptions (booking_id, staff_id, outcome)
  values (b.id, p_staff, case when b.id is null then 'rejected' else 'admitted' end);
  return b;  -- null => caller looks up the booking to report why (used, cancelled, unpaid, invalid)
end $$;

-- Row Level Security: customers never query tables directly; all access goes through
-- server-side functions using the service role (never exposed to the browser).
alter table bookings           enable row level security;
alter table seat_claims        enable row level security;
alter table seat_holds         enable row level security;
alter table payment_attempts   enable row level security;
alter table ticket_redemptions enable row level security;
alter table staff_users        enable row level security;
alter table movies             enable row level security;
alter table screenings         enable row level security;

create policy "public can read published movies" on movies for select using (published);
create policy "public can read scheduled screenings" on screenings for select using (status = 'scheduled');
create policy "staff read bookings" on bookings for select
  using (exists (select 1 from staff_users s where s.auth_user = auth.uid()));
create policy "admins manage movies" on movies for all
  using (exists (select 1 from staff_users s where s.auth_user = auth.uid() and s.role = 'admin'));
