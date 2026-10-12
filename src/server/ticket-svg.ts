import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CinemaSettings } from "@/lib/types";
import { CATEGORY_LABEL, formatDateLong, formatTime, formatUSD } from "@/lib/format";
import type { BookingView } from "./core/booking";
import { describeLine } from "@/lib/concessions";
import { ticketQrSvg } from "./qr";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STATUS_TEXT: Record<string, string> = {
  confirmed: "CONFIRMED · PAID",
  reserved: "RESERVED · PAY AT CINEMA",
  pending_payment: "PAYMENT PENDING — NOT VALID YET",
  cancelled: "CANCELLED — NOT VALID",
  expired: "EXPIRED — NOT VALID",
};

/** Inline a local poster (public/media/…) as a data URI so the downloaded file stays self-contained. */
function localPosterDataUri(url?: string): string | null {
  if (!url || !url.startsWith("/media/") || url.includes("..")) return null;
  try {
    const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", url);
    return `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Self-contained SVG ticket (no external fonts/images) — downloadable and convertible to PNG. */
export async function renderTicketSvg(v: BookingView, settings: CinemaSettings): Promise<string> {
  const qr = (await ticketQrSvg(v.ticketToken)).replace(/<\?xml[^>]*>/, "");
  const qrInner = qr.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const viewBox = /viewBox="([^"]+)"/.exec(qr)?.[1] ?? "0 0 33 33";
  const seats = v.items.map((i) => i.seatId).join(", ");
  const cats = Object.entries(
    v.items.reduce<Record<string, number>>((a, i) => ((a[i.category] = (a[i.category] ?? 0) + 1), a), {}),
  )
    .map(([c, n]) => `${n} × ${CATEGORY_LABEL[c]}`)
    .join("  ·  ");
  const snacksFull = v.concessions.map(describeLine).join(", ");
  const snacks = snacksFull.length > 70 ? `${snacksFull.slice(0, 69)}…` : snacksFull;
  const poster = localPosterDataUri(v.movie.posterUrl);
  const hA = v.movie.art.hueA;
  const hB = v.movie.art.hueB;
  const title = v.movie.title.length > 30 ? `${v.movie.title.slice(0, 29)}…` : v.movie.title;
  const sans = "Helvetica, Arial, sans-serif";
  const serif = "Georgia, 'Times New Roman', serif";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17140f"/><stop offset="1" stop-color="#0b0a08"/>
    </linearGradient>
    <linearGradient id="art" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hA} 55% 42%)"/><stop offset="1" stop-color="hsl(${hB} 50% 16%)"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6e7c1"/><stop offset="1" stop-color="#c9a14a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1000" height="420" rx="28" fill="url(#bg)"/>
  <rect x="1" y="1" width="998" height="418" rx="27" fill="none" stroke="#c9a14a" stroke-opacity="0.45"/>
  <clipPath id="poster-clip"><rect x="28" y="28" width="150" height="225" rx="12"/></clipPath>
  <rect x="28" y="28" width="150" height="225" rx="12" fill="url(#art)"/>
  ${poster ? `<image href="${poster}" x="28" y="28" width="150" height="225" preserveAspectRatio="xMidYMid slice" clip-path="url(#poster-clip)"/>` : ""}
  ${poster ? "" : `<circle cx="103" cy="120" r="44" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
  <text x="103" y="232" text-anchor="middle" font-family="${serif}" font-size="13" fill="#fff" fill-opacity="0.85">${esc(v.movie.rating)}</text>`}
  <text x="206" y="58" font-family="${sans}" font-size="13" letter-spacing="4" fill="#e2bd67">MONROVIA CINEMA PLUS</text>
  <text x="206" y="104" font-family="${serif}" font-size="36" fill="#f4efe6">${esc(title)}</text>
  <text x="206" y="134" font-family="${sans}" font-size="15" fill="#b3aa9b">${esc(v.movie.rating)} · ${v.movie.runtimeMin} min · ${esc(v.screening.format)}</text>
  <g font-family="${sans}">
    <text x="206" y="178" font-size="11" letter-spacing="2" fill="#9a9183">DATE</text>
    <text x="206" y="200" font-size="18" fill="#f4efe6">${esc(formatDateLong(v.screening.startsAt))}</text>
    <text x="206" y="236" font-size="11" letter-spacing="2" fill="#9a9183">TIME (MONROVIA)</text>
    <text x="206" y="258" font-size="18" fill="#f4efe6">${esc(formatTime(v.screening.startsAt))}</text>
    <text x="420" y="236" font-size="11" letter-spacing="2" fill="#9a9183">AUDITORIUM</text>
    <text x="420" y="258" font-size="18" fill="#f4efe6">${esc(v.auditorium.name)}</text>
    <text x="206" y="294" font-size="11" letter-spacing="2" fill="#9a9183">SEATS</text>
    <text x="206" y="318" font-size="22" font-weight="bold" fill="url(#gold)">${esc(seats)}</text>
    <text x="206" y="342" font-size="13" fill="#b3aa9b">${esc(cats)}  ·  Total ${esc(formatUSD(v.totalCents))}</text>
    ${snacks ? `<text x="206" y="364" font-size="13" fill="#e2bd67">Snacks: ${esc(snacks)}</text>` : ""}
    <text x="28" y="292" font-size="11" letter-spacing="2" fill="#9a9183">BOOKING REF</text>
    <text x="28" y="316" font-size="20" font-weight="bold" fill="#f4efe6">${esc(v.reference)}</text>
    <text x="28" y="384" font-size="12" fill="#9a9183">${esc(settings.venue)}, ${esc(settings.city)}, ${esc(settings.country)}</text>
    <text x="28" y="402" font-size="11" fill="#f2b84b">DEMO TICKET — fictional booking for demonstration purposes</text>
  </g>
  <line x1="726" y1="24" x2="726" y2="396" stroke="#c9a14a" stroke-opacity="0.5" stroke-dasharray="6 7"/>
  <circle cx="726" cy="0" r="16" fill="#0a0908"/><circle cx="726" cy="420" r="16" fill="#0a0908"/>
  <rect x="756" y="48" width="216" height="216" rx="14" fill="#ffffff"/>
  <svg x="766" y="58" width="196" height="196" viewBox="${viewBox}" shape-rendering="crispEdges">${qrInner}</svg>
  <text x="864" y="296" text-anchor="middle" font-family="${sans}" font-size="12" letter-spacing="2" fill="#e2bd67">${esc(STATUS_TEXT[v.status] ?? v.status.toUpperCase())}</text>
  <text x="864" y="320" text-anchor="middle" font-family="${sans}" font-size="12" fill="#9a9183">Show this code at the entrance</text>
  <text x="864" y="340" text-anchor="middle" font-family="${sans}" font-size="12" fill="#9a9183">${v.items.length} admission${v.items.length > 1 ? "s" : ""}</text>
</svg>`;
}
