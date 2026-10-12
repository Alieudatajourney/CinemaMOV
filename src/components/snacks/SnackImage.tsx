"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { Candy, CupSoda, GlassWater, IceCreamCone, Popcorn, Sandwich } from "lucide-react";
import type { ConcessionItem } from "@/lib/types";

const ICONS: Record<string, typeof Popcorn> = {
  con_water: GlassWater,
  con_icecream: IceCreamCone,
  con_hotdog: Sandwich,
};
const BY_CATEGORY: Record<string, typeof Popcorn> = {
  combos: Popcorn,
  popcorn: Popcorn,
  drinks: CupSoda,
  snacks: Sandwich,
  sweets: Candy,
};

/** Product photo with an illustrated fallback when no image is configured or it fails to load. */
export function SnackImage({ item, className }: { item: Pick<ConcessionItem, "id" | "name" | "category" | "imageUrl">; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = ICONS[item.id] ?? BY_CATEGORY[item.category] ?? Popcorn;
  return (
    <div className={clsx("relative overflow-hidden bg-gradient-to-br from-gold-700/40 via-ink-800 to-velvet-700/40", className)}>
      {item.imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- local or admin-supplied image URLs
        <img src={item.imageUrl} alt={item.name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center" role="img" aria-label={item.name}>
          <Icon className="h-1/3 w-1/3 text-gold-300/80" strokeWidth={1.4} aria-hidden />
        </div>
      )}
    </div>
  );
}
