"use client";
import { useState } from "react";
import { clsx } from "clsx";
import type { MovieArt } from "@/lib/types";
import { PosterArt } from "./PosterArt";

interface PosterMovie {
  title: string;
  rating: string;
  art: MovieArt;
  posterUrl?: string;
  backdropUrl?: string;
}

/**
 * Shows the configured artwork when available, falling back to the original generated
 * artwork if no URL is configured or the image fails to load.
 */
export function MoviePoster({
  movie,
  variant = "poster",
  className,
  imgClassName,
  showTitle = true,
  priority = false,
}: {
  movie: PosterMovie;
  variant?: "poster" | "backdrop";
  className?: string;
  imgClassName?: string;
  showTitle?: boolean;
  priority?: boolean;
}) {
  const url = variant === "poster" ? movie.posterUrl : movie.backdropUrl;
  const [failed, setFailed] = useState(false);
  return (
    <div className={clsx("relative overflow-hidden bg-ink-800", className)}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied URLs from arbitrary hosts
        <img
          src={url}
          alt={`${variant === "poster" ? "Poster" : "Backdrop"} for ${movie.title}`}
          className={clsx("h-full w-full object-cover", imgClassName)}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <PosterArt
          art={movie.art}
          title={movie.title}
          rating={movie.rating}
          variant={variant}
          showTitle={showTitle}
          className={clsx("h-full w-full", imgClassName)}
        />
      )}
    </div>
  );
}
