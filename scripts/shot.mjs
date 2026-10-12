// Dev helper: screenshot a page and report browser console errors.
// Usage: node scripts/shot.mjs <path> <out.png> [width] [height] [fullPage]
import { chromium } from "@playwright/test";

const [, , path = "/", out = "shot.png", width = "1440", height = "900", full = "1"] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full === "1" });
console.log(JSON.stringify({ url: page.url(), errors }, null, 1));
await browser.close();
