// Dev helper: sign in as admin, validate a ticket twice, screenshot ops pages.
// Usage: node scripts/ops-demo.mjs <outDir> [bookingReference]
import { chromium } from "@playwright/test";

const [, , out = ".", ref] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} ${e}`));

await page.goto(`${base}/admin`);
await page.waitForURL(/\/login/);
await page.getByRole("button", { name: "Use" }).first().click();
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/admin$/);
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${out}/admin.png`, fullPage: true });

if (ref) {
  await page.goto(`${base}/staff`, { waitUntil: "networkidle" });
  await page.getByLabel(/Manual entry/).fill(ref);
  await page.getByRole("button", { name: "Validate" }).click();
  await page.locator("[data-outcome]").waitFor();
  await page.screenshot({ path: `${out}/staff-1.png` });
  await page.getByRole("button", { name: "Scan next" }).click();
  await page.getByLabel(/Manual entry/).fill(ref);
  await page.getByRole("button", { name: "Validate" }).click();
  await page.locator('[data-outcome="already_redeemed"]').waitFor();
  await page.screenshot({ path: `${out}/staff-2.png` });
}

for (const p of ["bookings", "screenings", "movies", "tickets", "settings"]) {
  await page.goto(`${base}/admin/${p}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/admin-${p}.png`, fullPage: p !== "bookings" });
}
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
