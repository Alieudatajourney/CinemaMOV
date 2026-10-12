// Builds transparent brand assets from the official logo (JPEG on white) using a headless browser
// canvas. Background removal = flood fill from the image border over near-white pixels (so white
// lettering inside the badge is kept), with a soft anti-aliased edge.
// Usage: node scripts/make-logo-assets.mjs <source.jpg>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/make-logo-assets.mjs <source.jpg>");
const root = path.resolve(import.meta.dirname, "..");
const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(src).toString("base64")}`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
const page = await browser.newPage();
const out = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const isBg = (i) => d[i] > 228 && d[i + 1] > 228 && d[i + 2] > 228 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 22;

  // Flood fill from every border pixel.
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (bg[p]) continue;
    if (!isBg(p * 4)) continue;
    bg[p] = 1;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // Transparent background; soften a 2px band of light edge pixels next to it.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bg[p]) {
      d[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p / w) | 0;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++)
      for (let dx = -2; dx <= 2 && !near; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) near = true;
      }
    if (near) {
      const lightness = Math.min(d[i], d[i + 1], d[i + 2]);
      if (lightness > 170) d[i + 3] = Math.round(255 * Math.min(1, (255 - lightness) / 85));
    }
  }
  ctx.putImageData(id, 0, 0);

  // Trim to content.
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const render = (size, { square = false, pad = 0, bgColor = null, radius = 0 } = {}) => {
    const scale = square ? (size - pad * 2) / Math.max(cw, ch) : size / Math.max(cw, ch);
    const ow = square ? size : Math.round(cw * scale);
    const oh = square ? size : Math.round(ch * scale);
    const o = document.createElement("canvas");
    o.width = ow;
    o.height = oh;
    const octx = o.getContext("2d");
    if (bgColor) {
      octx.fillStyle = bgColor;
      octx.beginPath();
      octx.roundRect(0, 0, ow, oh, radius);
      octx.fill();
    }
    octx.imageSmoothingQuality = "high";
    const dw = cw * scale;
    const dh = ch * scale;
    octx.drawImage(c, minX, minY, cw, ch, (ow - dw) / 2, (oh - dh) / 2, dw, dh);
    return o.toDataURL("image/png");
  };

  return {
    trimmed: { w: cw, h: ch },
    "public/brand/logo-512.png": render(512),
    "public/brand/logo-256.png": render(256),
    "src/app/icon.png": render(192, { square: true, pad: 4 }),
    "src/app/apple-icon.png": render(180, { square: true, pad: 12, bgColor: "#0a0908", radius: 0 }),
    // Social share card (WhatsApp/Facebook/X previews): badge on the dark brand background.
    "src/app/opengraph-image.jpg": (() => {
      const o = document.createElement("canvas");
      o.width = 1200;
      o.height = 630;
      const g = o.getContext("2d");
      g.fillStyle = "#0a0908";
      g.fillRect(0, 0, 1200, 630);
      const glow = g.createRadialGradient(600, 300, 40, 600, 300, 420);
      glow.addColorStop(0, "rgba(226,189,103,0.28)");
      glow.addColorStop(1, "rgba(226,189,103,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, 1200, 630);
      const scale = 520 / ch;
      g.imageSmoothingQuality = "high";
      g.drawImage(c, minX, minY, cw, ch, 600 - (cw * scale) / 2, 30, cw * scale, ch * scale);
      g.fillStyle = "#e2bd67";
      g.font = "600 24px Georgia, serif";
      g.textAlign = "center";
      g.fillText("Monrovia Super Mall · Book your seats online", 600, 595);
      return o.toDataURL("image/jpeg", 0.86); // keep small: WhatsApp skips large preview images
    })(),
  };
}, dataUrl);
await browser.close();

console.log("trimmed logo size:", out.trimmed);
for (const [file, url] of Object.entries(out)) {
  if (file === "trimmed") continue;
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", file, fs.statSync(target).size, "bytes");
}
