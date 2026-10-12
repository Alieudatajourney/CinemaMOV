// Dev helper: screenshots of movie details, mobile checkout/ticket and the print layout.
// Usage: node scripts/visual-check.mjs <outDir>
import { chromium, devices } from "@playwright/test";

const [, , out = "."] = process.argv;
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const errors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()} ${e}`));
};

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(desk);
await desk.goto(`${base}/movies/midnight-at-mamba-point`, { waitUntil: "networkidle" });
await desk.screenshot({ path: `${out}/details.png`, fullPage: true });

const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const m = await ctx.newPage();
watch(m);
await m.goto(`${base}/movies/little-lions`, { waitUntil: "networkidle" });
await m.locator('#showtimes a[href^="/book/"]').first().click();
await m.waitForURL(/\/book\//);
await m.waitForLoadState("networkidle");
await m.locator('button.seat[data-state="available"]').first().tap();
await m.screenshot({ path: `${out}/m-seats.png` });
await m.getByRole("button", { name: "Continue" }).last().tap();
await m.waitForURL(/\/checkout\//);
await m.getByLabel("Full name").fill("Hawa Kamara");
await m.getByLabel("Mobile number").fill("0886 123 456");
await m.screenshot({ path: `${out}/m-checkout.png`, fullPage: true });
await m.getByRole("radio", { name: /Pay at Cinema/ }).tap();
await m.getByRole("button", { name: /Reserve/ }).tap();
await m.waitForURL(/\/booking\//, { timeout: 15000 });
await m.waitForLoadState("networkidle");
await m.screenshot({ path: `${out}/m-ticket.png`, fullPage: true });

const printPage = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await printPage.goto(m.url(), { waitUntil: "networkidle" });
await printPage.emulateMedia({ media: "print" });
await printPage.screenshot({ path: `${out}/print.png`, fullPage: true });

console.log(JSON.stringify({ ticket: m.url(), errors }, null, 1));
await browser.close();
