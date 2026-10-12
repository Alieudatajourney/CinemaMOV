"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import type { Auditorium, CinemaSettings } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { parseLayout, rowsToText, textToRows, validateLayout } from "@/lib/seating";
import { api, type ApiError } from "@/lib/client-store";

function useSave() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as ApiError).message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success-400" : "text-danger-400"}`}>
      {msg.text}
    </p>
  );
}

export function SettingsForm({ settings }: { settings: CinemaSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    ...settings,
    std: (settings.defaultPrices.standard / 100).toFixed(2),
    vip: (settings.defaultPrices.vip / 100).toFixed(2),
    acc: (settings.defaultPrices.accessible / 100).toFixed(2),
  });
  const { busy, msg, run } = useSave();
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setS({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const [priceError, setPriceError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // An empty box must not silently become $0.00.
    if ([s.std, s.vip, s.acc].some((v) => !/^\d+(\.\d{1,2})?$/.test(String(v).trim()))) {
      setPriceError("Enter each default price in US dollars, e.g. 7.00.");
      return;
    }
    setPriceError(null);
    const c = (v: string) => Math.round(Number(v) * 100);
    run(
      () =>
        api("/api/admin/settings", {
          method: "PATCH",
          json: {
            phone: s.phone,
            email: s.email,
            addressLine: s.addressLine,
            hours: s.hours,
            mapUrl: s.mapUrl,
            contactIsPlaceholder: s.contactIsPlaceholder,
            holdMinutes: Number(s.holdMinutes),
            pendingPaymentMinutes: Number(s.pendingPaymentMinutes),
            maxTicketsPerBooking: Number(s.maxTicketsPerBooking),
            cleaningBufferMin: Number(s.cleaningBufferMin),
            demoPaymentMode: s.demoPaymentMode,
            defaultPrices: { standard: c(s.std), vip: c(s.vip), accessible: c(s.acc) },
          },
        }).then(() => router.refresh()),
      "Settings saved.",
    );
  };

  return (
    <form onSubmit={submit} className="surface p-5 sm:p-6" aria-labelledby="cinema-settings">
      <h2 id="cinema-settings" className="font-display text-2xl">
        Cinema & booking rules
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {settings.name} · {settings.venue}, {settings.city}, {settings.country}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <In label="Address line" id="addr" value={s.addressLine} onChange={set("addressLine")} className="lg:col-span-2" />
        <In label="Phone" id="phone" value={s.phone} onChange={set("phone")} />
        <In label="Email" id="email" value={s.email} onChange={set("email")} />
        <In label="Opening hours" id="hours" value={s.hours} onChange={set("hours")} />
        <In label="Map link (https)" id="map" value={s.mapUrl} onChange={set("mapUrl")} />
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
          <input type="checkbox" checked={s.contactIsPlaceholder} onChange={set("contactIsPlaceholder")} className="h-4 w-4 accent-[var(--gold-400)]" />
          Mark contact details as unverified placeholders on the public site
        </label>
        <In label="Seat hold (minutes)" id="hold" type="number" value={String(s.holdMinutes)} onChange={set("holdMinutes")} />
        <In label="Pending payment window (minutes)" id="pend" type="number" value={String(s.pendingPaymentMinutes)} onChange={set("pendingPaymentMinutes")} />
        <In label="Max tickets per booking" id="max" type="number" value={String(s.maxTicketsPerBooking)} onChange={set("maxTicketsPerBooking")} />
        <In label="Changeover between screenings (min)" id="buf" type="number" value={String(s.cleaningBufferMin)} onChange={set("cleaningBufferMin")} />
        <div>
          <label htmlFor="mode" className="label">
            Demo payment behaviour
          </label>
          <select id="mode" className="field" value={s.demoPaymentMode} onChange={set("demoPaymentMode")}>
            <option value="customer_choice">Customer chooses outcome (pitch mode)</option>
            <option value="always_succeed">Always approve</option>
            <option value="always_pending">Always pending</option>
            <option value="always_fail">Always decline</option>
            <option value="random">Random (70% approve)</option>
          </select>
        </div>
        <div />
        <In label="Default standard price (USD)" id="dstd" value={s.std} onChange={set("std")} />
        <In label="Default VIP price (USD)" id="dvip" value={s.vip} onChange={set("vip")} />
        <In label="Default accessible price (USD)" id="dacc" value={s.acc} onChange={set("acc")} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Save settings
        </button>
        <Msg msg={msg} />
        {priceError && (
          <p role="alert" className="text-sm text-danger-400">
            {priceError}
          </p>
        )}
      </div>
    </form>
  );
}

export function AuditoriumEditor({ auditorium }: { auditorium: Auditorium }) {
  const router = useRouter();
  const [name, setName] = useState(auditorium.name);
  const [description, setDescription] = useState(auditorium.description);
  const [text, setText] = useState(rowsToText(auditorium.rows));
  const { busy, msg, run } = useSave();
  const rows = useMemo(() => textToRows(text), [text]);
  const v = validateLayout(rows);
  const seats = v.ok ? parseLayout(rows) : [];
  const counts = { standard: 0, vip: 0, accessible: 0 } as Record<string, number>;
  seats.forEach((s) => counts[s.category]++);

  return (
    <section className="surface p-5 sm:p-6" aria-labelledby={`aud-${auditorium.id}`}>
      <h2 id={`aud-${auditorium.id}`} className="font-display text-2xl">
        {auditorium.name} <span className="text-base text-fg-subtle">· {auditorium.shortName} layout</span>
      </h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <In label="Name" id={`n-${auditorium.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          <In label="Description" id={`d-${auditorium.id}`} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label htmlFor={`l-${auditorium.id}`} className="label">
              Seat layout — one row per line
            </label>
            <textarea id={`l-${auditorium.id}`} className="field min-h-60 font-mono text-sm leading-6" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            <p className="mt-1.5 text-xs text-fg-subtle">
              <code>S</code> standard · <code>V</code> VIP · <code>A</code> accessible · <code>_</code> aisle · <code>.</code> empty floor. Seats are numbered from the left.
            </p>
          </div>
        </div>
        <div>
          <p className="label">Preview</p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-ink-950 p-4">
            <div className="mx-auto mb-3 h-1 w-3/4 rounded-full bg-gradient-to-r from-transparent via-gold-300 to-transparent" aria-hidden />
            {v.ok ? (
              <div className="mx-auto flex w-max flex-col gap-1" aria-label="Layout preview">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-1">
                    <span className="w-5 text-center text-[0.65rem] text-fg-subtle">{r.label}</span>
                    {[...r.pattern].map((ch, i) => (
                      <span
                        key={i}
                        className={
                          ch === "S"
                            ? "h-3.5 w-3.5 rounded-[3px] bg-ink-600"
                            : ch === "V"
                              ? "h-3.5 w-3.5 rounded-[3px] bg-velvet-500"
                              : ch === "A"
                                ? "h-3.5 w-3.5 rounded-[3px] bg-held-400"
                                : ch === "_"
                                  ? "w-2"
                                  : "w-3.5"
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <ul className="list-inside list-disc text-sm text-danger-400" role="alert">
                {v.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
          {v.ok && (
            <p className="mt-2 text-sm text-fg-muted">
              {seats.length} seats · {counts.standard} standard · {counts.vip} VIP · {counts.accessible} accessible
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !v.ok}
          onClick={() =>
            run(() => api(`/api/admin/auditoriums/${auditorium.id}`, { method: "PATCH", json: { name, description, rows } }).then(() => router.refresh()), "Layout saved.")
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Save layout
        </button>
        <Msg msg={msg} />
      </div>
      <p className="mt-3 text-xs text-fg-subtle">Seats that are booked or held for upcoming screenings cannot be removed. Ticket prices are set per screening.</p>
    </section>
  );
}

export function ResetDemo({ seededAt }: { seededAt: string }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const { busy, msg, run } = useSave();
  return (
    <section className="rounded-[var(--radius-lg)] border border-danger-400/30 bg-danger-700/15 p-5 sm:p-6" aria-labelledby="reset-title">
      <h2 id="reset-title" className="font-display text-2xl">
        Reset demo data
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Replaces every movie, screening, booking, ticket and setting with fresh sample data scheduled from today. This cannot be undone. Last reset{" "}
        {formatDateTime(seededAt)}.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="reset-phrase" className="label">
            Type RESET to confirm
          </label>
          <input id="reset-phrase" className="field w-48 font-mono" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
        </div>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || phrase !== "RESET"}
          onClick={async () => {
            const ok = await run(() => api("/api/admin/reset", { method: "POST", json: { confirm: "RESET" } }), "Demo data reset.");
            if (ok) {
              setPhrase("");
              router.refresh();
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Reset all demo data
        </button>
        <Msg msg={msg} />
      </div>
    </section>
  );
}

function In({
  label,
  id,
  className,
  ...rest
}: { label: string; id: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="field" {...rest} />
    </div>
  );
}
