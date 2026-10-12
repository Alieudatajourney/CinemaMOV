"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { ConcessionCategory, ConcessionItem } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/concessions";
import { formatUSD } from "@/lib/format";
import { api, type ApiError } from "@/lib/client-store";
import { SnackImage } from "../snacks/SnackImage";

type Draft = Omit<ConcessionItem, "id" | "variants"> & { variants: { id: string; label: string; price: string }[] };

const EMPTY: Draft = {
  name: "",
  description: "",
  category: "popcorn",
  imageUrl: "",
  available: true,
  featured: false,
  variants: [{ id: "r", label: "Regular", price: "3.00" }],
};

function toDraft(i: ConcessionItem): Draft {
  return { ...i, imageUrl: i.imageUrl ?? "", variants: i.variants.map((v) => ({ id: v.id, label: v.label, price: (v.priceCents / 100).toFixed(2) })) };
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    category: d.category,
    imageUrl: d.imageUrl,
    available: d.available,
    featured: d.featured,
    variants: d.variants.map((v) => ({ id: v.id.trim(), label: v.label.trim(), priceCents: Math.round(Number(v.price) * 100) })),
  };
}

export function SnackMenuManager({ menu, sold }: { menu: ConcessionItem[]; sold: Record<string, number> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as ApiError).message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (item: ConcessionItem) =>
    run(item.id, () => api(`/api/admin/concessions/${item.id}`, { method: "PATCH", json: { ...toPayload(toDraft(item)), available: !item.available } }), `${item.name} marked ${item.available ? "sold out" : "available"}.`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {msg ? (
          <p role={msg.ok ? "status" : "alert"} className={clsx("text-sm", msg.ok ? "text-success-400" : "text-danger-400")}>
            {msg.text}
          </p>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ id: null, draft: structuredClone(EMPTY) })}>
          <Plus className="h-4 w-4" aria-hidden /> Add menu item
        </button>
      </div>

      {editing && (
        <ItemForm
          key={editing.id ?? "new"}
          initial={editing.draft}
          isNew={!editing.id}
          busy={busy === "form"}
          onCancel={() => setEditing(null)}
          onSave={async (d) => {
            const ok = await run(
              "form",
              () =>
                editing.id
                  ? api(`/api/admin/concessions/${editing.id}`, { method: "PATCH", json: toPayload(d) })
                  : api("/api/admin/concessions", { method: "POST", json: toPayload(d) }),
              `${d.name} saved.`,
            );
            if (ok) setEditing(null);
          }}
        />
      )}

      {CATEGORY_ORDER.map((cat) => {
        const items = menu.filter((m) => m.category === cat.id);
        if (!items.length) return null;
        return (
          <section key={cat.id} aria-labelledby={`adm-${cat.id}`}>
            <h2 id={`adm-${cat.id}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              {cat.label}
            </h2>
            <ul className="surface divide-y divide-white/[0.05]">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <SnackImage item={item} className="h-14 w-20 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {item.name} {item.featured && <span className="chip ml-1">Featured</span>}
                      </p>
                      <p className="text-xs text-fg-muted">{item.variants.map((v) => `${v.label} ${formatUSD(v.priceCents)}`).join(" · ")}</p>
                      <p className="text-xs text-fg-subtle">{sold[item.id] ?? 0} sold (paid orders)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={clsx("btn btn-sm", item.available ? "btn-secondary" : "btn-ghost text-warning-400")}
                      disabled={busy === item.id}
                      onClick={() => toggle(item)}
                      aria-pressed={!item.available}
                    >
                      {busy === item.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      {item.available ? "Available" : "Sold out"}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: item.id, draft: toDraft(item) })}>
                      <Pencil className="h-4 w-4" aria-hidden /> Edit
                    </button>
                    {confirmDelete === item.id ? (
                      <span className="flex gap-1" role="alertdialog" aria-label={`Confirm delete ${item.name}`}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            await run(item.id, () => api(`/api/admin/concessions/${item.id}`, { method: "DELETE" }), `${item.name} removed from the menu.`);
                            setConfirmDelete(null);
                          }}
                        >
                          Delete
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(item.id)} aria-label={`Delete ${item.name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ItemForm({ initial, isNew, busy, onCancel, onSave }: { initial: Draft; isNew: boolean; busy: boolean; onCancel: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (d.name.trim().length < 2) return setErr("Enter a name.");
    if (d.variants.some((v) => !v.label.trim() || !/^\d+(\.\d{1,2})?$/.test(v.price))) return setErr("Each size needs a label and a price in US dollars, e.g. 4.50.");
    setErr(null);
    onSave(d);
  };

  return (
    <form onSubmit={submit} className="surface p-5" aria-label={isNew ? "New menu item" : "Edit menu item"}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">{isNew ? "New menu item" : `Edit ${initial.name}`}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sn-name" className="label">
            Name
          </label>
          <input id="sn-name" className="field" value={d.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label htmlFor="sn-cat" className="label">
            Category
          </label>
          <select id="sn-cat" className="field" value={d.category} onChange={(e) => set("category", e.target.value as ConcessionCategory)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sn-desc" className="label">
            Description
          </label>
          <input id="sn-desc" className="field" value={d.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sn-img" className="label">
            Photo URL (optional)
          </label>
          <input id="sn-img" className="field" value={d.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value)} placeholder="/media/snacks/popcorn.jpg or https://…" />
          <p className="mt-1 text-xs text-fg-subtle">An illustrated placeholder is shown if no photo is set or it fails to load.</p>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="label">Sizes & prices (USD)</legend>
          <div className="space-y-2">
            {d.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[4rem_1fr_7rem_auto] items-center gap-2">
                <input aria-label="Size code" className="field font-mono" value={v.id} onChange={(e) => set("variants", d.variants.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
                <input aria-label="Size label" className="field" value={v.label} onChange={(e) => set("variants", d.variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input aria-label="Price" inputMode="decimal" className="field" value={v.price} onChange={(e) => set("variants", d.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <button type="button" className="btn btn-ghost btn-sm" disabled={d.variants.length === 1} onClick={() => set("variants", d.variants.filter((_, j) => j !== i))} aria-label="Remove size">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          {d.variants.length < 5 && (
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => set("variants", [...d.variants, { id: `v${d.variants.length + 1}`, label: "", price: "" }])}>
              <Plus className="h-4 w-4" aria-hidden /> Add size
            </button>
          )}
        </fieldset>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold-400)]" checked={d.available} onChange={(e) => set("available", e.target.checked)} /> Available to order
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold-400)]" checked={!!d.featured} onChange={(e) => set("featured", e.target.checked)} /> Feature (combos appear as the highlighted offer)
          </label>
        </div>
      </div>
      {err && (
        <p role="alert" className="mt-4 text-sm text-danger-400">
          {err}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Save item
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
