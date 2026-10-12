// Dev helper: screenshots of the party-size prompt, best-available pick and mobile checkout bar.
// Usage: node scripts/ux-demo.mjs <outDir>
import { chromium, devices } from "@playwright/test";

const [, , out = "."] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const errors = [];
const watch = (p) => {
  p.on("console", (m) => m.type() === "error" && errors.push(`${p.url()} ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${p.url()} ${e}`));
};
const firstShowtime = async (page, slug) => {
  await page.goto(`${base}/movies/${slug}`, { waitUntil: "networkidle" });
  await page.locator('#showtimes a[href^="/book/"]').first().click();
  await page.waitForURL(/\/book\//);
  await page.waitForLoadState("networkidle");
};

const d = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
watch(d);
await firstShowtime(d, "verity");
await d.screenshot({ path: `${out}/ux-prompt.png` });
await d.getByRole("button", { name: "3 tickets" }).click();
await d.waitForTimeout(900);
await d.screenshot({ path: `${out}/ux-best.png` });

const m = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
watch(m);
await firstShowtime(m, "digger");
await m.getByRole("button", { name: "2 tickets" }).tap();
await m.waitForTimeout(800);
await m.screenshot({ path: `${out}/ux-mobile-best.png` });
await m.getByLabel("Booking summary").last().getByRole("button", { name: "Continue" }).tap();
await m.waitForURL(/\/snacks\//);
await m.getByRole("button", { name: "Skip snacks" }).tap();
await m.waitForURL(/\/checkout\//);
await m.getByLabel("Full name").waitFor();
await m.screenshot({ path: `${out}/ux-mobile-checkout.png` });
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
