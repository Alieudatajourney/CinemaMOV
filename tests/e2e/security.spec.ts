import { expect, test } from "@playwright/test";
import { ADMIN, STAFF, apiLogin, pickScreening, resetDemo } from "./helpers";

test.beforeAll(async ({ request }) => {
  await resetDemo(request);
});

test("admin pages and APIs require an authorised session", async ({ page, request }) => {
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fbookings/);

  for (const [method, url, data] of [
    ["patch", "/api/admin/settings", {}],
    ["post", "/api/admin/movies", {}],
    ["post", "/api/admin/reset", { confirm: "RESET" }],
    ["post", "/api/staff/validate", { code: "MCP-AAAA-AAAA" }],
  ] as const) {
    const res = await request.fetch(url, { method, data });
    expect(res.status(), `${method} ${url}`).toBe(401);
  }

  // A forged cookie is rejected.
  const forged = await request.fetch("/api/admin/reset", {
    method: "post",
    data: { confirm: "RESET" },
    headers: { cookie: "mcp_session=eyJ1aWQiOiJ1c3JfYWRtaW4iLCJleHAiOjk5OTk5OTk5OTk5OTl9.forged" },
  });
  expect(forged.status()).toBe(401);

  // Staff may validate tickets but not manage the cinema.
  await apiLogin(request, STAFF);
  expect((await request.post("/api/admin/reset", { data: { confirm: "RESET" } })).status()).toBe(403);
  expect((await request.post("/api/staff/validate", { data: { code: "MCP-AAAA-AAAA" } })).status()).toBe(200);
  await request.post("/api/auth/logout");

  // Wrong password
  expect((await request.post("/api/auth/login", { data: { email: ADMIN.email, password: "nope" } })).status()).toBe(401);
});

test("cross-site POSTs are blocked", async ({ request }) => {
  const res = await request.post("/api/lookup", { data: { reference: "MCP-AAAA-AAAA", contact: "x@example.com" }, headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

test("server rejects taken seats, tampered prices and duplicate holds", async ({ page, request }) => {
  const screeningId = await pickScreening(page, 0);
  const { states } = await (await request.get(`/api/screenings/${screeningId}/seats`)).json();
  const occupied = Object.keys(states).find((k) => states[k] === "occupied")!;
  const r1 = await request.post("/api/holds", { data: { screeningId, seatIds: [occupied] } });
  expect(r1.status()).toBe(409);

  // Find two free seats from the map
  await page.goto(`/book/${screeningId}`);
  const free = await page.locator('button.seat[data-state="available"][data-category="standard"]').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute("data-seat")!));
  const hold = await (await request.post("/api/holds", { data: { screeningId, seatIds: free, priceCents: 1 } })).json();
  expect(hold.holdId).toBeTruthy();
  // The same seats can't be held twice.
  expect((await request.post("/api/holds", { data: { screeningId, seatIds: [free[0]] } })).status()).toBe(409);

  // Client-supplied totals are ignored: the server prices the seats itself.
  const view = await (await request.get(`/api/holds/${hold.holdId}`, { headers: { "x-hold-key": hold.holdKey } })).json();
  expect(view.quote.totalCents).toBeGreaterThan(100);
  // Hold details require the secret key.
  expect((await request.get(`/api/holds/${hold.holdId}`, { headers: { "x-hold-key": "guess-guess-guess" } })).status()).toBe(404);

  // Double submit with the same idempotency key → one booking.
  const body = {
    holdId: hold.holdId,
    holdKey: hold.holdKey,
    idempotencyKey: "e2e-idem-0001",
    method: "demo_online",
    demoOutcome: "succeeded",
    totalCents: 1,
    customer: { name: "Idem Potent", phone: "+231 77 000 1111" },
  };
  const [a, b] = await Promise.all([request.post("/api/checkout", { data: body }), request.post("/api/checkout", { data: body })]);
  const ja = await a.json();
  const jb = await b.json();
  expect(ja.reference).toBe(jb.reference);
  const booking = await (await request.get(`/api/bookings/${ja.reference}`, { headers: { "x-access-key": ja.accessKey } })).json();
  expect(booking.totalCents).toBe(view.quote.totalCents);
  // Booking details are private without the access key.
  expect((await request.get(`/api/bookings/${ja.reference}`)).status()).toBe(404);
});

test("admin: screening conflicts are rejected and cancellations release seats", async ({ page, request }) => {
  await apiLogin(request, ADMIN);
  const screeningId = await pickScreening(page, 0);
  const seatsPage = await page.goto(`/book/${screeningId}`);
  expect(seatsPage?.ok()).toBeTruthy();
  const free = await page.locator('button.seat[data-state="available"][data-category="standard"]').evaluateAll((els) => [els[0].getAttribute("data-seat")!]);

  // Conflict: same auditorium, overlapping time as an existing screening
  const m = /^scr_(\d{4})(\d{2})(\d{2})_(grand|lounge)_(\d{2})(\d{2})$/.exec(screeningId);
  if (m) {
    const res = await request.post("/api/admin/screenings", {
      data: {
        movieId: "mov_forgotten_island",
        auditoriumId: `aud_${m[4]}`,
        date: `${m[1]}-${m[2]}-${m[3]}`,
        time: `${m[5]}:${String(Number(m[6]) + 10).padStart(2, "0")}`,
        format: "2D",
        prices: { standard: 700, vip: 1200, accessible: 700 },
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.message).toMatch(/Conflicts with/);
  }

  // Book, then cancel as admin → seat is free again
  const hold = await (await request.post("/api/holds", { data: { screeningId, seatIds: free } })).json();
  const done = await (
    await request.post("/api/checkout", {
      data: { holdId: hold.holdId, holdKey: hold.holdKey, idempotencyKey: "e2e-cancel-1", method: "demo_online", demoOutcome: "succeeded", customer: { name: "Cancel Me", phone: "+231 77 000 2222" } },
    })
  ).json();
  let states = (await (await request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[free[0]]).toBe("occupied");

  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto(`/admin/bookings?q=${done.reference}`);
  await page.getByRole("button", { name: done.reference }).click();
  await page.getByRole("button", { name: "Cancel booking…" }).click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog").getByText("Cancelled", { exact: true })).toBeVisible();
  states = (await (await request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[free[0]]).toBeUndefined();
});

test("signing out revokes the session server-side", async ({ request, playwright, baseURL }) => {
  await apiLogin(request, ADMIN);
  const cookie = (await request.storageState()).cookies.find((c) => c.name === "mcp_session")!;
  expect((await request.get("/admin/settings")).status()).toBe(200);
  await request.post("/api/auth/logout");
  // Replay the copied cookie from a fresh client: it must no longer work.
  const replay = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `mcp_session=${cookie.value}` } });
  expect((await replay.patch("/api/admin/settings", { data: {} })).status()).toBe(401);
  await replay.dispose();
});

test("login never redirects off-site", async ({ page, baseURL }) => {
  await page.goto("/login?next=/%5Cevil.example");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
  await expect(page).toHaveURL(/\/admin$/);
});
