"use client";
import { useEffect, useRef, useState } from "react";
import { Film, X } from "lucide-react";

/** Embeddable YouTube/Vimeo URLs play inline; anything else opens in a new tab. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}?autoplay=1`;
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}?autoplay=1`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}?autoplay=1`;
  } catch {}
  return null;
}

export function TrailerButton({
  title,
  trailerUrl,
  className,
  children,
}: {
  title: string;
  trailerUrl?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const embed = trailerUrl ? embedUrl(trailerUrl) : null;

  if (trailerUrl && !embed) {
    return (
      <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="m-auto w-[min(92vw,960px)] rounded-[var(--radius-xl)] border border-white/10 bg-ink-900 p-0 text-fg backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        aria-label={`${title} trailer`}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
          <p className="font-display text-xl">{title}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Close trailer</span>
          </button>
        </div>
        {open && embed ? (
          <iframe
            src={embed}
            title={`${title} trailer`}
            className="aspect-video w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-b from-ink-850 to-ink-950 px-6 text-center">
            <Film className="h-10 w-10 text-gold-400" aria-hidden />
            <p className="font-display text-2xl">Trailer coming soon</p>
            <p className="max-w-md text-sm text-fg-muted">
              No trailer has been added for this film yet. Cinema staff can add a trailer link in the management dashboard.
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
