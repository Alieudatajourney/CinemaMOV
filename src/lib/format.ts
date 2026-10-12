// Formatting helpers shared by server and client. All screening times are shown in
// Africa/Monrovia (GMT, UTC+0, no daylight saving) regardless of the viewer's device zone.

export const CINEMA_TZ = "Africa/Monrovia";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUSD(cents: number): string {
  return usd.format(cents / 100);
}

// Intl.DateTimeFormat construction is expensive (~0.1 ms each); build each formatter once.
const PARTS_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CINEMA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, hour: "numeric", minute: "2-digit" });
const DATE_LONG_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const DATE_SHORT_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, weekday: "short", month: "short", day: "numeric" });
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, weekday: "short" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, day: "numeric" });
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { timeZone: CINEMA_TZ, month: "short" });

function parts(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const out: Record<string, string> = {};
  for (const p of PARTS_FMT.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** YYYY-MM-DD in Monrovia time. */
export function dateKey(iso: string | Date): string {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** HH:mm (24h) in Monrovia time. */
export function timeKey(iso: string | Date): string {
  const p = parts(iso);
  return `${p.hour}:${p.minute}`;
}

/**
 * Convert a Monrovia wall-clock date + time to a UTC ISO string.
 * Computes the zone offset with Intl rather than assuming UTC+0, so it stays
 * correct if the configured zone ever changes.
 */
export function monroviaToUtc(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = parts(new Date(guess));
  const asLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offset = asLocal - guess;
  return new Date(guess - offset).toISOString();
}

export function formatTime(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return DATE_LONG_FMT.format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return DATE_SHORT_FMT.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDateShort(iso)}, ${formatTime(iso)}`;
}

/** Format a YYYY-MM-DD key (interpreted as a Monrovia calendar date). */
export function formatDayKey(key: string, style: "short" | "long" = "short"): string {
  const iso = monroviaToUtc(key, "12:00");
  return style === "long" ? formatDateLong(iso) : formatDateShort(iso);
}

export function dayParts(key: string) {
  const iso = monroviaToUtc(key, "12:00");
  const d = new Date(iso);
  return { weekday: WEEKDAY_FMT.format(d), day: DAY_FMT.format(d), month: MONTH_FMT.format(d) };
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function relativeDayLabel(key: string, todayKey: string): string | null {
  if (key === todayKey) return "Today";
  if (key === addDaysKey(todayKey, 1)) return "Tomorrow";
  return null;
}

export function formatRuntime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  standard: "Standard",
  vip: "VIP Recliner",
  accessible: "Accessible",
};
