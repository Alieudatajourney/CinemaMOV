// Concession (snacks & drinks) pricing. Pure and shared: the snacks page uses it for instant
// totals, and the server uses the same function as the trusted source of prices.
import type { ConcessionCategory, ConcessionItem, ConcessionLine, ConcessionSelection } from "./types";

export const MAX_UNITS_PER_LINE = 10;
export const MAX_UNITS_TOTAL = 30;

export const CATEGORY_ORDER: { id: ConcessionCategory; label: string }[] = [
  { id: "combos", label: "Combos" },
  { id: "popcorn", label: "Popcorn" },
  { id: "drinks", label: "Drinks" },
  { id: "snacks", label: "Hot snacks" },
  { id: "sweets", label: "Sweets" },
];

export type ConcessionError = { code: "unknown" | "unavailable" | "quantity"; message: string };

/** Merge duplicate (item, variant) lines and drop zero quantities. */
export function normalizeSelections(sel: ConcessionSelection[]): ConcessionSelection[] {
  const map = new Map<string, ConcessionSelection>();
  for (const s of sel) {
    if (!s || s.qty <= 0) continue;
    const key = `${s.itemId}:${s.variantId}`;
    const prev = map.get(key);
    map.set(key, { itemId: s.itemId, variantId: s.variantId, qty: (prev?.qty ?? 0) + Math.floor(s.qty) });
  }
  return [...map.values()];
}

export function quoteConcessions(
  selections: ConcessionSelection[],
  menu: ConcessionItem[],
): { ok: true; lines: ConcessionLine[]; totalCents: number; units: number } | { ok: false; error: ConcessionError } {
  const lines: ConcessionLine[] = [];
  let units = 0;
  for (const s of normalizeSelections(selections)) {
    const item = menu.find((m) => m.id === s.itemId);
    const variant = item?.variants.find((v) => v.id === s.variantId);
    if (!item || !variant) return { ok: false, error: { code: "unknown", message: "One of your snacks is no longer on the menu." } };
    if (!item.available) return { ok: false, error: { code: "unavailable", message: `${item.name} is sold out right now. Please update your snacks.` } };
    if (s.qty > MAX_UNITS_PER_LINE) return { ok: false, error: { code: "quantity", message: `You can add up to ${MAX_UNITS_PER_LINE} of each item.` } };
    units += s.qty;
    lines.push({
      itemId: item.id,
      variantId: variant.id,
      qty: s.qty,
      name: item.name,
      variantLabel: variant.label,
      unitCents: variant.priceCents,
      lineCents: variant.priceCents * s.qty,
    });
  }
  if (units > MAX_UNITS_TOTAL) return { ok: false, error: { code: "quantity", message: `Orders are limited to ${MAX_UNITS_TOTAL} snack items.` } };
  return { ok: true, lines, totalCents: lines.reduce((n, l) => n + l.lineCents, 0), units };
}

export function describeLine(l: Pick<ConcessionLine, "qty" | "name" | "variantLabel">) {
  return `${l.qty} × ${l.name}${l.variantLabel && l.variantLabel !== "Regular" ? ` (${l.variantLabel})` : ""}`;
}

/**
 * Lenient view of a cart for display: prices every line it can and lists problems separately,
 * so the UI never shows a non-empty cart as empty. Checkout still uses the strict quoteConcessions.
 */
export function describeCart(selections: ConcessionSelection[], menu: ConcessionItem[]) {
  const lines: ConcessionLine[] = [];
  const problems: string[] = [];
  for (const s of normalizeSelections(selections)) {
    const item = menu.find((m) => m.id === s.itemId);
    const variant = item?.variants.find((v) => v.id === s.variantId);
    if (!item || !variant) {
      problems.push("An item in your order is no longer on the menu.");
      continue;
    }
    if (!item.available) problems.push(`${item.name} is sold out — please remove it.`);
    if (s.qty > MAX_UNITS_PER_LINE) problems.push(`You can add up to ${MAX_UNITS_PER_LINE} of each item.`);
    lines.push({ itemId: item.id, variantId: variant.id, qty: s.qty, name: item.name, variantLabel: variant.label, unitCents: variant.priceCents, lineCents: variant.priceCents * s.qty });
  }
  const units = lines.reduce((n, l) => n + l.qty, 0);
  if (units > MAX_UNITS_TOTAL) problems.push(`Orders are limited to ${MAX_UNITS_TOTAL} snack items.`);
  return { lines, units, totalCents: lines.reduce((n, l) => n + l.lineCents, 0), problems: [...new Set(problems)] };
}
