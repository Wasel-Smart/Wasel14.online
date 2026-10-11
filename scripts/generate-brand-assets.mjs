#!/usr/bin/env node
/**
 * Wasel brand asset generator.
 *
 * Single source of truth (vector, hand-checked):
 *   public/brand/assets/logos/primary/logo-default.svg   route mark + "Wasel | واصل" wordmark (outlined)
 *   public/brand/assets/logos/symbols/symbol-default.svg route mark only
 *   public/favicon.svg                                   simplified mark on a navy tile (reads at 16px)
 *
 * From those three files this script derives every other asset:
 *   - colour variants (dark, light, white, black, monochrome) of the lockup and symbol
 *   - PNG fallbacks, PWA icons (any + maskable), apple-touch-icon, favicons + favicon.ico
 *   - Open Graph / social images
 *   - mobile (Expo) icon, adaptive icon, splash, notification icon
 *   - optional .webp / .avif siblings when `sharp` is installed
 *
 * Run: npm run brand:generate      (needs: npx playwright install chromium, once)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const LOCKUP_SRC = path.join(PUBLIC, 'brand', 'assets', 'logos', 'primary', 'logo-default.svg');
const SYMBOL_SRC = path.join(PUBLIC, 'brand', 'assets', 'logos', 'symbols', 'symbol-default.svg');
const FAVICON_SRC = path.join(PUBLIC, 'favicon.svg');

// Vector sources are written to every place the app, the sync script and the
// brand book look for them.
const BRAND_ROOTS = [
  path.join(ROOT, 'brand', 'assets'),
  path.join(PUBLIC, 'brand', 'assets'),
  path.join(PUBLIC, 'brand'),
];

const NAVY = '#081D39';
const read = (p) => fs.readFileSync(p, 'utf8');
for (const p of [LOCKUP_SRC, SYMBOL_SRC, FAVICON_SRC]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing brand source: ${path.relative(ROOT, p)}`);
    process.exit(1);
  }
}
const lockup = read(LOCKUP_SRC);
const symbol = read(SYMBOL_SRC);
const favicon = read(FAVICON_SRC);

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  /* optional */
}

let written = 0;
function out(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  written += 1;
}

// ── Vector variants ──────────────────────────────────────────────────────────
const solid = (svg, prefix, color, textFrom = null) => {
  let s = svg.replace(new RegExp(`url\\(#${prefix}[bgo]\\)`, 'g'), color);
  if (textFrom) s = s.split(textFrom).join(color);
  return s;
};

const vectorVariants = {
  'logos/primary/logo-default.svg': lockup,
  'logos/primary/logo-dark.svg': lockup,
  'logos/primary/logo-light.svg': lockup.split('#F8FBFF').join(NAVY),
  'logos/primary/logo-white.svg': solid(lockup, 'l', '#FFFFFF', '#F8FBFF'),
  'logos/primary/logo-black.svg': solid(lockup, 'l', '#000000', '#F8FBFF'),
  'logos/primary/logo-monochrome.svg': solid(lockup, 'l', 'currentColor', '#F8FBFF'),
  'logos/symbols/symbol-default.svg': symbol,
  'logos/symbols/w-mark.svg': symbol,
  'logos/symbols/symbol-white.svg': solid(symbol, 'm', '#FFFFFF'),
};
for (const root of BRAND_ROOTS) {
  for (const [rel, svg] of Object.entries(vectorVariants)) out(path.join(root, rel), svg);
}

// ── Raster helpers ───────────────────────────────────────────────────────────
const viewBoxOf = (svg) => svg.match(/viewBox="([\d.\s-]+)"/)[1].trim().split(/\s+/).map(Number);
const innerOf = (svg) =>
  svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title[\s\S]*?<\/title>|<desc[\s\S]*?<\/desc>/g, '');

/** Nest `svg` inside a bigger canvas, centred, `width` px wide. */
function place(svg, width, cx, cy) {
  const [vx, vy, vw, vh] = viewBoxOf(svg);
  const height = (width * vh) / vw;
  return `<svg x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}">${innerOf(svg)}</svg>`;
}

const BG_DEFS =
  '<defs><linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E2A52"/><stop offset="1" stop-color="#050B12"/></linearGradient></defs>';

function canvas(w, h, body, { bg = true, radius = 0 } = {}) {
  const rect = bg ? `<rect width="${w}" height="${h}" rx="${radius}" fill="url(#tbg)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${BG_DEFS}${rect}${body}</svg>`;
}

const tile = (size, markScale, { radius = 0, bg = true } = {}) =>
  canvas(size, size, place(symbol, size * markScale, size / 2, size / 2 + size * 0.01), { bg, radius });

const browser = await chromium.launch();
async function raster(svg, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${uri}" style="display:block;width:${width}px;height:${height}px"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  const buf = await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width, height } });
  await page.close();
  return buf;
}

async function png(file, svg, width, height = null, { modern = false } = {}) {
  const [, , vw, vh] = viewBoxOf(svg);
  const h = height ?? Math.round((width * vh) / vw);
  const buf = await raster(svg, width, h);
  out(file, buf);
  if (sharp && modern) {
    out(file.replace(/\.png$/, '.webp'), await sharp(buf).webp({ quality: 92 }).toBuffer());
    out(file.replace(/\.png$/, '.avif'), await sharp(buf).avif({ quality: 70 }).toBuffer());
  } else if (sharp) {
    out(file.replace(/\.png$/, '.webp'), await sharp(buf).webp({ quality: 92 }).toBuffer());
  }
  return buf;
}

// ── Brand rasters ────────────────────────────────────────────────────────────
const lockupLight = vectorVariants['logos/primary/logo-light.svg'];
for (const root of BRAND_ROOTS) {
  const logos = path.join(root, 'logos', 'primary');
  await png(path.join(logos, 'logo-default.png'), lockup, 1200, null, { modern: true });
  await png(path.join(logos, 'logo-dark.png'), lockup, 1200, null, { modern: true });
  await png(path.join(logos, 'logo-light.png'), lockupLight, 1200, null, { modern: true });
  for (const w of [64, 96, 160, 280, 512]) {
    await png(path.join(logos, `logo-default-${w}.png`), lockup, w, null, { modern: true });
  }
  const syms = path.join(root, 'logos', 'symbols');
  await png(path.join(syms, 'symbol-default.png'), symbol, 512, null, { modern: true });
  await png(path.join(syms, 'w-mark.png'), symbol, 512, null, { modern: true });
  await png(
    path.join(root, 'og', 'og-default.png'),
    canvas(1200, 630, place(lockup, 880, 600, 315)),
    1200,
    630,
    { modern: true },
  );
  await png(
    path.join(root, 'social', 'social-dark.png'),
    canvas(1080, 1080, place(symbol, 640, 540, 540)),
    1080,
    1080,
    { modern: true },
  );
  fs.copyFileSync(
    path.join(root, 'logos', 'primary', 'logo-dark.svg'),
    path.join(root, 'social', 'social-dark.svg'),
  );
}

// ── PWA / favicon rasters (public/) ──────────────────────────────────────────
for (const s of [192, 512]) {
  await png(path.join(PUBLIC, `icon-${s}.png`), tile(512, 0.78, { radius: 112 }), s, s);
  await png(path.join(PUBLIC, `icon-maskable-${s}.png`), tile(512, 0.56), s, s);
}
await png(path.join(PUBLIC, 'apple-touch-icon.png'), tile(512, 0.7), 180, 180);
await png(path.join(PUBLIC, 'favicon-16x16.png'), favicon, 16, 16);
await png(path.join(PUBLIC, 'favicon-32x32.png'), favicon, 32, 32);

// favicon.ico: PNG-compressed frames (16, 32, 48) in an ICO container.
const frames = [];
for (const s of [16, 32, 48]) frames.push({ s, buf: await raster(favicon, s, s) });
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = 6 + frames.length * 16;
const entries = frames.map(({ s, buf }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
out(path.join(PUBLIC, 'favicon.ico'), Buffer.concat([header, ...entries, ...frames.map((f) => f.buf)]));

// ── Mobile (Expo) ────────────────────────────────────────────────────────────
const MOBILE = path.join(ROOT, 'mobile', 'assets', 'images');
if (fs.existsSync(MOBILE)) {
  await png(path.join(MOBILE, 'icon.png'), tile(1024, 0.66), 1024, 1024);
  await png(path.join(MOBILE, 'adaptive-icon.png'), tile(1024, 0.5, { bg: false }), 1024, 1024);
  await png(path.join(MOBILE, 'favicon.png'), favicon, 48, 48);
  await png(
    path.join(MOBILE, 'notification-icon.png'),
    canvas(96, 96, place(vectorVariants['logos/symbols/symbol-white.svg'], 76, 48, 49), { bg: false }),
    96,
    96,
  );
  await png(path.join(MOBILE, 'splash-logo.png'), canvas(1024, 1024, place(symbol, 640, 512, 512), { bg: false }), 1024, 1024);
  await png(path.join(MOBILE, 'splash.png'), canvas(1284, 2778, place(symbol, 560, 642, 1389)), 1284, 2778);
} else {
  console.log('  (mobile/assets/images not found — skipped Expo icons)');
}

await browser.close();
console.log(`\nBrand assets generated: ${written} files${sharp ? ' (incl. webp/avif)' : ' (install sharp for webp/avif)'}.`);
console.log('Next: npm run brand:check && git status public brand mobile/assets');
