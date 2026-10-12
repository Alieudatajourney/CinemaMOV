import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/lib/types";
import { SEED_CONCESSIONS, buildSeedDatabase } from "./seed";
import { reconcile } from "./reconcile";

/**
 * DEMO PERSISTENCE ADAPTER
 * ------------------------
 * Stores the whole database as one JSON file on the server (default `.data/monrovia-cinema-plus.json`).
 * Every read and write goes through `transact`, which:
 *   1. waits for an in-process mutex (so check-then-write sequences are atomic),
 *   2. re-reads the file, applies time-based reconciliation (expired holds/payments release seats),
 *   3. runs the operation and, if it mutated anything, writes the file atomically (tmp + rename).
 *
 * Limitations (documented in README): single server process only, not horizontally scalable,
 * no point-in-time recovery. Production should use PostgreSQL (see supabase/schema.sql), where the
 * same invariants are enforced with transactions, unique partial indexes and conditional UPDATEs.
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

function loadOrSeed(now: Date): { db: Database; dirty: boolean } {
  const existing = readFile();
  if (existing) {
    // Additive migration for data files created before the concessions menu existed.
    if (!existing.concessions) {
      existing.concessions = structuredClone(SEED_CONCESSIONS);
      return { db: existing, dirty: true };
    }
    return { db: existing, dirty: false };
  }
  return { db: buildSeedDatabase(now), dirty: true };
}

/**
 * Run `fn` with exclusive access to the database. In "write" mode the database is persisted
 * after `fn` returns. If `fn` throws, nothing is written: the next transaction re-reads the
 * file, so partial mutations are discarded (a simple rollback).
 */
export function transact<T>(fn: (db: Database, now: Date) => T, mode: "read" | "write" = "write"): Promise<T> {
  const run = async () => {
    const now = new Date();
    const { db, dirty: seeded } = loadOrSeed(now);
    const reconciled = reconcile(db, now);
    const result = fn(db, now);
    if (seeded || reconciled || mode === "write") writeFile(db);
    return result;
  };
  const next = state.queue.then(run, run);
  state.queue = next.catch(() => undefined);
  return next;
}

export function readDb<T>(fn: (db: Database, now: Date) => T): Promise<T> {
  return transact(fn, "read");
}

/** Replace the database with fresh demo data. */
export function resetDatabase(): Promise<void> {
  const run = async () => {
    writeFile(buildSeedDatabase(new Date()));
  };
  const next = state.queue.then(run, run);
  state.queue = next.catch(() => undefined);
  return next;
}
