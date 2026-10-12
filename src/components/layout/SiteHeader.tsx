"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Menu, Ticket, X } from "lucide-react";
import { Wordmark } from "../brand/Wordmark";

const NAV = [
  { href: "/movies", label: "Movies" },
  { href: "/my-tickets", label: "My Tickets" },
  { href: "/#visit", label: "Visit" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header
      className={clsx(
        "no-print sticky top-0 z-40 h-[var(--header-h)] transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled || open ? "border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-gold-400 focus:px-3 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Monrovia Cinema Plus — home" className="rounded-lg">
          <Wordmark priority />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = n.href !== "/#visit" && pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white/[0.07] text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/movies#showtimes" className="btn btn-primary btn-sm hidden sm:inline-flex">
            <Ticket className="h-4 w-4" aria-hidden />
            Book Tickets
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="fade-up border-b border-white/[0.06] bg-ink-950/95 px-4 pb-5 pt-2 backdrop-blur-xl md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-base text-fg hover:bg-white/5">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/movies#showtimes" onClick={() => setOpen(false)} className="btn btn-primary mt-3 w-full">
            <Ticket className="h-4 w-4" aria-hidden /> Book Tickets
          </Link>
        </nav>
      )}
    </header>
  );
}
