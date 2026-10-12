"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Accessibility, Clock3, Crown, MoveHorizontal, X } from "lucide-react";
import type { Auditorium, PriceTable, SeatCategory } from "@/lib/types";
import { CATEGORY_LABEL, formatUSD } from "@/lib/format";
import { layoutWidth } from "@/lib/seating";
import { SeatDefs, SeatShape } from "./SeatGlyph";

export type VisualState = "available" | "selected" | "occupied" | "held";

interface Cell {
  kind: "seat" | "aisle" | "gap";
  id?: string;
  number?: number;
  category?: SeatCategory;
}

const CHAR: Record<string, SeatCategory> = { S: "standard", V: "vip", A: "accessible" };
const MIN_SEAT = 28;
const MAX_SEAT = 44;
const GAP = 5;
const LABEL_W = 26;

function buildRows(aud: Auditorium) {
  return aud.rows.map((r) => {
    let n = 0;
    const cells: Cell[] = [...r.pattern].map((ch) => {
      if (ch === "_") return { kind: "aisle" };
      if (ch === ".") return { kind: "gap" };
      n += 1;
      return { kind: "seat", id: `${r.label}${n}`, number: n, category: CHAR[ch] };
    });
    return { label: r.label, cells };
  });
}

export function SeatMap({
  auditorium,
  prices,
  stateOf,
  onSeat,
  pop,
  shake,
}: {
  auditorium: Auditorium;
  prices: PriceTable;
  stateOf: (id: string) => VisualState;
  onSeat: (id: string) => void;
  /** Seats that were just selected (several at once for "best available"; popped in sequence). */
  pop: { ids: string[]; n: number } | null;
  shake: { id: string; n: number } | null;
}) {
  const rows = useMemo(() => buildRows(auditorium), [auditorium]);
  const width = layoutWidth(auditorium.rows);
  const aisleCount = Math.max(...auditorium.rows.map((r) => [...r.pattern].filter((c) => c === "_").length));
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(36);
  const [overflow, setOverflow] = useState(false);

  // Fit seats to the available width; fall back to horizontal scrolling only if tap targets would get too small.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - LABEL_W * 2 - 8;
      const seatCols = width - aisleCount;
      // An aisle cell is ~0.55 of a seat.
      const fit = (w - width * GAP) / (seatCols + aisleCount * 0.55);
      const s = Math.max(MIN_SEAT, Math.min(MAX_SEAT, Math.floor(fit)));
      setSize(s);
      setOverflow(fit < MIN_SEAT);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, aisleCount]);

  // Centre the scrollable map on first layout.
  useEffect(() => {
    const sc = scrollRef.current;
    if (sc && overflow) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
  }, [overflow]);

  // Roving tab index: one seat is tabbable; arrow keys move between seats.
  const allSeats = useMemo(() => rows.flatMap((r, ri) => r.cells.map((c, ci) => ({ ...c, ri, ci })).filter((c) => c.kind === "seat")), [rows]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const initialFocus = useMemo(() => allSeats.find((s) => stateOf(s.id!) === "available")?.id ?? allSeats[0]?.id, [allSeats, stateOf]);
  const tabbable = focusId ?? initialFocus;

  const moveFocus = useCallback(
    (fromId: string, key: string) => {
      const from = allSeats.find((s) => s.id === fromId);
      if (!from) return;
      let target: (typeof allSeats)[number] | undefined;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        const sameRow = allSeats.filter((s) => s.ri === from.ri);
        const idx = sameRow.findIndex((s) => s.id === fromId);
        target = sameRow[idx + (key === "ArrowLeft" ? -1 : 1)];
      } else if (key === "ArrowUp" || key === "ArrowDown") {
        const dir = key === "ArrowUp" ? -1 : 1;
        for (let ri = from.ri + dir; ri >= 0 && ri < rows.length && !target; ri += dir) {
          const candidates = allSeats.filter((s) => s.ri === ri);
          target = candidates.sort((a, b) => Math.abs(a.ci - from.ci) - Math.abs(b.ci - from.ci))[0];
        }
      } else if (key === "Home" || key === "End") {
        const sameRow = allSeats.filter((s) => s.ri === from.ri);
        target = key === "Home" ? sameRow[0] : sameRow[sameRow.length - 1];
      }
      if (target?.id) {
        setFocusId(target.id);
        document.getElementById(`seat-${target.id}`)?.focus();
      }
    },
    [allSeats, rows.length],
  );

  const center = (width - 1) / 2;
  const arc = (ci: number) => -Math.pow((ci - center) / Math.max(center, 1), 2) * size * 0.32;

  return (
    <div ref={wrapRef} className="relative">
      <SeatDefs />
      {/* Screen */}
      <div className="relative mx-auto mb-2 w-full max-w-[880px] px-6" aria-hidden="true">
        <svg viewBox="0 0 1000 70" className="screen-glow w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="screen-grad" x1="0" x2="1">
              <stop offset="0" stopColor="#efd595" stopOpacity="0.15" />
              <stop offset="0.5" stopColor="#f6e7c1" stopOpacity="1" />
              <stop offset="1" stopColor="#efd595" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <path d="M 10 52 Q 500 -6 990 52" fill="none" stroke="url(#screen-grad)" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <div className="projector-beam -mt-6 h-16" />
      </div>
      <p className="-mt-12 mb-6 text-center text-[0.68rem] font-semibold uppercase tracking-[0.5em] text-gold-300/80">Screen</p>

      {overflow && (
        <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-fg-subtle lg:hidden">
          <MoveHorizontal className="h-3.5 w-3.5" aria-hidden /> Swipe to see the whole row
        </p>
      )}

      <div ref={scrollRef} className={clsx("pb-4", overflow ? "overflow-x-auto overscroll-x-contain scroll-fade-x" : "overflow-x-visible")}>
        <p id="seatmap-help" className="sr-only">
          Use the arrow keys to move between seats, and Enter or Space to select or deselect a seat.
        </p>
        <div
          className="mx-auto flex w-max flex-col gap-[7px] px-2 pt-3"
          style={{ ["--seat-size" as string]: `${size}px` }}
          aria-describedby="seatmap-help"
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            const id = t.dataset.seat;
            if (id && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              moveFocus(id, e.key);
            }
          }}
        >
          {rows.map((row) => (
            <div key={row.label} role="group" aria-label={`Row ${row.label}`} className="flex items-center" style={{ gap: GAP }}>
              <span className="w-[26px] shrink-0 text-center text-xs font-semibold text-fg-subtle" aria-hidden>
                {row.label}
              </span>
              {row.cells.map((c, ci) => {
                if (c.kind === "aisle") return <span key={ci} style={{ width: size * 0.55 }} className="shrink-0" aria-hidden />;
                if (c.kind === "gap") return <span key={ci} style={{ width: size }} className="shrink-0" aria-hidden />;
                const id = c.id!;
                const st = stateOf(id);
                const cat = c.category!;
                const price = formatUSD(prices[cat]);
                const label = `Row ${row.label}, seat ${c.number}. ${CATEGORY_LABEL[cat]}, ${price}. ${
                  st === "selected" ? "Selected" : st === "occupied" ? "Occupied, unavailable" : st === "held" ? "Temporarily held by another customer" : "Available"
                }`;
                const popIndex = pop && st === "selected" ? pop.ids.indexOf(id) : -1;
                const popping = popIndex >= 0;
                const shaking = shake?.id === id;
                return (
                  <button
                    key={id}
                    id={`seat-${id}`}
                    type="button"
                    data-seat={id}
                    data-state={st}
                    data-category={cat}
                    aria-label={label}
                    aria-pressed={st === "selected"}
                    aria-disabled={st === "occupied" || st === "held" ? true : undefined}
                    tabIndex={tabbable === id ? 0 : -1}
                    title={`${id} · ${CATEGORY_LABEL[cat]} · ${price}`}
                    onFocus={() => setFocusId(id)}
                    onClick={() => onSeat(id)}
                    className={clsx("seat shrink-0", popping && "seat-pop", shaking && "seat-shake")}
                    style={{ ["--seat-arc" as string]: `${arc(ci)}px`, animationDelay: popping ? `${popIndex * 70}ms` : undefined }}
                  >
                    <SeatShape />
                    {popping && <span key={pop!.n} className="seat-ripple" style={{ animationDelay: `${popIndex * 70}ms` }} aria-hidden />}
                    {st === "occupied" ? (
                      <X className="seat-icon" strokeWidth={2.5} aria-hidden />
                    ) : st === "held" ? (
                      <Clock3 className="seat-icon" strokeWidth={2.4} aria-hidden />
                    ) : cat === "accessible" ? (
                      <Accessibility className="seat-icon" strokeWidth={2.4} aria-hidden />
                    ) : (
                      <span className="seat-num" aria-hidden>
                        {c.number}
                      </span>
                    )}
                    {cat === "vip" && st !== "occupied" && size >= 30 && (
                      <Crown className="absolute -top-[5px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 text-velvet-300" strokeWidth={2.6} aria-hidden />
                    )}
                  </button>
                );
              })}
              <span className="w-[26px] shrink-0 text-center text-xs font-semibold text-fg-subtle" aria-hidden>
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-center text-[0.68rem] uppercase tracking-[0.3em] text-fg-subtle" aria-hidden>
        Entrance · Rear of auditorium
      </p>
    </div>
  );
}
