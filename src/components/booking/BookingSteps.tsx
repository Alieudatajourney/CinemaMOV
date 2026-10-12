import { clsx } from "clsx";
import { Check } from "lucide-react";

const STEPS = ["Showtime", "Seats", "Snacks", "Checkout", "Ticket"];

export function BookingSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Booking progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={clsx(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem] font-bold",
                done && "border-gold-400 bg-gold-400 text-ink-950",
                active && "border-gold-400 text-gold-300",
                !done && !active && "border-white/15 text-fg-subtle",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={clsx("hidden sm:inline", active ? "font-semibold text-fg" : "text-fg-subtle")}>
              {s}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-3 bg-white/15 sm:w-6" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
