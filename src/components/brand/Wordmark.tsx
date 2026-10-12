import { clsx } from "clsx";

/**
 * Original typographic wordmark for Monrovia Cinema Plus: an aperture "plus" monogram
 * (four gold blades forming a + inside a frame) beside a two-tier name.
 */
export function Monogram({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#14120f" stroke="#d9b35e" strokeWidth="1.5" />
      <path d="M17 8h6v9h9v6h-9v9h-6v-9H8v-6h9z" fill="#e2bd67" />
      <circle cx="20" cy="20" r="2.2" fill="#14120f" />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-3", className)}>
      <Monogram size={compact ? 30 : 36} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.62rem] font-semibold tracking-[0.42em] text-fg-muted">MONROVIA</span>
        <span className="font-display text-[1.32rem] leading-[1.05] text-fg">
          Cinema <span className="gold-text italic">Plus</span>
        </span>
      </span>
      <span className="sr-only">Monrovia Cinema Plus</span>
    </span>
  );
}
