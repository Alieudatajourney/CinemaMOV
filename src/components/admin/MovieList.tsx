"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import type { Movie } from "@/lib/types";
import { formatDayKey, formatRuntime } from "@/lib/format";
import { api, type ApiError } from "@/lib/client-store";
import { MoviePoster } from "../MoviePoster";
import { RatingBadge } from "../ui/badges";

type Row = Movie & { upcoming: number };

function toInput(m: Movie) {
  const { id: _i, slug: _s, createdAt: _c, updatedAt: _u, ...rest } = m;
  return rest;
}

export function MovieList({ movies }: { movies: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const togglePublish = async (m: Row) => {
    setBusy(m.id);
    setMessage(null);
    try {
      await api(`/api/admin/movies/${m.id}`, { method: "PATCH", json: { ...toInput(m), published: !m.published } });
      setMessage({ text: `${m.title} ${m.published ? "unpublished" : "published"}.`, ok: true });
      router.refresh();
    } catch (e) {
      setMessage({ text: (e as ApiError).message, ok: false });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: Row) => {
    setBusy(m.id);
    setMessage(null);
    try {
      await api(`/api/admin/movies/${m.id}`, { method: "DELETE" });
      setMessage({ text: `${m.title} deleted.`, ok: true });
      router.refresh();
    } catch (e) {
      setMessage({ text: (e as ApiError).message, ok: false });
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  };

  return (
    <>
      {message && (
        <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.ok ? "border-success-400/30 text-success-400" : "border-danger-400/30 bg-danger-700/30 text-danger-400"}`}>
          {message.text}
        </p>
      )}
      <ul className="grid gap-3">
        {movies.map((m) => (
          <li key={m.id} className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <MoviePoster movie={m} className="aspect-[2/3] w-14 shrink-0 rounded-lg" showTitle={false} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-xl">
                  <span className="truncate">{m.title}</span>
                  {m.featured && <Star className="h-4 w-4 shrink-0 fill-gold-400 text-gold-400" aria-label="Featured" />}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <RatingBadge rating={m.rating} /> {m.genres.join(" · ")} · {formatRuntime(m.runtimeMin)}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {m.status === "now_showing" ? "Now showing" : `Coming ${formatDayKey(m.releaseDate)}`} · {m.upcoming} upcoming screening{m.upcoming === 1 ? "" : "s"}
                  {!m.posterUrl && " · generated artwork"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${m.published ? "border-success-400/30 text-success-400" : "text-fg-subtle"}`}>{m.published ? "Published" : "Hidden"}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy === m.id} onClick={() => togglePublish(m)}>
                {busy === m.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : m.published ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                {m.published ? "Unpublish" : "Publish"}
              </button>
              <Link href={`/admin/movies/${m.id}`} className="btn btn-secondary btn-sm">
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Link>
              {confirmDelete === m.id ? (
                <span className="flex items-center gap-1" role="alertdialog" aria-label={`Confirm delete ${m.title}`}>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy === m.id} onClick={() => remove(m)}>
                    Delete permanently
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(m.id)} aria-label={`Delete ${m.title}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
