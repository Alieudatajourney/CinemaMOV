// Pure seat-layout and selection logic. Shared by the client seat map (for instant UI
// feedback) and the server (as the trusted source of truth).
import type { Auditorium, AuditoriumRow, PriceTable, SeatCategory, SeatDef, TicketItem } from "./types";

const SEAT_CHARS: Record<string, SeatCategory> = { S: "standard", V: "vip", A: "accessible" };

export function parseLayout(rows: AuditoriumRow[]): SeatDef[] {
  const seats: SeatDef[] = [];
  for (const row of rows) {
    let n = 0;
    [...row.pattern].forEach((ch, col) => {
      const category = SEAT_CHARS[ch];
      if (!category) return;
      n += 1;
      seats.push({ id: `${row.label}${n}`, row: row.label, number: n, category, col });
    });
  }
  return seats;
}

export function layoutWidth(rows: AuditoriumRow[]): number {
  return rows.reduce((w, r) => Math.max(w, r.pattern.length), 0);
}

export function seatMap(aud: Auditorium): Map<string, SeatDef> {
  return new Map(parseLayout(aud.rows).map((s) => [s.id, s]));
}

export function capacity(aud: Auditorium): number {
  return parseLayout(aud.rows).length;
}

export interface LayoutValidation {
  ok: boolean;
  errors: string[];
}

export function validateLayout(rows: AuditoriumRow[]): LayoutValidation {
  const errors: string[] = [];
  if (rows.length === 0) errors.push("Add at least one row.");
  if (rows.length > 26) errors.push("A maximum of 26 rows is supported.");
  const seen = new Set<string>();
  for (const r of rows) {
    if (!/^[A-Z]{1,2}$/.test(r.label)) errors.push(`Row label "${r.label}" must be 1–2 capital letters.`);
    if (seen.has(r.label)) errors.push(`Row ${r.label} appears more than once.`);
    seen.add(r.label);
    if (!/^[SVA_.]+$/.test(r.pattern)) errors.push(`Row ${r.label}: use only S, V, A, _ and . characters.`);
    if (r.pattern.length > 32) errors.push(`Row ${r.label}: maximum width is 32 positions.`);
    if (!/[SVA]/.test(r.pattern)) errors.push(`Row ${r.label} has no seats.`);
  }
  return { ok: errors.length === 0, errors };
}

/** "A: SSS_SSS" lines ⇄ rows */
export function rowsToText(rows: AuditoriumRow[]): string {
  return rows.map((r) => `${r.label}: ${r.pattern}`).join("\n");
}

export function textToRows(text: string): AuditoriumRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      return { label: (label ?? "").trim().toUpperCase(), pattern: rest.join(":").replace(/\s+/g, "").toUpperCase() };
    });
}

export function priceFor(category: SeatCategory, prices: PriceTable): number {
  return prices[category];
}

export interface Quote {
  items: TicketItem[];
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  byCategory: { category: SeatCategory; count: number; unitCents: number; lineCents: number }[];
}

/** Itemised totals. Seat order follows the auditorium (row, then number) for stable display. */
export function quoteSeats(seatIds: string[], aud: Auditorium, prices: PriceTable): Quote {
  const map = seatMap(aud);
  const order = parseLayout(aud.rows).map((s) => s.id);
  const unique = [...new Set(seatIds)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const items: TicketItem[] = unique.map((id) => {
    const seat = map.get(id);
    if (!seat) throw new Error(`Unknown seat ${id}`);
    return { seatId: id, category: seat.category, priceCents: priceFor(seat.category, prices) };
  });
  const cats: SeatCategory[] = ["standard", "vip", "accessible"];
  const byCategory = cats
    .map((category) => {
      const count = items.filter((i) => i.category === category).length;
      const unitCents = prices[category];
      return { category, count, unitCents, lineCents: count * unitCents };
    })
    .filter((c) => c.count > 0);
  const subtotalCents = items.reduce((s, i) => s + i.priceCents, 0);
  const feesCents = 0;
  return { items, subtotalCents, feesCents, totalCents: subtotalCents + feesCents, byCategory };
}

export type ToggleResult =
  | { ok: true; selection: string[]; action: "added" | "removed" }
  | { ok: false; selection: string[]; reason: "occupied" | "held" | "limit" | "unknown" };

/**
 * Toggle a seat in a selection. Only available seats can be added; selected seats are removed.
 * Never produces duplicates and never exceeds `limit`.
 */
export function toggleSeat(
  selection: string[],
  seatId: string,
  opts: { exists: boolean; state: "available" | "occupied" | "held"; limit: number },
): ToggleResult {
  if (selection.includes(seatId)) {
    return { ok: true, selection: selection.filter((s) => s !== seatId), action: "removed" };
  }
  if (!opts.exists) return { ok: false, selection, reason: "unknown" };
  if (opts.state === "occupied") return { ok: false, selection, reason: "occupied" };
  if (opts.state === "held") return { ok: false, selection, reason: "held" };
  if (selection.length >= opts.limit) return { ok: false, selection, reason: "limit" };
  return { ok: true, selection: [...selection, seatId], action: "added" };
}

/**
 * Suggest the best `count` available seats: a contiguous block in one row (never across an
 * aisle), about two-thirds of the way back, as central as possible. Accessible spaces are only
 * suggested when explicitly allowed; VIP recliners carry a small penalty because they cost more.
 * Falls back to the best individual seats when no single row has a long enough block.
 */
/** VIP recliners cost more, so only suggest them when standard seats are clearly worse. */
const VIP_PENALTY = 3;

export function bestAvailableSeats(
  aud: Auditorium,
  blocked: (seatId: string) => boolean,
  count: number,
  opts: { allowAccessible?: boolean } = {},
): string[] {
  if (count <= 0) return [];
  const rows = aud.rows;
  const width = layoutWidth(rows);
  const centerCol = (width - 1) / 2;
  const seats = parseLayout(rows);
  const rowIndex = new Map(rows.map((r, i) => [r.label, i]));
  const ok = (s: SeatDef) => !blocked(s.id) && (opts.allowAccessible || s.category !== "accessible");
  const rowScore = (label: string) => {
    const frac = rows.length > 1 ? rowIndex.get(label)! / (rows.length - 1) : 0.5;
    return Math.abs(frac - 0.62) * 10;
  };
  const seatScore = (s: SeatDef) => rowScore(s.row) + (Math.abs(s.col - centerCol) / Math.max(1, width)) * 6 + (s.category === "vip" ? VIP_PENALTY : 0);

  let best: { ids: string[]; score: number } | null = null;
  for (const row of rows) {
    const inRow = seats.filter((s) => s.row === row.label);
    for (let i = 0; i + count <= inRow.length; i++) {
      const block = inRow.slice(i, i + count);
      // Contiguous = adjacent pattern positions (no aisle or gap between neighbours).
      if (!block.every((s, k) => k === 0 || s.col === block[k - 1].col + 1)) continue;
      if (!block.every(ok)) continue;
      const mid = (block[0].col + block[block.length - 1].col) / 2;
      const score =
        rowScore(row.label) + (Math.abs(mid - centerCol) / Math.max(1, width)) * 6 + block.filter((s) => s.category === "vip").length * (VIP_PENALTY / count);
      if (!best || score < best.score) best = { ids: block.map((s) => s.id), score };
    }
  }
  if (best) return best.ids;
  return seats
    .filter(ok)
    .sort((a, b) => seatScore(a) - seatScore(b))
    .slice(0, count)
    .map((s) => s.id);
}
