import { clsx } from "clsx";

export function AdminHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="surface p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">
        {icon && (
          <span className="text-gold-400" aria-hidden>
            {icon}
          </span>
        )}
        {label}
      </p>
      <p className="font-display mt-3 text-4xl tabular-nums text-fg">{value}</p>
      {sub && <p className="mt-1 text-xs text-fg-muted">{sub}</p>}
    </div>
  );
}

/** Single-hue occupancy meter with the value always printed as text. */
export function Meter({ value, held = 0, label }: { value: number; held?: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-gold-400" style={{ width: `${Math.min(100, pct)}%` }} />
        {held > 0 && <div className="absolute inset-y-0 rounded-full bg-gold-400/35" style={{ left: `calc(${Math.min(100, pct)}% + 2px)`, width: `${Math.min(100 - pct, Math.round(held * 100))}%` }} />}
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-fg-muted">{pct}%</span>
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={clsx("surface p-5", className)} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
