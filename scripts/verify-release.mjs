#!/usr/bin/env node
/**
 * Release-hygiene gate for the production build output (dist/).
 *
 * Run AFTER `npm run build` and `node scripts/verify-dist.mjs`.
 * verify-dist.mjs proves the app is wired correctly (chunks, sw.js stamp).
 * This script proves the output is safe to publish:
 *
 *   1. No source maps shipped (they expose original source). Use --allow-sourcemaps to skip.
 *   2. No secret-looking files (.env*, keys, certs, backup codes) inside dist/.
 *   3. No live-secret patterns inside any text asset (Stripe sk_/whsec_, Supabase
 *      service-role JWTs and sb_secret_, Google client secrets, Twilio, SendGrid, Resend,
 *      private keys).
 *   4. No unresolved placeholders baked into the bundle (PASTE_, placeholder.supabase.co ...).
 *   5. Warns on test-mode Stripe keys and on a heavy entry chunk.
 *
 * Matched values are NEVER printed: only the file and the rule name.
 * Exit 0 = clean, 1 = blocking problem.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const allowSourcemaps = process.argv.includes('--allow-sourcemaps');

if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const errors = [];
const warnings = [];

const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.txt', '.xml', '.svg', '.map']);
const BAD_FILE_NAME = [
  /^\.env/i,
  /\.(pem|key|p8|p12|pfx|crt)$/i,
  /backup[-_]?codes?/i,
  /service[-_]account/i,
  /firebase-adminsdk/i,
  /client_secret/i,
];

const SECRET_RULES = [
  ['Stripe secret key', /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[A-Za-z0-9+/=]{24,}/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{20,}/],
  ['Twilio account SID', /\bAC[a-f0-9]{32}\b/],
  ['Twilio API key SID', /\bSK[a-f0-9]{32}\b/],
  ['SendGrid key', /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/],
  ['Resend key', /\bre_[A-Za-z0-9]{32,}\b/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Postgres URL with password', /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/i],
];

const PLACEHOLDER_RULES = [
  ['PASTE_ placeholder', /PASTE_[A-Z0-9_]{3,}/],
  ['SET_REAL placeholder', /<SET_REAL_[A-Z0-9_]+_IN_VERCEL>|SET_REAL_[A-Z0-9_]+/],
  ['placeholder Supabase host', /placeholder\.supabase\.co/i],
];
// Generic and can legitimately appear in third-party library strings: warn only.
const SOFT_PLACEHOLDER_RULES = [['YOUR_ placeholder', /\bYOUR_[A-Z0-9_]{4,}\b/]];

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
let fileCount = 0;
let mapCount = 0;
const seen = new Set();

for (const file of walk(dist)) {
  fileCount += 1;
  const name = path.basename(file);
  const ext = path.extname(file).toLowerCase();

  if (BAD_FILE_NAME.some((re) => re.test(name))) {
    errors.push(`Sensitive-looking file inside dist: ${rel(file)}`);
  }

  if (ext === '.map') {
    mapCount += 1;
    if (!allowSourcemaps) continue; // counted below, contents not scanned
  }

  if (!TEXT_EXT.has(ext)) continue;
  const content = fs.readFileSync(file, 'utf8');

  const note = (list, kind, label) => {
    const key = `${kind}|${label}|${rel(file)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(`${label} found in ${rel(file)}`);
  };

  for (const [label, re] of SECRET_RULES) {
    if (re.test(content)) note(errors, 'secret', label);
  }

  for (const m of content.matchAll(JWT_RE)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload && payload.role === 'service_role') note(errors, 'jwt', 'Supabase service_role JWT');
    } catch {
      /* not a decodable JWT: ignore */
    }
  }

  if (ext !== '.map') {
    for (const [label, re] of PLACEHOLDER_RULES) {
      if (re.test(content)) note(errors, 'placeholder', `Unresolved ${label}`);
    }
    for (const [label, re] of SOFT_PLACEHOLDER_RULES) {
      if (re.test(content)) note(warnings, 'soft-placeholder', `Possible ${label}`);
    }
    if (/\bpk_test_[A-Za-z0-9]{16,}/.test(content)) note(warnings, 'stripe-test', 'Stripe TEST publishable key');
  }
}

if (mapCount > 0 && !allowSourcemaps) {
  errors.push(
    `${mapCount} source map file(s) are inside dist/. Move them out (scripts/clean-build.ps1 does this) ` +
      'or upload them to Sentry and delete them before publishing.',
  );
}

// Entry chunk weight (gzip) as an early warning, not a gate.
try {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const entry = html.match(/src="(\/assets\/js\/index-[^"]+\.js)"/)?.[1];
  if (entry) {
    const gz = zlib.gzipSync(fs.readFileSync(path.join(dist, entry.slice(1)))).length;
    const kb = (gz / 1024).toFixed(1);
    console.log(`Entry chunk: ${entry} (${kb} kB gzip)`);
    if (gz > 250 * 1024) warnings.push(`Entry chunk is ${kb} kB gzip (budget 250 kB). Check what is eagerly imported.`);
  } else {
    errors.push('index.html does not reference a /assets/js/index-*.js entry chunk');
  }
} catch (e) {
  errors.push(`Could not inspect dist/index.html: ${e.message}`);
}

console.log(`Scanned ${fileCount} files in dist/`);

if (warnings.length) {
  console.warn('\nWARNINGS:');
  for (const w of warnings) console.warn('  ! ' + w);
}
if (errors.length) {
  console.error('\nRELEASE CHECK FAILED:');
  for (const e of errors) console.error('  x ' + e);
  process.exit(1);
}
console.log('\nRELEASE CHECK OK: no secrets, placeholders or source maps in dist/.');
