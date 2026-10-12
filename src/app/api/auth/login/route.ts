import { NextResponse } from "next/server";
import { z } from "zod";
import { body, handle, rateLimit } from "@/server/http";
import { fail } from "@/server/errors";
import { SESSION_COOKIE, authenticate, createSessionToken, sessionCookieOptions } from "@/server/auth";

const input = z.object({ email: z.string().trim().min(3).max(120), password: z.string().min(1).max(200) });

export const POST = handle(async (req) => {
  rateLimit(req, "login", 10, 60_000);
  const { email, password } = await body(req, input);
  // Per-account limit as well, so guessing one account's password can't be spread across addresses.
  rateLimit(req, "login-account", 10, 15 * 60_000, email.toLowerCase());
  const user = await authenticate(email, password);
  if (!user) fail("UNAUTHORIZED", "Incorrect email or password.");
  const res = NextResponse.json({ user: { name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionVersion), sessionCookieOptions);
  return res;
});
