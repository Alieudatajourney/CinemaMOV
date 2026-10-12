"use client";
import { LogOut } from "lucide-react";

export function SignOutButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full page load so no server-rendered staff/admin content survives in the client router cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden /> Sign out
    </button>
  );
}
