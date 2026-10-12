import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-store-"));
process.env.MCP_DATA_FILE = path.join(dir, "db.json");

const { transact, readDb, resetDatabase } = await import("@/server/store");
const { createHold, checkout } = await import("@/server/core/booking");
const { validateTicket } = await import("@/server/core/tickets");
const { seatStates } = await import("@/server/reconcile");
const { parseLayout } = await import("@/lib/seating");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

beforeAll(async () => {
  await resetDatabase();
});

async function aFreeSeat() {
  return readDb((db, now) => {
    const scr = db.screenings.find((s) => Date.parse(s.startsAt) > now.getTime() + 3 * 3600_000)!;
    const aud = db.auditoriums.find((a) => a.id === scr.auditoriumId)!;
    const states = seatStates(db, scr.id, now);
    return { screeningId: scr.id, seat: parseLayout(aud.rows).find((s) => !states.has(s.id))!.id };
  });
}

describe(`store transactions (${process.env.DATABASE_URL ? "Postgres" : "file"} backend)`, () => {
  it("persists across reads", async () => {
    if (!process.env.DATABASE_URL) expect(fs.existsSync(process.env.MCP_DATA_FILE!)).toBe(true);
    const name = await readDb((db) => db.settings.name);
    expect(name).toBe("Monrovia Cinema Plus");
  });

  it("serialises concurrent holds: exactly one customer gets a contested seat", async () => {
    const { screeningId, seat } = await aFreeSeat();
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () => transact((db, now) => createHold(db, now, { screeningId, seatIds: [seat] }))),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((a) => a.status === "rejected")).toHaveLength(5);
  });

  it("rolls back a failed transaction", async () => {
    const before = await readDb((db) => db.movies.length);
    await expect(
      transact((db) => {
        db.movies = [];
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await readDb((db) => db.movies.length)).toBe(before);
  });

  it("redeems exactly once under concurrent scans", async () => {
    const { screeningId, seat } = await aFreeSeat();
    const { hold, holdKey } = await transact((db, now) => createHold(db, now, { screeningId, seatIds: [seat] }));
    const r = await transact((db, now) =>
      checkout(db, now, { holdId: hold.id, holdKey, idempotencyKey: "store-idem-1", method: "demo_online", demoOutcome: "succeeded", customer: { name: "Scan Twice", phone: "+231 77 000 3333", email: undefined } }),
    );
    if (r.kind !== "booking") throw new Error("expected booking");
    const scans = await Promise.all(
      Array.from({ length: 5 }, () => transact((db, now) => validateTicket(db, now, { code: r.reference, admit: true, collectPayment: false, allowOtherDay: true }, "staff@test"))),
    );
    expect(scans.filter((s) => s.outcome === "admitted")).toHaveLength(1);
    expect(scans.filter((s) => s.outcome === "already_redeemed")).toHaveLength(4);
  });
});
