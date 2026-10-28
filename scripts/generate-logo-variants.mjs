/**
 * Generates all logo/icon variants from the new master PNG.
 * Master: brand/assets/logos/primary/cd6749ad-0f83-47a0-baa1-d83369bd4a48.png
 * Run: node scripts/generate-logo-variants.mjs
 */
import sharp from 'sharp';
import { copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'brand/assets/logos/primary/cd6749ad-0f83-47a0-baa1-d83369bd4a48.png');

if (!existsSync(SRC)) {
  console.error(`Master logo file not found: ${SRC}`);
  process.exit(1);
}

// Target directories
const BRAND_PRIMARY = join(ROOT, 'brand/assets/logos/primary');
const BRAND_SYMBOLS = join(ROOT, 'brand/assets/logos/symbols');
const BRAND_OG = join(ROOT, 'brand/assets/og');
const BRAND_SOCIAL = join(ROOT, 'brand/assets/social');

const PUBLIC_PRIMARY_ASSETS = join(ROOT, 'public/brand/assets/logos/primary');
const PUBLIC_SYMBOLS_ASSETS = join(ROOT, 'public/brand/assets/logos/symbols');
const PUBLIC_ICONS_ASSETS = join(ROOT, 'public/brand/assets/icons');
const PUBLIC_OG_ASSETS = join(ROOT, 'public/brand/assets/og');
const PUBLIC_SOCIAL_ASSETS = join(ROOT, 'public/brand/assets/social');

const PUBLIC_PRIMARY_FLAT = join(ROOT, 'public/brand/logos/primary');
const PUBLIC_SYMBOLS_FLAT = join(ROOT, 'public/brand/logos/symbols');
const PUBLIC_OG_FLAT = join(ROOT, 'public/brand/og');
const PUBLIC_SOCIAL_FLAT = join(ROOT, 'public/brand/social');

const ARTIFACTS_PRIMARY = join(ROOT, 'artifacts/brand/logos/primary');
const ARTIFACTS_SYMBOLS = join(ROOT, 'artifacts/brand/logos/symbols');
const ARTIFACTS_OG = join(ROOT, 'artifacts/brand/og');
const ARTIFACTS_SOCIAL = join(ROOT, 'artifacts/brand/social');

const PUBLIC = join(ROOT, 'public');
const MOBILE_IMAGES = join(ROOT, 'mobile/assets/images');

const ALL_DIRS = [
  BRAND_PRIMARY,
  BRAND_SYMBOLS,
  BRAND_OG,
  BRAND_SOCIAL,
  PUBLIC_PRIMARY_ASSETS,
  PUBLIC_SYMBOLS_ASSETS,
  PUBLIC_ICONS_ASSETS,
  PUBLIC_OG_ASSETS,
  PUBLIC_SOCIAL_ASSETS,
  PUBLIC_PRIMARY_FLAT,
  PUBLIC_SYMBOLS_FLAT,
  PUBLIC_OG_FLAT,
  PUBLIC_SOCIAL_FLAT,
  ARTIFACTS_PRIMARY,
  ARTIFACTS_SYMBOLS,
  ARTIFACTS_OG,
  ARTIFACTS_SOCIAL,
  PUBLIC,
  MOBILE_IMAGES,
];

for (const dir of ALL_DIRS) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const src = sharp(SRC);
const { width: W, height: H } = await src.metadata();
console.log(`Source Master Logo: ${W}x${H} (${SRC})`);

async function savePng(pipeline, dest) {
  await pipeline.png({ compressionLevel: 9 }).toFile(dest);
}
async function saveWebp(pipeline, dest) {
  await pipeline.webp({ quality: 90 }).toFile(dest);
}
async function saveAvif(pipeline, dest) {
  await pipeline.avif({ quality: 60 }).toFile(dest);
}

const PRIMARY_DIRS = [BRAND_PRIMARY, PUBLIC_PRIMARY_ASSETS, PUBLIC_PRIMARY_FLAT, ARTIFACTS_PRIMARY];
const SYMBOL_DIRS = [BRAND_SYMBOLS, PUBLIC_SYMBOLS_ASSETS, PUBLIC_SYMBOLS_FLAT, ARTIFACTS_SYMBOLS];
const OG_DIRS = [BRAND_OG, PUBLIC_OG_ASSETS, PUBLIC_OG_FLAT, ARTIFACTS_OG];
const SOCIAL_DIRS = [BRAND_SOCIAL, PUBLIC_SOCIAL_ASSETS, PUBLIC_SOCIAL_FLAT, ARTIFACTS_SOCIAL];

// Helper: resize keeping aspect, output all three formats to given dirs
async function logoVariant(name, targetH, dirs) {
  const targetW = Math.round(targetH * W / H);
  const base = sharp(SRC).resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const pngBuf = await base.clone().png({ compressionLevel: 9 }).toBuffer();
  const webpBuf = await base.clone().webp({ quality: 90 }).toBuffer();
  const avifBuf = await base.clone().avif({ quality: 60 }).toBuffer();

  for (const dir of dirs) {
    writeFileSync(join(dir, `${name}.png`), pngBuf);
    writeFileSync(join(dir, `${name}.webp`), webpBuf);
    writeFileSync(join(dir, `${name}.avif`), avifBuf);
  }
  console.log(`Saved variant ${name} (${targetW}x${targetH}) across ${dirs.length} dirs`);
}

// ── 1. Logo variants (full lockup) ───────────────────────────────────────────
await logoVariant('logo-default', H, PRIMARY_DIRS);
await logoVariant('logo-dark', H, PRIMARY_DIRS);
await logoVariant('logo-light', H, PRIMARY_DIRS);

for (const size of [64, 96, 160, 280, 512]) {
  await logoVariant(`logo-default-${size}`, size, PRIMARY_DIRS);
}

// ── 2. SVG wrappers with embedded PNG data URI ──────────────────────────────
const pngBuf = readFileSync(SRC);
const b64 = pngBuf.toString('base64');
const dataUri = `data:image/png;base64,${b64}`;

const svgTemplate = (w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="${dataUri}" width="${w}" height="${h}"/></svg>`;

const svgNames = ['logo-default', 'logo-dark', 'logo-light', 'logo-white', 'logo-black', 'logo-monochrome'];
const svgContent = svgTemplate(W, H);
for (const dir of PRIMARY_DIRS) {
  for (const name of svgNames) {
    writeFileSync(join(dir, `${name}.svg`), svgContent);
  }
}
console.log('Saved SVG wrappers in primary dirs');

// ── 3. Symbol / W-mark ──────────────────────────────────────────────────────
const SYM_SIZE = 512;
const symBase = sharp(SRC).resize(SYM_SIZE, SYM_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
const symPngBuf = await symBase.clone().png({ compressionLevel: 9 }).toBuffer();
const symWebpBuf = await symBase.clone().webp({ quality: 90 }).toBuffer();
const symAvifBuf = await symBase.clone().avif({ quality: 60 }).toBuffer();
const symSvg = svgTemplate(SYM_SIZE, SYM_SIZE);

for (const dir of SYMBOL_DIRS) {
  writeFileSync(join(dir, 'symbol-default.png'), symPngBuf);
  writeFileSync(join(dir, 'symbol-default.webp'), symWebpBuf);
  writeFileSync(join(dir, 'symbol-default.avif'), symAvifBuf);
  writeFileSync(join(dir, 'symbol-default.svg'), symSvg);
  writeFileSync(join(dir, 'symbol-white.svg'), symSvg);

  writeFileSync(join(dir, 'w-mark.png'), symPngBuf);
  writeFileSync(join(dir, 'w-mark.webp'), symWebpBuf);
  writeFileSync(join(dir, 'w-mark.avif'), symAvifBuf);
}
console.log('Saved symbol and w-mark variants');

// ── 4. OG image (1200x630) ──────────────────────────────────────────────────
const ogW = 1200, ogH = 630;
const ogLogoH = Math.round(ogH * 0.45);
const ogLogoW = Math.round(ogLogoH * W / H);
const ogBase = sharp({
  create: { width: ogW, height: ogH, channels: 4, background: { r: 8, g: 29, b: 57, alpha: 1 } },
}).composite([{
  input: await sharp(SRC).resize(ogLogoW, ogLogoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  gravity: 'centre',
}]);

const ogPngBuf = await ogBase.clone().png({ compressionLevel: 9 }).toBuffer();
const ogWebpBuf = await ogBase.clone().webp({ quality: 90 }).toBuffer();
const ogAvifBuf = await ogBase.clone().avif({ quality: 60 }).toBuffer();

for (const dir of OG_DIRS) {
  writeFileSync(join(dir, 'og-default.png'), ogPngBuf);
  writeFileSync(join(dir, 'og-default.webp'), ogWebpBuf);
  writeFileSync(join(dir, 'og-default.avif'), ogAvifBuf);
}
console.log('Saved OG image variants');

// ── 5. Social card (1200x628) ───────────────────────────────────────────────
const socW = 1200, socH = 628;
const socLogoH = Math.round(socH * 0.45);
const socLogoW = Math.round(socLogoH * W / H);
const socialBase = sharp({
  create: { width: socW, height: socH, channels: 4, background: { r: 8, g: 29, b: 57, alpha: 1 } },
}).composite([{
  input: await sharp(SRC).resize(socLogoW, socLogoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
  gravity: 'centre',
}]);

const socPngBuf = await socialBase.clone().png({ compressionLevel: 9 }).toBuffer();
const socWebpBuf = await socialBase.clone().webp({ quality: 90 }).toBuffer();
const socAvifBuf = await socialBase.clone().avif({ quality: 60 }).toBuffer();
const socSvg = svgTemplate(socW, socH);

for (const dir of SOCIAL_DIRS) {
  writeFileSync(join(dir, 'social-dark.png'), socPngBuf);
  writeFileSync(join(dir, 'social-dark.webp'), socWebpBuf);
  writeFileSync(join(dir, 'social-dark.avif'), socAvifBuf);
  writeFileSync(join(dir, 'social-dark.svg'), socSvg);
}
console.log('Saved social card variants');

// ── 6. PWA & Favicon icons (public root) ─────────────────────────────────────
const iconSizes = [
  ['icon-192', 192],
  ['icon-512', 512],
  ['icon-maskable-192', 192],
  ['icon-maskable-512', 512],
  ['apple-touch-icon', 180],
  ['favicon-32x32', 32],
  ['favicon-16x16', 16],
];

for (const [name, size] of iconSizes) {
  const iconBase = sharp(SRC).resize(size, size, { fit: 'contain', background: { r: 8, g: 29, b: 57, alpha: 1 } });
  await savePng(iconBase.clone(), join(PUBLIC, `${name}.png`));
  await saveWebp(iconBase.clone(), join(PUBLIC, `${name}.webp`));
}

// favicon.svg & icons
writeFileSync(join(PUBLIC, 'favicon.svg'), svgTemplate(32, 32));
writeFileSync(join(PUBLIC_ICONS_ASSETS, 'favicon.svg'), svgTemplate(32, 32));
writeFileSync(join(PUBLIC_ICONS_ASSETS, 'app-icon-white.svg'), svgTemplate(192, 192));

// favicon.ico (32x32)
const ico32 = await sharp(SRC).resize(32, 32, { fit: 'contain', background: { r: 8, g: 29, b: 57, alpha: 1 } }).png().toBuffer();
function buildIco(pngBuf) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const imageOffset = headerSize + dirEntrySize;
  const buf = Buffer.alloc(imageOffset + pngBuf.length);
  buf.writeUInt16LE(0, 0);       // reserved
  buf.writeUInt16LE(1, 2);       // type: ICO
  buf.writeUInt16LE(1, 4);       // count: 1
  buf.writeUInt8(32, 6);         // width
  buf.writeUInt8(32, 7);         // height
  buf.writeUInt8(0, 8);          // color count
  buf.writeUInt8(0, 9);          // reserved
  buf.writeUInt16LE(1, 10);      // planes
  buf.writeUInt16LE(32, 12);     // bit count
  buf.writeUInt32LE(pngBuf.length, 14); // size
  buf.writeUInt32LE(imageOffset, 18);   // offset
  pngBuf.copy(buf, imageOffset);
  return buf;
}
writeFileSync(join(PUBLIC, 'favicon.ico'), buildIco(ico32));
console.log('Saved PWA and favicon icons');

// ── 7. Mobile app assets ────────────────────────────────────────────────────
// icon.png (1024x1024)
await savePng(
  sharp(SRC).resize(1024, 1024, { fit: 'contain', background: { r: 8, g: 29, b: 57, alpha: 1 } }),
  join(MOBILE_IMAGES, 'icon.png')
);
// adaptive-icon.png (1024x1024)
await savePng(
  sharp(SRC).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  join(MOBILE_IMAGES, 'adaptive-icon.png')
);
// splash-logo.png (1536x1024)
await savePng(
  sharp(SRC).resize(1536, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  join(MOBILE_IMAGES, 'splash-logo.png')
);
// splash.png (1284x2778)
const splashLogoH = Math.round(2778 * 0.16);
const splashLogoW = Math.round(splashLogoH * W / H);
const splashLogoBuf = await sharp(SRC).resize(splashLogoW, splashLogoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await savePng(
  sharp({
    create: { width: 1284, height: 2778, channels: 4, background: { r: 8, g: 29, b: 57, alpha: 1 } },
  }).composite([{ input: splashLogoBuf, gravity: 'centre' }]),
  join(MOBILE_IMAGES, 'splash.png')
);
// favicon.png (48x48)
await savePng(
  sharp(SRC).resize(48, 48, { fit: 'contain', background: { r: 8, g: 29, b: 57, alpha: 1 } }),
  join(MOBILE_IMAGES, 'favicon.png')
);
// notification-icon.png (96x96)
await savePng(
  sharp(SRC).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }),
  join(MOBILE_IMAGES, 'notification-icon.png')
);
console.log('Saved Mobile app icons and splash assets');

console.log('\n✅ Successfully generated all logo variants across Wasel web, brand, artifacts, and mobile!');
