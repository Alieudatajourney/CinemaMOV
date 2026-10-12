"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { CalendarClock, Clapperboard, LayoutDashboard, Popcorn, ReceiptText, Settings, TicketCheck } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/movies", label: "Movies", icon: Clapperboard },
  { href: "/admin/screenings", label: "Screenings", icon: CalendarClock },
  { href: "/admin/bookings", label: "Bookings", icon: ReceiptText },
  { href: "/admin/tickets", label: "Tickets", icon: TicketCheck },
  { href: "/admin/snacks", label: "Snacks", icon: Popcorn },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Management" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible [scrollbar-width:none]">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-gold-400/12 text-gold-200" : "text-fg-muted hover:bg-white/5 hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
