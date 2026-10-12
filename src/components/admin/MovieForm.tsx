"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { Movie, PosterMotif } from "@/lib/types";
import { api, type ApiError } from "@/lib/client-store";
import { MoviePoster } from "../MoviePoster";

const MOTIFS: PosterMotif[] = ["rings", "orbit", "waves", "sun", "shards", "grid", "palms", "stars"];

export function MovieForm({ movie, today }: { movie?: Movie; today: string }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: movie?.title ?? "",
    tagline: movie?.tagline ?? "",
    synopsis: movie?.synopsis ?? "",
    genres: movie?.genres.join(", ") ?? "",
    runtimeMin: String(movie?.runtimeMin ?? 110),
    language: movie?.language ?? "English",
    rating: movie?.rating ?? "PG-13",
    releaseDate: movie?.releaseDate ?? today,
    status: movie?.status ?? "coming_soon",
    published: movie?.published ?? false,
    featured: movie?.featured ?? false,
    director: movie?.director ?? "",
    cast: movie?.cast.join(", ") ?? "",
    posterUrl: movie?.posterUrl ?? "",
    backdropUrl: movie?.backdropUrl ?? "",
    trailerUrl: movie?.trailerUrl ?? "",
    hueA: movie?.art.hueA ?? 30,
    hueB: movie?.art.hueB ?? 200,
    motif: movie?.art.motif ?? ("rings" as PosterMotif),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const payload = {
      title: f.title,
      tagline: f.tagline,
      synopsis: f.synopsis,
      genres: f.genres.split(",").map((s) => s.trim()).filter(Boolean),
      runtimeMin: Number(f.runtimeMin),
      language: f.language,
      rating: f.rating,
      releaseDate: f.releaseDate,
      status: f.status,
      published: f.published,
      featured: f.featured,
      director: f.director,
      cast: f.cast.split(",").map((s) => s.trim()).filter(Boolean),
      posterUrl: f.posterUrl,
      backdropUrl: f.backdropUrl,
      trailerUrl: f.trailerUrl,
      art: { hueA: Number(f.hueA), hueB: Number(f.hueB), motif: f.motif },
    };
    try {
      await api(movie ? `/api/admin/movies/${movie.id}` : "/api/admin/movies", { method: movie ? "PATCH" : "POST", json: payload });
      router.push("/admin/movies");
      router.refresh();
    } catch (err) {
      const ae = err as ApiError;
      setErrors((ae.data?.fields as Record<string, string>) ?? {});
      setError(ae.message);
      setBusy(false);
    }
  };

  const preview = { title: f.title || "Untitled", rating: f.rating, art: { hueA: Number(f.hueA), hueB: Number(f.hueB), motif: f.motif }, posterUrl: f.posterUrl || undefined };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="surface grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <F label="Title" err={errors.title} className="sm:col-span-2">
          <input id="title" className="field" value={f.title} onChange={set("title")} required aria-invalid={!!errors.title} />
        </F>
        <F label="Tagline" err={errors.tagline} className="sm:col-span-2">
          <input id="tagline" className="field" value={f.tagline} onChange={set("tagline")} />
        </F>
        <F label="Synopsis" err={errors.synopsis} className="sm:col-span-2">
          <textarea id="synopsis" className="field min-h-28" value={f.synopsis} onChange={set("synopsis")} aria-invalid={!!errors.synopsis} />
        </F>
        <F label="Genres (comma separated)" err={errors.genres}>
          <input id="genres" className="field" value={f.genres} onChange={set("genres")} aria-invalid={!!errors.genres} />
        </F>
        <F label="Runtime (minutes)" err={errors.runtimeMin}>
          <input id="runtimeMin" type="number" min={30} max={300} className="field" value={f.runtimeMin} onChange={set("runtimeMin")} aria-invalid={!!errors.runtimeMin} />
        </F>
        <F label="Language" err={errors.language}>
          <input id="language" className="field" value={f.language} onChange={set("language")} />
        </F>
        <F label="Age rating">
          <select id="rating" className="field" value={f.rating} onChange={set("rating")}>
            {["G", "PG", "PG-13", "R", "NR", "15", "18"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </F>
        <F label="Release date" err={errors.releaseDate}>
          <input id="releaseDate" type="date" className="field" value={f.releaseDate} onChange={set("releaseDate")} />
        </F>
        <F label="Section">
          <select id="status" className="field" value={f.status} onChange={set("status")}>
            <option value="now_showing">Now Showing</option>
            <option value="coming_soon">Coming Soon</option>
          </select>
        </F>
        <F label="Director">
          <input id="director" className="field" value={f.director} onChange={set("director")} />
        </F>
        <F label="Cast (comma separated)">
          <input id="cast" className="field" value={f.cast} onChange={set("cast")} />
        </F>
        <F label="Poster image URL (optional)" err={errors.posterUrl} hint="https:// link. Generated artwork is used if empty or the image fails.">
          <input id="posterUrl" className="field" value={f.posterUrl} onChange={set("posterUrl")} placeholder="https://…" aria-invalid={!!errors.posterUrl} />
        </F>
        <F label="Backdrop image URL (optional)" err={errors.backdropUrl}>
          <input id="backdropUrl" className="field" value={f.backdropUrl} onChange={set("backdropUrl")} placeholder="https://…" />
        </F>
        <F label="Trailer URL (optional)" err={errors.trailerUrl} hint="YouTube or Vimeo links play inline." className="sm:col-span-2">
          <input id="trailerUrl" className="field" value={f.trailerUrl} onChange={set("trailerUrl")} placeholder="https://www.youtube.com/watch?v=…" />
        </F>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.published} onChange={set("published")} className="h-4 w-4 accent-[var(--gold-400)]" /> Published (visible to customers)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.featured} onChange={set("featured")} className="h-4 w-4 accent-[var(--gold-400)]" /> Feature on homepage
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-400 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {movie ? "Save changes" : "Create movie"}
          </button>
          <Link href="/admin/movies" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
      <aside className="space-y-4">
        <MoviePoster movie={preview} className="aspect-[2/3] w-full rounded-[var(--radius-lg)]" />
        <div className="surface space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">Generated artwork</p>
          <F label="Motif">
            <select id="motif" className="field" value={f.motif} onChange={set("motif")}>
              {MOTIFS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </F>
          <F label={`Primary hue (${f.hueA})`}>
            <input id="hueA" type="range" min={0} max={360} value={f.hueA} onChange={set("hueA")} className="w-full accent-[var(--gold-400)]" />
          </F>
          <F label={`Secondary hue (${f.hueB})`}>
            <input id="hueB" type="range" min={0} max={360} value={f.hueB} onChange={set("hueB")} className="w-full accent-[var(--gold-400)]" />
          </F>
        </div>
      </aside>
    </form>
  );
}

function F({ label, err, hint, className, children }: { label: string; err?: string; hint?: string; className?: string; children: React.ReactElement<{ id?: string }> }) {
  return (
    <div className={className}>
      <label htmlFor={children.props.id} className="label">
        {label}
      </label>
      {children}
      {err ? <p className="mt-1 text-sm text-danger-400">{err}</p> : hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
