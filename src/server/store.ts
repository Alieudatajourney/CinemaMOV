import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/types";
import { SEED_CONCESSIONS, buildSeedDatabase } from "./seed";
import { reconcile } from "./reconcile";
import { pgLoadForUpdate, pgReplace, pgSave, isPostgresEnabled, withPgTransaction } from "./store-pg";

/**
 * PERSISTENCE
 * -----------
 * Two interchangeable backends behind one `transact` API:
 *
 *  • Postgres (Supabase) — used whenever DATABASE_URL is set (e.g. on Vercel). The database is one
 *    JSONB document, read with `SELECT … FOR UPDATE` inside a transaction, so check-then-write
 *    sequences are atomic across every server instance. See src/server/store-pg.ts.
 *  • JSON file — the zero-setup local demo (default `.data/monrovia-cinema-plus.json`), guarded
 *    by an in-process mutex. Single server process only.
 *
 * Every transaction: lock → load (seeding on first use) → reconcile expired holds/payments →
 * run the operation → persist if anything changed. If the operation throws, nothing is written
 * (the Postgres transaction rolls back; the file is simply not rewritten).
 */

interface StoreGlobal {
  queue: Promise<unknown>;
}

const g = globalThis as unknown as { __mcpStore?: StoreGlobal };
g.__mcpStore ??= { queue: Promise.resolve() };
const state = g.__mcpStore;

export function dataFilePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MCP_DATA_FILE || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "monrovia-cinema-plus.json"));
}

function readFile(): Database | null {
  const file = dataFilePath();
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Database;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function writeFile(db: Database) {
  const file = dataFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  // Windows can briefly lock the destination while another reader has it open.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt < 8 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
        const until = Date.now() + 15 * (attempt + 1);
        while (Date.now() < until) {
          /* brief spin; renames are near-instant */
        }
        continue;
      }
      try {
        fs.unlinkSync(tmp);
      } catch {}
      throw err;
    }
  }
}

/** Additive migrations for documents created by older versions. Returns true if changed. */
function migrate(db: Database): boolean {
  if (!db.concessions) {
    db.concessions = structuredClone(SEED_CONCESSIONS);
    return true;
  }
  return false;
}

function loadOrSeed(existing: Database | null, now: Date): { db: Database; dirty: boolean } {
  if (existing) return { db: existing, dirty: migrate(existing) };
  return { db: buildSeedDatabase(now), dirty: true };
}

/** Serialise work within this process (reduces lock contention; required for the file backend). */
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = state.queue.then(run, run);
  state.queue = next.catch(() => undefined);
  return next;
}

/**
 * Run `fn` with exclusive access to the database. In "write" mode the database is persisted
 * after `fn` returns. If `fn` throws, nothing is written.
 */
export function transact<T>(fn: (db: Database, now: Date) => T, mode: "read" | "write" = "write"): Promise<T> {
  if (isPostgresEnabled()) {
    return enqueue(() =>
      withPgTransaction(async (client) => {
        const now = new Date();
        const { db, dirty: seeded } = loadOrSeed(await pgLoadForUpdate(client), now);
        const reconciled = reconcile(db, now);
        const result = fn(db, now);
        if (seeded || reconciled || mode === "write") await pgSave(client, db);
        return result;
      }),
    );
  }
  return enqueue(async () => {
    const now = new Date();
    const { db, dirty: seeded } = loadOrSeed(readFile(), now);
    const reconciled = reconcile(db, now);
    const result = fn(db, now);
    if (seeded || reconciled || mode === "write") writeFile(db);
    return result;
  });
}

export function readDb<T>(fn: (db: Database, now: Date) => T): Promise<T> {
  return transact(fn, "read");
}

/** Replace the database with fresh demo data. */
export function resetDatabase(): Promise<void> {
  if (isPostgresEnabled()) return enqueue(() => withPgTransaction((client) => pgReplace(client, buildSeedDatabase(new Date()))));
  return enqueue(async () => writeFile(buildSeedDatabase(new Date())));
}
