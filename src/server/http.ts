import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { ServiceError, fail } from "./errors";

/** Wrap a route handler: maps ServiceError/ZodError to consistent JSON error responses. */
export function handle<C>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof ServiceError) {
        return NextResponse.json({ error: { code: err.code, message: err.message, ...err.details } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".");
          if (!fields[key]) fields[key] = issue.message;
        }
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: err.issues[0]?.message ?? "Invalid input.", fields } },
          { status: 400 },
        );
      }
      console.error("[api] unexpected error", err);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    fail("BAD_REQUEST", "Request body must be JSON.");
  }
  return schema.parse(json);
}

/**
 * CSRF defence in depth (cookies are already SameSite=Lax): reject state-changing requests whose
 * Origin header names a different host.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) fail("FORBIDDEN", "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    fail("FORBIDDEN", "Cross-site request blocked.");
  }
}

// Simple fixed-window rate limiter (per process). Production: use a shared store (e.g. Redis).
const g = globalThis as unknown as { __mcpRate?: Map<string, { count: number; reset: number }> };
g.__mcpRate ??= new Map();
/**
 * Client address for rate limiting. Forwarding headers are client-controlled, so they are only
 * trusted when MCP_TRUST_PROXY=1 (i.e. a known reverse proxy sets them), and then we take the
 * address the proxy appended (the right-most hop), not the spoofable left-most one.
 */
function clientKey(req: NextRequest): string {
  if (process.env.MCP_TRUST_PROXY === "1") {
    const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    return hops.at(-1) || req.headers.get("x-real-ip") || "unknown";
  }
  return "direct";
}

export function rateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number, subject?: string) {
  if (process.env.MCP_DISABLE_RATE_LIMIT === "1") return; // automated test runs only
  const key = subject ? `${bucket}:subject:${subject}` : `${bucket}:${clientKey(req)}`;
  const now = Date.now();
  const entry = g.__mcpRate!.get(key);
  if (!entry || entry.reset < now) {
    g.__mcpRate!.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) fail("RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
}
