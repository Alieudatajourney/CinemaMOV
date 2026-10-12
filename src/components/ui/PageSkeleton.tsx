/** Lightweight loading placeholder shown while a booking step renders on the server. */
export function PageSkeleton({ variant = "split" }: { variant?: "split" | "hero" }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-6 h-14 w-full max-w-xl" />
      {variant === "hero" ? (
        <div className="grid gap-8 md:grid-cols-[280px_1fr]">
          <div className="skeleton aspect-[2/3] w-full" />
          <div className="space-y-4">
            <div className="skeleton h-14 w-3/4" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-12 w-64" />
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="skeleton h-[480px]" />
          <div className="skeleton hidden h-[360px] lg:block" />
        </div>
      )}
    </div>
  );
}
