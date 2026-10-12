import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ScanLine } from "lucide-react";
import { requirePageRole } from "@/server/auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { AdminNav } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/layout/SignOutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Management", template: "%s · Management · Monrovia Cinema Plus" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["admin"], "/admin");
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-white/[0.06] bg-ink-900 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" aria-label="Management overview">
            <Wordmark compact />
          </Link>
          <p className="chip mt-0 lg:mt-4">Management</p>
        </div>
        <div className="px-3 pb-3 lg:px-3">
          <AdminNav />
        </div>
        <div className="hidden px-5 lg:absolute lg:bottom-0 lg:block lg:w-64 lg:pb-6">
          <Link href="/staff" className="btn btn-secondary btn-sm w-full">
            <ScanLine className="h-4 w-4" aria-hidden /> Staff check-in
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm mt-2 w-full">
            <ExternalLink className="h-4 w-4" aria-hidden /> Public site
          </Link>
          <div className="mt-4 border-t border-white/[0.06] pt-4 text-sm">
            <p className="font-semibold">{user.name}</p>
            <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            <SignOutButton className="btn btn-ghost btn-sm -ml-3 mt-2" />
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-xs text-fg-subtle lg:hidden">
          <span>
            {user.name} · {user.email}
          </span>
          <span className="flex gap-2">
            <Link href="/staff" className="btn btn-ghost btn-sm">
              Check-in
            </Link>
            <SignOutButton />
          </span>
        </div>
      </main>
    </div>
  );
}
