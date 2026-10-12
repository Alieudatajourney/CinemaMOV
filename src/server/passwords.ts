import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Documented demo credentials. Override with env vars for any shared deployment. */
export const DEMO_ACCOUNTS = {
  admin: {
    email: process.env.DEMO_ADMIN_EMAIL || "admin@monroviacinemaplus.demo",
    password: process.env.DEMO_ADMIN_PASSWORD || "PlusAdmin#2026",
  },
  staff: {
    email: process.env.DEMO_STAFF_EMAIL || "staff@monroviacinemaplus.demo",
    password: process.env.DEMO_STAFF_PASSWORD || "PlusStaff#2026",
  },
};
