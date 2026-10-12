"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import type { PriceTable, Screening } from "@/lib/types";
import { dateKey, formatDayKey, formatTime, formatUSD, timeKey } from "@/lib/format";
import { api, type ApiError } from "@/lib/client-store";
import { Meter } from "./ui";

type Row = Screening & { movieTitle: string; auditoriumName: string; capacity: number; occupied: number; held: number; hasBookings: boolean };

interface Props {
  screenings: Row[];
  movies: { id: string; title: string; runtimeMin: number; published: boolean }[];
  auditoriums: { id: string; name: string }[];
  defaults: PriceTable;
  today: string;
}

export function ScreeningManager({ screenings, movies, auditoriums, defaults, today }: Props) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [aud, setAud] = useState("");
  const days = [...new Set(screenings.map((s) => dateKey(s.startsAt)))];
  const visible = screenings.filter((s) => !aud || s.auditoriumId === aud);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-fg-muted">Auditorium</span>
          <select className="field w-auto" value={aud} onChange={(e) => setAud(e.target.value)}>
            <option value="">All</option>
            {auditoriums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> New screening
        </button>
      </div>

      {editing && (
        <ScreeningForm
          key={editing === "new" ? "new" : editing.id}
          screening={editing === "new" ? null : editing}
          movies={movies}
          auditoriums={auditoriums}
          defaults={defaults}
          today={today}
          onDone={() => setEditing(null)}
        />
      )}

      {days.map((d) => {
        const list = visible.filter((s) => dateKey(s.startsAt) === d);
        if (!list.length) return null;
        return (
          <section key={d} aria-label={formatDayKey(d, "long")}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">{formatDayKey(d, "long")}</h2>
            <ul className="surface divide-y divide-white/[0.05]">
              {list.map((s) => (
                <li key={s.id} className={clsx("grid items-center gap-3 p-3 sm:grid-cols-[5rem_1.4fr_1fr_1fr_auto] sm:px-4", s.status === "cancelled" && "opacity-50")}>
                  <span className="font-display text-2xl tabular-nums">{formatTime(s.startsAt)}</span>
                  <span>
                    <span className="block font-medium">{s.movieTitle}</span>
                    <span className="text-xs text-fg-subtle">
                      {s.auditoriumName} · {s.format}
                      {s.status === "cancelled" && " · cancelled"}
                    </span>
                  </span>
                  <span className="text-xs text-fg-muted">
                    Std {formatUSD(s.prices.standard)} · VIP {formatUSD(s.prices.vip)}
                  </span>
                  <span>
                    <Meter value={s.occupied / s.capacity} held={s.held / s.capacity} label={`${s.movieTitle} ${formatTime(s.startsAt)} occupancy`} />
                    <span className="text-[0.7rem] text-fg-subtle">
                      {s.occupied}/{s.capacity} booked{s.held ? ` · ${s.held} held` : ""}
                    </span>
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm justify-self-start sm:justify-self-end" onClick={() => setEditing(s)} aria-label={`Edit ${s.movieTitle} at ${formatTime(s.startsAt)}`}>
                    <Pencil className="h-4 w-4" aria-hidden /> Edit
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ScreeningForm({
  screening,
  movies,
  auditoriums,
  defaults,
  today,
  onDone,
}: {
  screening: Row | null;
  movies: Props["movies"];
  auditoriums: Props["auditoriums"];
  defaults: PriceTable;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const p = screening?.prices ?? defaults;
  const [f, setF] = useState({
    movieId: screening?.movieId ?? movies.find((m) => m.published)?.id ?? "",
    auditoriumId: screening?.auditoriumId ?? auditoriums[0]?.id ?? "",
    date: screening ? dateKey(screening.startsAt) : today,
    time: screening ? timeKey(screening.startsAt) : "19:00",
    format: screening?.format ?? "2D",
    standard: (p.standard / 100).toFixed(2),
    vip: (p.vip / 100).toFixed(2),
    accessible: (p.accessible / 100).toFixed(2),
    status: screening?.status ?? "scheduled",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!screening?.hasBookings;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const cents = (v: string) => Math.round(Number(v) * 100);
    if ([f.standard, f.vip, f.accessible].some((v) => !/^\d+(\.\d{1,2})?$/.test(v))) {
      setError("Prices must be amounts in US dollars, e.g. 7.00");
      setBusy(false);
      return;
    }
    try {
      await api(screening ? `/api/admin/screenings/${screening.id}` : "/api/admin/screenings", {
        method: screening ? "PATCH" : "POST",
        json: {
          movieId: f.movieId,
          auditoriumId: f.auditoriumId,
          date: f.date,
          time: f.time,
          format: f.format,
          status: f.status,
          prices: { standard: cents(f.standard), vip: cents(f.vip), accessible: cents(f.accessible) },
        },
      });
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="surface relative p-5" aria-label={screening ? "Edit screening" : "New screening"}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">{screening ? "Edit screening" : "New screening"}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
      {locked && <p className="mb-4 text-sm text-warning-400">This screening has active bookings: its movie and auditorium are locked. Time, format and prices for new sales can still change.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <L label="Movie" id="s-movie" className="lg:col-span-2">
          <select id="s-movie" className="field" value={f.movieId} onChange={set("movieId")} disabled={locked}>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.runtimeMin} min){m.published ? "" : " — hidden"}
              </option>
            ))}
          </select>
        </L>
        <L label="Auditorium" id="s-aud">
          <select id="s-aud" className="field" value={f.auditoriumId} onChange={set("auditoriumId")} disabled={locked}>
            {auditoriums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </L>
        <L label="Format" id="s-format">
          <select id="s-format" className="field" value={f.format} onChange={set("format")}>
            <option>2D</option>
            <option>3D</option>
          </select>
        </L>
        <L label="Date" id="s-date">
          <input id="s-date" type="date" className="field" value={f.date} onChange={set("date")} required />
        </L>
        <L label="Start time (Monrovia)" id="s-time">
          <input id="s-time" type="time" className="field" value={f.time} onChange={set("time")} required />
        </L>
        <L label="Status" id="s-status">
          <select id="s-status" className="field" value={f.status} onChange={set("status")}>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </L>
        <div />
        <L label="Standard price (USD)" id="s-std">
          <input id="s-std" inputMode="decimal" className="field" value={f.standard} onChange={set("standard")} />
        </L>
        <L label="VIP price (USD)" id="s-vip">
          <input id="s-vip" inputMode="decimal" className="field" value={f.vip} onChange={set("vip")} />
        </L>
        <L label="Accessible price (USD)" id="s-acc">
          <input id="s-acc" inputMode="decimal" className="field" value={f.accessible} onChange={set("accessible")} />
        </L>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger-400/30 bg-danger-700/30 px-4 py-3 text-sm text-danger-400">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {screening ? "Save screening" : "Create screening"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function L({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}
