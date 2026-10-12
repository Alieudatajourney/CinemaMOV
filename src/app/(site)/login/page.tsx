import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/brand/Wordmark";
import { DEMO_ACCOUNTS } from "@/server/passwords";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default function LoginPage() {
  // Only reveal the built-in demo passwords. Passwords set via environment variables are real secrets.
  const customised = !!(process.env.DEMO_ADMIN_PASSWORD || process.env.DEMO_STAFF_PASSWORD);
  const showDemo = process.env.DEMO_SHOW_CREDENTIALS !== "0" && !customised;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Logo height={96} className="mb-6" />
      <p className="eyebrow">Cinema team</p>
      <h1 className="font-display mt-2 text-5xl">Sign in</h1>
      <p className="mt-2 text-fg-muted">Staff check-in and management for Monrovia Cinema Plus.</p>
      <Suspense>
        <LoginForm demo={showDemo ? DEMO_ACCOUNTS : null} />
      </Suspense>
    </div>
  );
}
