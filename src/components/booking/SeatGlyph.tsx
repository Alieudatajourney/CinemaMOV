/** Original cinema-chair silhouette: backrest, two armrests and a cushion. */
export function SeatShape() {
  return (
    <svg className="seat-shape" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className="body" x="6.5" y="3" width="19" height="17" rx="5" />
      <rect className="body" x="2" y="12.5" width="5" height="15" rx="2.5" />
      <rect className="body" x="25" y="12.5" width="5" height="15" rx="2.5" />
      <rect className="body" x="6.5" y="21" width="19" height="8" rx="3" />
    </svg>
  );
}

/** Shared SVG defs (held-seat hatching). Rendered once per page, visually hidden but not display:none. */
export function SeatDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="seat-held-pattern" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="#1b2630" />
          <rect width="2" height="5" fill="#2f4558" />
        </pattern>
      </defs>
    </svg>
  );
}

/** Small static seat used in the legend. */
export function LegendSeat({
  state,
  category = "standard",
  children,
}: {
  state: "available" | "selected" | "occupied" | "held";
  category?: "standard" | "vip" | "accessible";
  children?: React.ReactNode;
}) {
  return (
    <span className="seat pointer-events-none" data-state={state} data-category={category} style={{ ["--seat-size" as string]: "26px", cursor: "default" }} aria-hidden>
      <SeatShape />
      {children}
    </span>
  );
}
