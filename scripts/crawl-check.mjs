// Dev helper: visit every page (desktop + mobile, signed in as admin) and report console
// errors/warnings (incl. hydration mismatches) and horizontal overflow.
import { chromium, devices } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome" });
const ctxs = { desktop: await browser.newContext({ viewport: { width: 1440, height: 900 } }), mobile: await browser.newContext({ ...devices["iPhone 13"] }) };
const results = [];
for (const [name, ctx] of Object.entries(ctxs)) {
  const page = await ctx.newPage();
  const res = await page.request.post(`${base}/api/auth/login`, { data: { email: "admin@monroviacinemaplus.demo", password: "PlusAdmin#2026" } });
  if (!res.ok()) throw new Error("login failed");
  await page.goto(`${base}/movies`, { waitUntil: "networkidle" });
  const book = await page.locator('a[href^="/book/"]').first().getAttribute("href");
  const movieLinks = await page.locator('a[href^="/movies/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
  const paths = ["/", "/movies", ...movieLinks.slice(0, 9), book, "/my-tickets", "/login", "/staff", "/admin", "/admin/movies", "/admin/movies/new", "/admin/screenings", "/admin/bookings", "/admin/tickets", "/admin/snacks", "/admin/settings", "/does-not-exist", "/booking/MCP-AAAA-AAAA?k=nope", "/checkout/hold_nope", "/snacks/hold_nope"];
  for (const p of paths) {
    const msgs = [];
    const onC = (m) => (m.type() === "error" || m.type() === "warning") && msgs.push(`${m.type()}: ${m.text().slice(0, 220)}`);
    const onE = (e) => msgs.push(`pageerror: ${String(e).slice(0, 220)}`);
    page.on("console", onC);
    page.on("pageerror", onE);
    const r = await page.goto(base + p, { waitUntil: "networkidle" }).catch((e) => ({ status: () => String(e) }));
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    page.off("console", onC);
    page.off("pageerror", onE);
    results.push({ ctx: name, path: p, status: r?.status?.(), overflowPx: over > 0 ? over : 0, msgs: [...new Set(msgs)] });
  }
}
for (const r of results) if (r.msgs.length || r.overflowPx || (r.status !== 200 && !r.path.includes("does-not-exist"))) console.log(JSON.stringify(r));
console.log(`checked ${results.length} page loads`);
await browser.close();
