// Dev helper: screenshots of the home page, a film page and the snacks step (desktop + mobile).
// Usage: node scripts/snacks-demo.mjs <outDir>
import { chromium, devices } from "@playwright/test";

const [, , out = "."] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const errors = [];
const watch = (p) => {
  p.on("console", (m) => m.type() === "error" && errors.push(`${p.url()} ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${p.url()} ${e}`));
};

async function toSnacks(page, film) {
  await page.goto(`${base}/movies/${film}`, { waitUntil: "networkidle" });
  await page.locator('#showtimes a[href^="/book/"]').first().click();
  await page.waitForURL(/\/book\//);
  await page.waitForLoadState("networkidle");
  const seats = page.locator('button.seat[data-state="available"][data-category="standard"]');
  await seats.nth(4).click();
  await seats.nth(4).click();
}

const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(d);
await d.goto(base, { waitUntil: "networkidle" });
await d.screenshot({ path: `${out}/home-real.png` });
await d.goto(`${base}/movies/forgotten-island`, { waitUntil: "networkidle" });
await d.screenshot({ path: `${out}/details-real.png` });
await toSnacks(d, "forgotten-island");
await d.getByRole("button", { name: "Continue", exact: true }).click();
await d.waitForURL(/\/snacks\//);
await d.waitForLoadState("networkidle");
await d.getByRole("button", { name: "Add combo" }).click();
await d.getByRole("article", { name: "Nachos & Cheese" }).getByRole("button", { name: /Add/ }).click();
await d.waitForTimeout(500);
await d.screenshot({ path: `${out}/snacks-desktop.png`, fullPage: true });
await d.getByRole("button", { name: "Continue to payment" }).click();
await d.waitForURL(/\/checkout\//);
await d.getByLabel("Full name").waitFor();
await d.screenshot({ path: `${out}/checkout-snacks.png` });

const m = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
watch(m);
await toSnacks(m, "digger");
await m.getByLabel("Booking summary").last().getByRole("button", { name: "Continue" }).tap();
await m.waitForURL(/\/snacks\//);
await m.waitForLoadState("networkidle");
await m.getByRole("button", { name: "Add combo" }).tap();
await m.waitForTimeout(400);
await m.screenshot({ path: `${out}/snacks-mobile.png` });
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
