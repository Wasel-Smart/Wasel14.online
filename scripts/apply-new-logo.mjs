#!/usr/bin/env node
/**
 * Apply the new Wasel logo everywhere the web app reads it.
 *
 *   npm i --no-save sharp          (once; --no-save keeps package.json / lockfile untouched)
 *   node scripts/apply-new-logo.mjs
 *
 * Source of truth (never modified):
 *   brand/assets/logos/primary/logo-light-512.webp   512x185, transparent, white wordmark (for dark surfaces)
 *
 * Generated from it:
 *   - logo-light.*  / logo-light-{64..512}.*    the source itself (white wordmark, dark surfaces)
 *   - logo-dark.*   / logo-default*.*           same artwork, wordmark recoloured to brand ink #081D39 (light surfaces)
 *   - logo-white.*                              single-colour white silhouette
 *   - symbol-default.* / w-mark.*               the "W" route mark alone (compact logo, sidebar, avatars)
 *   - PWA / app / apple-touch icons and favicons (W mark on brand ink, maskable-safe)
 * Written to brand/assets (source), public/brand/assets (what <WaselLogo> loads) and public/brand
 * (the layout `npm run brand:sync` produces), plus the root icon files in public/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run:  npm i --no-save sharp   then re-run this script.');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'brand', 'assets', 'logos', 'primary', 'logo-light-512.webp');
if (!fs.existsSync(SRC)) {
  console.error(`Source logo not found: ${SRC}`);
  process.exit(1);
}

const INK = { r: 8, g: 29, b: 57 }; // #081D39 brand ink
const SIZES = [64, 96, 160, 280, 512];
const LOGO_ROOTS = [
  path.join(ROOT, 'brand', 'assets', 'logos'),
  path.join(ROOT, 'public', 'brand', 'assets', 'logos'),
  path.join(ROOT, 'public', 'brand', 'logos'),
];
const ICON_ROOTS = [
  path.join(ROOT, 'brand', 'assets', 'icons'),
  path.join(ROOT, 'public', 'brand', 'assets', 'icons'),
  path.join(ROOT, 'public', 'brand', 'icons'),
];
const PUBLIC = path.join(ROOT, 'public');

const written = [];
function write(file, buffer) {
  if (path.resolve(file) === path.resolve(SRC)) return; // never touch the master artwork
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buffer)) return; // identical, skip
  fs.writeFileSync(file, buffer);
  written.push(path.relative(ROOT, file));
}

const encoders = {
  png: (img) => img.png({ compressionLevel: 9, effort: 10 }).toBuffer(),
  webp: (img) => img.webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer(),
  avif: (img) => img.avif({ quality: 62, effort: 6 }).toBuffer(),
};

async function emitLogo(subdir, name, makeImage, { sizes = [], formats = ['png', 'webp', 'avif'], width } = {}) {
  const variants = [{ suffix: '', width }, ...sizes.map((w) => ({ suffix: `-${w}`, width: w }))];
  for (const v of variants) {
    for (const fmt of formats) {
      let img = makeImage();
      if (v.width) img = img.resize({ width: v.width, kernel: 'lanczos3' });
      const buf = await encoders[fmt](img);
      for (const root of LOGO_ROOTS) write(path.join(root, subdir, `${name}${v.suffix}.${fmt}`), buf);
    }
  }
}

// ---- load the source pixels -------------------------------------------------
const { data: srcRaw, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => (y * W + x) * 4;

// Right edge of the coloured "W" mark = right-most opaque, saturated pixel.
let markRight = 0;
let markBottom = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const a = srcRaw[i + 3];
    if (a < 20) continue;
    const sat = Math.max(srcRaw[i], srcRaw[i + 1], srcRaw[i + 2]) - Math.min(srcRaw[i], srcRaw[i + 1], srcRaw[i + 2]);
    if (sat > 40) {
      markRight = Math.max(markRight, x);
      markBottom = Math.max(markBottom, y);
    }
  }
}
console.log(`source ${W}x${H}; W mark spans x 0..${markRight}, y 0..${markBottom}`);

const raw = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });

// The wordmark starts just right of the mark, but the left edge of the "a" tucks under the green
// arm, so low-saturation (white) pixels past x=255 belong to the wordmark too. The mark's own
// white dots all sit left of x=250.
const WORDMARK_SAFE_X = 255;
function isWordmarkPixel(buf, x, i) {
  if (x > markRight) return true;
  if (x <= WORDMARK_SAFE_X) return false;
  const sat = Math.max(buf[i], buf[i + 1], buf[i + 2]) - Math.min(buf[i], buf[i + 1], buf[i + 2]);
  return sat < 40;
}

function lockup(variant) {
  const buf = Buffer.from(srcRaw);
  for (let y = 0; y < H; y++) {
    for (let x = WORDMARK_SAFE_X + 1; x < W; x++) {
      const i = px(x, y);
      if (buf[i + 3] === 0 || !isWordmarkPixel(buf, x, i)) continue;
      if (variant === 'dark') {
        buf[i] = INK.r; buf[i + 1] = INK.g; buf[i + 2] = INK.b; // keep alpha => clean antialiasing
      }
    }
  }
  if (variant === 'white') {
    for (let i = 0; i < buf.length; i += 4) { buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; }
  }
  return raw(buf);
}

const PAD = 4;
function markOnly() {
  const buf = Buffer.from(srcRaw);
  for (let y = 0; y < H; y++) {
    for (let x = WORDMARK_SAFE_X + 1; x <= markRight; x++) {
      const i = px(x, y);
      if (isWordmarkPixel(buf, x, i)) buf[i + 3] = 0; // drop the stray edge of the "a"
    }
  }
  return raw(buf)
    .extract({ left: 0, top: 0, width: markRight + 1, height: H })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } });
}
const markBuffer = await markOnly().png().toBuffer();
const markMeta = await sharp(markBuffer).metadata();
console.log(`symbol ${markMeta.width}x${markMeta.height} (ratio ${(markMeta.width / markMeta.height).toFixed(4)})`);

// ---- logos ------------------------------------------------------------------
await emitLogo('primary', 'logo-light', () => lockup('light'), { sizes: SIZES });
await emitLogo('primary', 'logo-dark', () => lockup('dark'), { sizes: SIZES });
await emitLogo('primary', 'logo-default', () => lockup('dark'), { sizes: SIZES });
await emitLogo('primary', 'logo-white', () => lockup('white'));
await emitLogo('symbols', 'symbol-default', () => sharp(markBuffer));
await emitLogo('symbols', 'w-mark', () => sharp(markBuffer), { sizes: SIZES.filter((s) => s <= markMeta.width) });

// ---- icons ------------------------------------------------------------------
async function squareIcon(size, markScale, { transparent = false } = {}) {
  const markW = Math.round(size * markScale);
  const mark = await sharp(markBuffer).resize({ width: markW, kernel: 'lanczos3' }).png().toBuffer();
  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : { ...INK, alpha: 1 },
    },
  });
  return base.composite([{ input: mark, gravity: 'center' }]);
}

async function emitIcon(file, size, scale, opts = {}, formats = ['png']) {
  for (const fmt of formats) {
    const buf = await encoders[fmt](await squareIcon(size, scale, opts));
    const out = file.replace('{ext}', fmt);
    write(path.join(PUBLIC, out), buf);
  }
}

// Installable PWA icons: mark on ink. "any" fills ~68% of the canvas; maskable keeps the mark
// inside the 80% safe circle (mark diagonal fits well within it at 54%).
for (const size of [192, 512]) {
  await emitIcon(`icon-${size}.{ext}`, size, 0.68, {}, ['png', 'webp']);
  await emitIcon(`icon-maskable-${size}.{ext}`, size, 0.58, {}, ['png', 'webp']);
}
await emitIcon('apple-touch-icon.{ext}', 180, 0.72, {}, ['png', 'webp']);
// Browser tab icons: transparent, mark fills the width.
await emitIcon('favicon-32x32.{ext}', 32, 1, { transparent: true }, ['png', 'webp']);
await emitIcon('favicon-16x16.{ext}', 16, 1, { transparent: true }, ['png', 'webp']);

// favicon.ico (PNG-in-ICO, 16 + 32), valid in every current browser.
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}
const ico = buildIco([
  { size: 16, data: await encoders.png(await squareIcon(16, 1, { transparent: true })) },
  { size: 32, data: await encoders.png(await squareIcon(32, 1, { transparent: true })) },
]);
write(path.join(PUBLIC, 'favicon.ico'), ico);

// brand/assets/icons + served copies
for (const root of ICON_ROOTS) {
  for (const [size, scale, transparent] of [[16, 1, true], [32, 1, true], [180, 0.72, false], [192, 0.68, false], [512, 0.68, false]]) {
    write(path.join(root, `app-icon-${size}.png`), await encoders.png(await squareIcon(size, scale, { transparent })));
  }
  write(path.join(root, 'favicon.ico'), ico);
}

console.log(`\nWrote ${written.length} files:`);
written.forEach((f) => console.log('  ' + f));
console.log('\nNot regenerated (artwork baked with the old logo, needs a designer or a vector master):');
console.log('  og-default.*, social-dark.*, *.svg lockups/symbols, favicon.svg, app-icon-white.svg');
