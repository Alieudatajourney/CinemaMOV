"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, Home, Loader2, Printer, Ticket } from "lucide-react";
import { api, ticketStore, type ApiError } from "@/lib/client-store";

export function TicketActions({
  reference,
  accessKey,
  title,
  startsAt,
  seats,
  printable,
}: {
  reference: string;
  accessKey: string;
  title: string;
  startsAt: string;
  seats: string[];
  printable: boolean;
}) {
  const [busy, setBusy] = useState(false);

  // Remember this ticket on this device for quick access from My Tickets.
  useEffect(() => {
    ticketStore.add({ reference, accessKey, title, startsAt, seats });
  }, [reference, accessKey, title, startsAt, seats]);

  const download = async () => {
    setBusy(true);
    const url = `/api/bookings/${reference}/ticket?k=${encodeURIComponent(accessKey)}`;
    try {
      const svg = await (await fetch(url, { cache: "no-store" })).text();
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = blobUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 2000;
      canvas.height = 840;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 2000, 840);
      URL.revokeObjectURL(blobUrl);
      const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!png) throw new Error("png");
      save(URL.createObjectURL(png), `MonroviaCinemaPlus-${reference}.png`);
    } catch {
      // Fallback: the SVG ticket itself.
      save(url, `MonroviaCinemaPlus-${reference}.svg`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap gap-3">
      {printable && (
        <>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> Print ticket
          </button>
          <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            Download ticket
          </button>
        </>
      )}
      <Link href="/my-tickets" className="btn btn-secondary">
        <Ticket className="h-4 w-4" aria-hidden /> View My Tickets
      </Link>
      <Link href="/" className="btn btn-ghost">
        <Home className="h-4 w-4" aria-hidden /> Back to Home
      </Link>
    </div>
  );
}

function save(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** DEMO gateway controls for a pending online payment, plus customer cancellation. */
export function PendingControls({ reference, accessKey, kind }: { reference: string; accessKey: string; kind: "pending" | "reserved" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const act = async (action: "confirm" | "fail" | "cancel") => {
    setBusy(action);
    setError(null);
    try {
      if (action === "cancel") await api(`/api/bookings/${reference}/cancel`, { method: "POST", json: { accessKey } });
      else await api(`/api/bookings/${reference}/payment`, { method: "POST", json: { accessKey, action } });
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <div className="no-print mt-5 space-y-3">
      {kind === "pending" && (
        <div className="rounded-2xl border border-warning-400/30 bg-warning-700/20 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-400">
            <span className="demo-badge">DEMO</span> Simulate the payment provider&apos;s response
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act("confirm")}>
              {busy === "confirm" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Confirm payment
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => act("fail")}>
              {busy === "fail" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Payment fails
            </button>
          </div>
        </div>
      )}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-danger-400/30 bg-danger-700/30 p-3 text-sm" role="alertdialog" aria-label="Confirm cancellation">
          <span className="text-fg">Cancel this {kind === "pending" ? "booking" : "reservation"} and release the seats?</span>
          <button type="button" className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => act("cancel")}>
            {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Yes, cancel
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
          Cancel {kind === "pending" ? "booking" : "reservation"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function PendingCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const lastRefresh = useRef(0);
  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(expiresAt) - Date.now();
      setLeft(Math.max(0, ms));
      // Ask the server once at zero, then at most every 10 s (device clocks may run ahead).
      if (ms <= 0 && Date.now() - lastRefresh.current > 10_000) {
        lastRefresh.current = Date.now();
        router.refresh();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, router]);
  if (left === null) return null;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="tabular-nums">
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}
