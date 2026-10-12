import Link from "next/link";
import { requirePageRole } from "@/server/auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { SignOutButton } from "@/components/layout/SignOutButton";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["staff", "admin"], "/staff");
  return (
    <>
      <header className="border-b border-white/[0.06] bg-ink-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Monrovia Cinema Plus — public site">
              <Wordmark compact />
            </Link>
            <span className="chip hidden sm:inline-flex">Staff check-in</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden text-fg-muted md:inline">{user.name}</span>
            {user.role === "admin" && (
              <Link href="/admin" className="btn btn-ghost btn-sm">
                Management
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
