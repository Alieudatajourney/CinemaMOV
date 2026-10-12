// Browser-side conveniences only (never the source of truth). Every access is guarded because
// storage can be unavailable (private mode, blocked site data).

export interface HoldRef {
  holdId: string;
  holdKey: string;
  screeningId: string;
  seatIds: string[];
}

export interface SavedTicket {
  reference: string;
  accessKey: string;
  title: string;
  startsAt: string;
  seats: string[];
}

function get<T>(storage: "local" | "session", key: string): T | null {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function set(storage: "local" | "session", key: string, value: unknown) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Seat holds belong to this browser tab session. */
export const holdStore = {
  get: (holdId: string) => get<HoldRef>("session", `mcp:hold:${holdId}`),
  forScreening: (screeningId: string) => {
    const id = get<string>("session", `mcp:screening-hold:${screeningId}`);
    return id ? holdStore.get(id) : null;
  },
  save: (h: HoldRef) => {
    set("session", `mcp:hold:${h.holdId}`, h);
    set("session", `mcp:screening-hold:${h.screeningId}`, h.holdId);
  },
  clear: (h: { holdId: string; screeningId: string }) => {
    set("session", `mcp:hold:${h.holdId}`, null);
    set("session", `mcp:screening-hold:${h.screeningId}`, null);
  },
  /** Remember which booking a finished hold became, so Back/refresh on earlier steps returns to the ticket. */
  markDone: (holdId: string, booking: { reference: string; accessKey: string }) => set("session", `mcp:hold-done:${holdId}`, booking),
  done: (holdId: string) => get<{ reference: string; accessKey: string }>("session", `mcp:hold-done:${holdId}`),
};

/** Tickets booked on this device, for quick access from My Tickets. */
export const ticketStore = {
  list: () => get<SavedTicket[]>("local", "mcp:tickets") ?? [],
  add: (t: SavedTicket) => {
    const list = ticketStore.list().filter((x) => x.reference !== t.reference);
    set("local", "mcp:tickets", [t, ...list].slice(0, 20));
  },
  remove: (reference: string) => set("local", "mcp:tickets", ticketStore.list().filter((x) => x.reference !== reference)),
};

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? "Something went wrong. Please try again.") as Error & {
      code?: string;
      status?: number;
      data?: Record<string, unknown>;
    };
    err.code = data?.error?.code;
    err.status = res.status;
    err.data = data?.error;
    throw err;
  }
  return data as T;
}
export type ApiError = Error & { code?: string; status?: number; data?: Record<string, unknown> };
