// Dev helper: verify every film trailer plays in the embedded player. Usage: node scripts/check-trailers.mjs <slug>...
import { chromium } from "@playwright/test";
const slugs = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome" });
for (const slug of slugs) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(`http://localhost:3000/movies/${slug}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Watch trailer" }).first().click();
  await p.waitForTimeout(7000);
  const f = p.frames().find((x) => x.url().includes("youtube"));
  const r = await f?.evaluate(() => {
    const v = document.querySelector("video");
    return { playing: !!v && !v.paused && v.currentTime > 0, t: v?.currentTime, error: document.querySelector(".ytp-error")?.textContent?.slice(0, 80) ?? null };
  });
  console.log(slug.padEnd(42), JSON.stringify(r));
  await p.close();
}
await b.close();
