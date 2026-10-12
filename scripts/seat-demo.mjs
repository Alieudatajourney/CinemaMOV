// Dev helper: open a seat map, select seats, screenshot. Usage: node scripts/seat-demo.mjs <screeningId> <outPrefix> [width] [height]
import { chromium } from "@playwright/test";

const [, , id, out = "seat", width = "1440", height = "1000"] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: +width, height: +height } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${base}/book/${id}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}-empty.png`, fullPage: true });
const avail = page.locator('button.seat[data-state="available"]');
const n = await avail.count();
await avail.nth(Math.floor(n * 0.55)).click();
await avail.nth(Math.floor(n * 0.55)).click();
const vip = page.locator('button.seat[data-state="available"][data-category="vip"]');
if (await vip.count()) await vip.first().click();
const occ = page.locator('button.seat[data-state="occupied"]');
if (await occ.count()) await occ.first().click({ force: true });
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}-selected.png`, fullPage: false });
console.log(JSON.stringify({ seats: n, errors }, null, 1));
await browser.close();
