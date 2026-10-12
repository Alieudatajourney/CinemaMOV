import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const ADMIN = { email: "admin@monroviacinemaplus.demo", password: "PlusAdmin#2026" };
export const STAFF = { email: "staff@monroviacinemaplus.demo", password: "PlusStaff#2026" };

/** Tomorrow's date in Monrovia (UTC+0) — every seeded film has bookable screenings then. */
export function tomorrowKey() {
  const d = new Date(Date.now() + 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Monrovia", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function login(page: Page, who = ADMIN, next = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function apiLogin(request: APIRequestContext, who = ADMIN) {
  const res = await request.post("/api/auth/login", { data: who });
  expect(res.ok()).toBeTruthy();
}

/** Reset to fresh demo data (exercises the protected reset endpoint). */
export async function resetDemo(request: APIRequestContext) {
  await apiLogin(request, ADMIN);
  const res = await request.post("/api/admin/reset", { data: { confirm: "RESET" } });
  expect(res.ok()).toBeTruthy();
  await request.post("/api/auth/logout");
}

/** Find a bookable screening id for tomorrow via the public Movies page. */
export async function pickScreening(page: Page, nth = 0) {
  await page.goto(`/movies?day=${tomorrowKey()}`);
  const links = page.locator('a[href^="/book/"]');
  await expect(links.first()).toBeVisible();
  const href = await links.nth(nth).getAttribute("href");
  return href!.replace("/book/", "");
}

export async function freeSeats(request: APIRequestContext, screeningId: string, layoutSeats: string[]) {
  const res = await request.get(`/api/screenings/${screeningId}/seats`);
  const { states } = (await res.json()) as { states: Record<string, string> };
  return layoutSeats.filter((s) => !states[s]);
}

/** Customer flow up to the checkout page. Returns the chosen seat ids. */
export async function chooseSeats(page: Page, screeningId: string, count: number) {
  await page.goto(`/book/${screeningId}`);
  const available = page.locator('button.seat[data-state="available"][data-category="standard"]');
  await expect(available.first()).toBeVisible();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const seat = available.nth(i * 2);
    ids.push((await seat.getAttribute("data-seat"))!);
    await seat.click();
  }
  return ids;
}

export async function fillCustomer(page: Page, c = { name: "Test Customer", phone: "+231 77 555 0101", email: "test.customer@example.com" }) {
  await page.getByLabel("Full name").fill(c.name);
  await page.getByLabel("Mobile number").fill(c.phone);
  await page.getByLabel("Email (optional)").fill(c.email);
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/** From the seat map: Continue → snacks step (skip, or add the featured combo) → checkout. */
export async function toCheckout(page: Page, opts: { addCombo?: boolean } = {}) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/snacks\//);
  await expect(page.getByRole("heading", { name: "Snacks & drinks" })).toBeVisible();
  if (opts.addCombo) {
    await page.getByRole("button", { name: "Add combo" }).click();
    await page.getByRole("button", { name: "Continue to payment" }).click();
  } else {
    await page.getByRole("button", { name: "Skip snacks" }).click();
  }
  await expect(page).toHaveURL(/\/checkout\//);
}
