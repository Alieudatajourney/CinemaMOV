import { NextResponse } from "next/server";
import { handle } from "@/server/http";
import { SESSION_COOKIE, revokeSessions } from "@/server/auth";

/** Signs out: clears the cookie AND revokes the token server-side so a copied cookie stops working. */
export const POST = handle(async (req) => {
  await revokeSessions(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
