"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { api, type ApiError } from "@/lib/client-store";

type Demo = { admin: { email: string; password: string }; staff: { email: string; password: string } } | null;

export function LoginForm({ demo }: { demo: Demo }) {
  const params = useSearchParams();
  const rawNext = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("denied") ? "Your account doesn't have access to that area. Sign in with a different account." : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: { role: string } }>("/api/auth/login", { method: "POST", json: { email, password } });
      const next = safeNext(rawNext); // evaluated in the browser only
      const dest = r.user.role === "staff" && next.startsWith("/admin") ? "/staff" : next;
      // Full navigation so every server component re-renders with the new session.
      window.location.assign(dest);
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="surface mt-8 space-y-4 p-6">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <KeyRound className="h-5 w-5" aria-hidden />}
          Sign in
        </button>
      </form>
      {demo && (
        <div className="mt-6 rounded-2xl border border-warning-400/30 bg-warning-700/20 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-warning-400">
            <span className="demo-badge">DEMO</span> Demonstration accounts
          </p>
          <ul className="mt-3 space-y-3">
            {(["admin", "staff"] as const).map((role) => (
              <li key={role} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold capitalize text-fg">{role === "admin" ? "Manager (admin)" : "Box office (staff)"}</span>
                  <span className="font-mono text-xs text-fg-muted">
                    {demo[role].email} · {demo[role].password}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEmail(demo[role].email);
                    setPassword(demo[role].password);
                  }}
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-subtle">Change these with environment variables before sharing a deployment.</p>
        </div>
      )}
    </>
  );
}

/**
 * Only same-origin paths may be used as the post-login destination. Browsers treat "/\evil.example"
 * and paths containing tabs/newlines as cross-origin, so reject those and compare origins.
 */
function safeNext(raw: string | null, origin = window.location.origin): string {
  const fallback = "/admin";
  if (!raw || !raw.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
