// Dev helper: render a grid of local media files to one PNG for review. Usage: node scripts/contact-sheet.mjs <out.png> <dir> [w]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const [, , out, dir, w = "300"] = process.argv;
const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const html = `<body style="margin:0;background:#111;color:#eee;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:8px">${files
  .map((f) => `<figure style="margin:0;width:${w}px"><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}" style="width:100%;height:${Math.round(+w * 0.75)}px;object-fit:cover"><figcaption>${f}</figcaption></figure>`)
  .join("")}</body>`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 4 * (+w + 8) + 8, height: 600 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
