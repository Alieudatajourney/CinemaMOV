"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatUSD } from "@/lib/format";

/** Smoothly tweens a cents value. Purely visual — the real value is always set immediately. */
export function AnimatedUSD({ cents, className }: { cents: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);

  useEffect(() => {
    if (reduce) {
      from.current = cents;
      return;
    }
    const controls = animate(from.current, cents, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = cents;
    return () => controls.stop();
  }, [cents, reduce]);

  return (
    <span className={className}>
      <span aria-hidden>{formatUSD(reduce ? cents : shown)}</span>
      <span className="sr-only">{formatUSD(cents)}</span>
    </span>
  );
}
