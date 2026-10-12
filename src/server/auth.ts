import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";
import { fail } from "./errors";
import { safeEqual } from "./ids";
import { verifyPassword } from "./passwords";
import { readDb, transact } from "./store";

/**
 * Server-side sessions: an HMAC-signed, httpOnly, SameSite=Lax cookie carrying the user id and
 * expiry. Every privileged page and API route re-verifies the signature AND re-loads the user
 * from the database — hiding links or client-side guards is never relied on for authorization.
 */

export const SESSION_COOKIE = "mcp_session";
const SESSION_HOURS = 12;

let cachedSecret: string | null = null;
function sessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && process.env.MCP_REQUIRE_SECRET === "1") {
    throw new Error("SESSION_SECRET must be set (32+ characters).");
  }
  if (cachedSecret) return cachedSecret;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] SESSION_SECRET is missing or shorter than 32 characters; using a generated local secret (demo only).");
  }
  // Local demo convenience: generate once and persist next to the data file (never committed).
  const file = path.join(/*turbopackIgnore: true*/ path.dirname(path.resolve(/*turbopackIgnore: true*/ process.env.MCP_DATA_FILE || ".data/x.json")), "session-secret");
  try {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
  } catch {
    cachedSecret = randomBytes(32).toString("base64url");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, version = 0, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, ver: version, exp: now + SESSION_HOURS * 3_600_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined, now = Date.now()): { uid: string; ver: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; ver?: number; exp: number };
    if (typeof data.uid !== "string" || typeof data.exp !== "number" || data.exp < now) return null;
    return { uid: data.uid, ver: typeof data.ver === "number" ? data.ver : 0 };
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const parsed = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!parsed) return null;
  return readDb((db) => {
    const u = db.users.find((x) => x.id === parsed.uid);
    // Reject sessions issued before the user's last sign-out.
    if (!u || (u.sessionVersion ?? 0) !== parsed.ver) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  });
}

function allowed(user: SessionUser, roles: Role[]) {
  return roles.includes(user.role);
}

/** For API route handlers: throws 401/403 ServiceErrors. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) fail("UNAUTHORIZED", "Please sign in.");
  if (!allowed(user, roles)) fail("FORBIDDEN", "Your account does not have access to this area.");
  return user;
}

/** For server-rendered pages: redirects to the login screen. */
export async function requirePageRole(roles: Role[], next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!allowed(user, roles)) redirect(`/login?next=${encodeURIComponent(next)}&denied=1`);
  return user;
}

export async function authenticate(email: string, password: string): Promise<(SessionUser & { sessionVersion: number }) | null> {
  const user = await readDb((db) => db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null);
  // Always run a hash comparison to keep timing similar for unknown emails.
  const ok = verifyPassword(password, user?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion ?? 0 };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.MCP_INSECURE_COOKIES !== "1",
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};

/** Invalidate every existing session for the signed-in user (used by sign-out). */
export async function revokeSessions(token: string | undefined) {
  const parsed = parseSessionToken(token);
  if (!parsed) return;
  await transact((db) => {
    const u = db.users.find((x) => x.id === parsed.uid);
    if (u && (u.sessionVersion ?? 0) === parsed.ver) u.sessionVersion = parsed.ver + 1;
  });
}
