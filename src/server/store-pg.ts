import "server-only";
import { Pool, type PoolClient } from "pg";
import type { Database } from "@/lib/types";

/**
 * Supabase / PostgreSQL backend for the store.
 *
 * The whole application state is one JSONB document in `mcp_private.app_state`. Each transaction
 * locks that row (`SELECT … FOR UPDATE`), so concurrent requests on different serverless
 * instances are serialised by the database — no double bookings, exactly-once redemption.
 *
 * The table lives in a private schema that Supabase does not expose through its REST/GraphQL API,
 * and Row Level Security is enabled with no policies, so the public anon/authenticated keys can
 * never read customer data. Only this server (connecting as the database owner) can.
 *
 * Connection: set DATABASE_URL to Supabase's *Transaction pooler* URI (port 6543), which is the
 * recommended option for serverless hosts such as Vercel.
 */

const DOC_ID = 1;

const g = globalThis as unknown as { __mcpPgPool?: Pool; __mcpPgReady?: Promise<void> };

export function isPostgresEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

function pool(): Pool {
  if (!g.__mcpPgPool) {
    const url = process.env.DATABASE_URL!;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__mcpPgPool = new Pool({
      connectionString: url,
      // Supabase requires TLS. Its pooler certificate chain isn't in Node's default store, so
      // encryption is enforced without CA pinning (set DATABASE_CA to pin it in production).
      ssl: local ? undefined : process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return g.__mcpPgPool;
}

/** Create the schema/table on first use (idempotent). Mirrors supabase/migrations/0001_app_state.sql. */
function ensureSchema(): Promise<void> {
  g.__mcpPgReady ??= (async () => {
    const client = await pool().connect();
    try {
      // Already provisioned (e.g. by the migration, for a least-privilege app role): nothing to do.
      const exists = await client.query<{ t: string | null }>("select to_regclass('mcp_private.app_state')::text as t");
      if (exists.rows[0]?.t) return;
      await client.query(`
        create schema if not exists mcp_private;
        create table if not exists mcp_private.app_state (
          id integer primary key,
          doc jsonb not null,
          updated_at timestamptz not null default now()
        );
        alter table mcp_private.app_state enable row level security;
        revoke all on schema mcp_private from public;
        do $$ begin
          if exists (select 1 from pg_roles where rolname = 'anon') then
            revoke all on schema mcp_private from anon, authenticated;
            revoke all on all tables in schema mcp_private from anon, authenticated;
          end if;
        end $$;
      `);
    } finally {
      client.release();
    }
  })().catch((err) => {
    g.__mcpPgReady = undefined; // retry on the next request
    throw err;
  });
  return g.__mcpPgReady;
}

export async function withPgTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Load the document with a row lock held until commit. Returns null if it doesn't exist yet. */
export async function pgLoadForUpdate(client: PoolClient): Promise<Database | null> {
  const res = await client.query<{ doc: Database }>("select doc from mcp_private.app_state where id = $1 for update", [DOC_ID]);
  if (res.rows[0]) return res.rows[0].doc;
  // First use: take a transaction-scoped advisory lock so only one instance seeds.
  await client.query("select pg_advisory_xact_lock(4206001)");
  const again = await client.query<{ doc: Database }>("select doc from mcp_private.app_state where id = $1 for update", [DOC_ID]);
  return again.rows[0]?.doc ?? null;
}

export async function pgSave(client: PoolClient, db: Database): Promise<void> {
  await client.query(
    `insert into mcp_private.app_state (id, doc, updated_at) values ($1, $2::jsonb, now())
     on conflict (id) do update set doc = excluded.doc, updated_at = now()`,
    [DOC_ID, JSON.stringify(db)],
  );
}

export async function pgReplace(client: PoolClient, db: Database): Promise<void> {
  await client.query("select pg_advisory_xact_lock(4206001)");
  await client.query("select 1 from mcp_private.app_state where id = $1 for update", [DOC_ID]);
  await pgSave(client, db);
}
