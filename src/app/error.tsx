"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">Monrovia Cinema Plus</p>
      <h1 className="font-display mt-3 text-5xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-fg-muted">Please try again. Your bookings are safe — nothing was charged.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
