-- Monrovia Cinema Plus — storage used by the running app (src/server/store-pg.ts).
-- The app also creates this automatically on first connection; running it by hand is optional.
-- The whole app state is a single JSONB document locked per transaction (SELECT … FOR UPDATE).
-- supabase/schema.sql remains the normalised reference design for a future full migration.

create schema if not exists mcp_private;

create table if not exists mcp_private.app_state (
  id integer primary key,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

-- Not exposed through Supabase's REST/GraphQL APIs (private schema), and locked down anyway:
alter table mcp_private.app_state enable row level security;
revoke all on schema mcp_private from public;
revoke all on schema mcp_private from anon, authenticated;
revoke all on all tables in schema mcp_private from anon, authenticated;
