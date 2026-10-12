"use client";
import { useState } from "react";
import { formatDayKey, formatUSD } from "@/lib/format";

/** Single-series bar chart (demo revenue per day). Hover/focus tooltip; table for screen readers. */
export function RevenueChart({ data }: { data: { day: string; cents: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.cents));
  // Round the axis top to a friendly value.
  const step = Math.pow(10, Math.floor(Math.log10(max / 100))) * 100;
  const top = Math.ceil(max / step / 2) * step * 2 || 100;
  const H = 180;
  const ticks = [0, 0.5, 1].map((f) => f * top);

  return (
    <figure>
      <div className="relative" style={{ height: H + 28 }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: 28 + (t / top) * H }}>
            <span className="w-12 text-right text-[0.68rem] tabular-nums text-fg-subtle">{formatUSD(t).replace(".00", "")}</span>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
        ))}
        <div className="absolute bottom-[28px] left-14 right-0 flex items-end gap-[2px]" style={{ height: H }}>
          {data.map((d, i) => {
            const h = Math.max(d.cents > 0 ? 3 : 0, (d.cents / top) * H);
            return (
              <button
                key={d.day}
                type="button"
                className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-offset-0"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${formatDayKey(d.day)}: ${formatUSD(d.cents)}`}
              >
                <span
                  className="block w-full max-w-10 rounded-t-[4px] bg-gold-400 transition-opacity"
                  style={{ height: h, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
                {hover === i && (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs shadow-lift" style={{ bottom: h + 8 }}>
                    <span className="block text-fg-subtle">{formatDayKey(d.day)}</span>
                    <span className="font-semibold tabular-nums text-fg">{formatUSD(d.cents)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="absolute bottom-0 left-14 right-0 flex gap-[2px]">
          {data.map((d) => (
            <span key={d.day} className="flex-1 text-center text-[0.68rem] text-fg-subtle">
              {formatDayKey(d.day).split(",")[0]}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Demo revenue for the last seven days</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            <th>Revenue (USD)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{formatDayKey(d.day)}</td>
              <td>{formatUSD(d.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
