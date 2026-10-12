import Link from "next/link";
import { Wordmark } from "../brand/Wordmark";

export function SiteFooter({ venue = "Monrovia Super Mall, Monrovia, Liberia" }: { venue?: string }) {
  return (
    <footer className="no-print mt-24 border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">{venue}</p>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-fg-subtle">
            Product demonstration. Showtimes, prices, contact details and bookings are sample data and do not represent actual cinema
            operations. No real payments are processed. Film information and artwork courtesy of TMDB and the film distributors; trailers
            via YouTube.
          </p>
        </div>
        <FooterCol title="Explore" links={[["Now Showing", "/movies"], ["Coming Soon", "/movies#coming-soon"], ["Showtimes", "/movies#showtimes"]]} />
        <FooterCol title="Your visit" links={[["My Tickets", "/my-tickets"], ["Location & contact", "/#visit"]]} />
        <FooterCol title="Cinema team" links={[["Staff check-in", "/staff"], ["Management", "/admin"]]} />
      </div>
      <div className="border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Monrovia Cinema Plus · All times shown in Monrovia time (GMT)</span>
          <span>Prices in US dollars (USD)</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-fg-muted transition-colors hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
