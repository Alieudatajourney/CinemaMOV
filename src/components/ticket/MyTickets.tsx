"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Search, Ticket, Trash2 } from "lucide-react";
import { api, ticketStore, type ApiError, type SavedTicket } from "@/lib/client-store";
import { formatDateTime } from "@/lib/format";

export function MyTickets() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedTicket[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read device storage after hydration
    setSaved(ticketStore.list());
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reference.trim().length < 6 || contact.trim().length < 5) {
      setError("Enter your booking reference and the phone number or email used when booking.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ reference: string; accessKey: string }>("/api/lookup", { method: "POST", json: { reference, contact } });
      router.push(`/booking/${r.reference}?k=${encodeURIComponent(r.accessKey)}`);
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={submit} noValidate className="surface p-6 sm:p-8" aria-labelledby="find-title">
        <h2 id="find-title" className="font-display text-3xl">
          Find a booking
        </h2>
        <p className="mt-2 text-sm text-fg-muted">For your security we need both the booking reference and a contact detail from the booking.</p>
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="ref" className="label">
              Booking reference
            </label>
            <input
              id="ref"
              className="field font-mono uppercase tracking-wider"
              placeholder="MCP-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="contact" className="label">
              Phone number or email
            </label>
            <input id="contact" className="field" placeholder="+231 77 123 4567 or you@example.com" autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} required />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger-400/30 bg-danger-700/30 px-4 py-3 text-sm text-danger-400">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg mt-6 w-full" disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
          Find my tickets
        </button>
      </form>

      <section aria-labelledby="device-title">
        <h2 id="device-title" className="font-display text-3xl">
          On this device
        </h2>
        <p className="mt-2 text-sm text-fg-muted">Tickets you booked or opened in this browser.</p>
        <ul className="mt-5 space-y-3">
          {saved === null && <li className="skeleton h-20" aria-hidden />}
          {saved?.length === 0 && (
            <li className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-fg-subtle">
              No tickets saved yet.{" "}
              <Link href="/movies" className="text-gold-300 underline">
                Browse movies
              </Link>
            </li>
          )}
          {saved?.map((t) => (
            <li key={t.reference} className="surface flex items-center gap-3 p-4">
              <Ticket className="h-6 w-6 shrink-0 text-gold-400" aria-hidden />
              <Link href={`/booking/${t.reference}?k=${encodeURIComponent(t.accessKey)}`} className="group min-w-0 flex-1">
                <p className="truncate font-semibold group-hover:text-gold-200">{t.title}</p>
                <p className="text-sm text-fg-muted">
                  {formatDateTime(t.startsAt)} · Seats {t.seats.join(", ")}
                </p>
                <p className="font-mono text-xs text-fg-subtle">{t.reference}</p>
              </Link>
              <ArrowRight className="h-4 w-4 text-fg-subtle" aria-hidden />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  ticketStore.remove(t.reference);
                  setSaved(ticketStore.list());
                }}
                aria-label={`Remove ${t.reference} from this device`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
