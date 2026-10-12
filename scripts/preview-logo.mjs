// Dev helper: preview the transparent logo on dark and light backgrounds. Usage: node scripts/preview-logo.mjs <out.png>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
const root = path.resolve(import.meta.dirname, "..");
const b64 = fs.readFileSync(path.join(root, "public/brand/logo-512.png")).toString("base64");
const img = `<img src="data:image/png;base64,${b64}" style="width:360px">`;
const html = `<body style="margin:0;display:flex">
  <div style="background:#0a0908;padding:30px">${img}</div>
  <div style="background:#1c1a17;padding:30px">${img.replace("360px", "56px")}<br><br>${img.replace("360px", "120px")}</div>
  <div style="background:#fff;padding:30px">${img}</div></body>`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1180, height: 460 } });
await p.setContent(html);
await p.screenshot({ path: process.argv[2] });
const z = await b.newPage({ viewport: { width: 700, height: 420 } });
await z.setContent(`<body style="margin:0;background:#0a0908"><img src="data:image/png;base64,${b64}" style="width:1400px;margin:-40px 0 0 -40px"></body>`);
await z.screenshot({ path: process.argv[2].replace(".png", "-zoom.png") });
await b.close();
