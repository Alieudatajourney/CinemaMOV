import Link from "next/link";
import { Logo } from "@/components/brand/Wordmark";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Logo height={120} />
      <p className="eyebrow mt-6">404 · Monrovia Cinema Plus</p>
      <h1 className="font-display mt-3 text-5xl">This reel is missing</h1>
      <p className="mt-3 max-w-md text-fg-muted">The page you were looking for doesn&apos;t exist or is no longer showing.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-primary">
          Back to Home
        </Link>
        <Link href="/movies" className="btn btn-secondary">
          Browse movies
        </Link>
      </div>
    </main>
  );
}
