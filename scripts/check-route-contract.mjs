#!/usr/bin/env node

/**
 * Static frontend <-> backend route contract check.
 *
 * The frontend called `/active-trip`, `/notifications`, `/reviews`,
 * `/packages/track/{id}` and four `/admin/*` paths that the edge function never
 * declared, so every one of them returned a silent 404 in production. Nothing
 * in lint, typecheck or the unit suite can see that, because a string template
 * is a perfectly valid call.
 *
 * This walks the frontend for `${API_URL}/...` calls, walks the edge function's
 * ROUTES table for the paths it declares, and fails on the difference.
 *
 * Usage: node scripts/check-route-contract.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m' };
const log = (m, c = 'reset') => console.log(`${COLORS[c]}${m}${COLORS.reset}`);

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const EDGE_DIR = join(ROOT, 'supabase', 'functions', 'make-server-0b1f4071');
const EDGE_INDEX = join(EDGE_DIR, 'index.ts');

// Route paths are declared across index.ts *and* the _handlers modules
// (e.g. the wallet route is `parseWalletRoute(path) !== null`, whose literals
// live in _handlers/wallet.ts), so every file of the function is scanned.
const EDGE_SOURCES = walk(EDGE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Paths the frontend asks for
// ---------------------------------------------------------------------------
const CALL_PATTERNS = [
  // `prefix` is prepended to the capture, because the pattern itself consumes
  // the slash that separates the base URL from the path.
  { re: /\$\{\s*API_URL\s*\}\/([A-Za-z0-9_\-/{}]*)"/g, prefix: '/' },
  { re: /\$\{\s*API_URL\s*\}\/([A-Za-z0-9_\-/{}]*)/g, prefix: '/' },
  { re: /['"`]\/(v1\/)?[A-Za-z0-9_\-/{}]*/g, prefix: '' },
];

const calls = new Map(); // path -> [{file, line}]

for (const file of walk(SRC)) {
  if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
    for (const { re, prefix } of CALL_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        // If the path continues into a template expression (`/notifications/${id}/read`)
        // the static prefix alone is not verifiable, so skip it.
        if (line.slice(re.lastIndex).startsWith('${')) continue;
        let path = `${prefix}${m[1] ?? ''}`;
        path = path.replace(/^['"`]/, '').replace(/['"`]$/, '');
        if (!path || path === '/') continue;
        if (!path.startsWith('/')) continue;
        // Normalise the path prefix the edge strips at runtime.
        path = path.replace(/^\/v1(?=\/|$)/, '');
        if (path.includes('${')) continue; // fully dynamic, cannot verify statically
        if (!calls.has(path)) calls.set(path, []);
        calls.get(path).push({ file: relative(ROOT, file), line: i + 1 });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 2. Routes the edge function declares
// ---------------------------------------------------------------------------
const edgeSource = EDGE_SOURCES;
const declared = new Set();

// Literal comparisons such as: path === '/trips/search'
for (const m of edgeSource.matchAll(/path\s*===\s*'([^']+)'/g)) declared.add(m[1]);
for (const m of edgeSource.matchAll(/path\s*!==\s*'([^']+)'/g)) declared.add(m[1]);
// Prefix routes: path === '/packages' || path.startsWith('/packages/')
for (const m of edgeSource.matchAll(/path\.startsWith\(\s*'([^']+)'\s*\)/g)) declared.add(m[1]);
for (const m of edgeSource.matchAll(/path\s*===\s*'([^']+)'\s*\|\|\s*path\.startsWith\(\s*'([^']+)'/g)) {
  declared.add(m[1]);
  declared.add(m[2]);
}
// Route-table tests, e.g. test: ( path ) => path.startsWith( '/admin' )
for (const m of edgeSource.matchAll(/test\s*:\s*\([^)]*\)\s*=>\s*([\s\S]{0,240}?)(?=\n\s*(?:id|handle|methods)\s*:)/g)) {
  for (const s of m[1].matchAll(/'([^']+)'/g)) declared.add(s[1]);
}
// Template-literal paths, e.g. `/wallet/${userId}` covers `/wallet`.
for (const m of edgeSource.matchAll(/`(\/[A-Za-z0-9_\-/]*)\$\{/g)) declared.add(m[1]);
for (const m of edgeSource.matchAll(/'(\/[A-Za-z0-9_\-/]*\/)\$\{/g)) declared.add(m[1]);
// Regex-literal route patterns, e.g. /^\/wallet\/([^/]+)/ used by parseWalletRoute.
for (const m of edgeSource.matchAll(/\^\\\/([A-Za-z0-9_\-]+)/g)) declared.add(`/${m[1]}`);

// ---------------------------------------------------------------------------
// 3. Compare
// ---------------------------------------------------------------------------
function isCovered(path) {
  if (declared.has(path)) return true;
  // A declared prefix route (/packages) covers longer paths.
  return [...declared].some((d) => d !== '/' && path.startsWith(d + '/'));
}

const missing = [];
const covered = [];

for (const [path, sites] of [...calls.entries()].sort()) {
  if (isCovered(path)) covered.push(path);
  else missing.push({ path, sites });
}

log('\n🔗 Frontend ↔ backend route contract', 'cyan');
log('='.repeat(64), 'cyan');
log(`\n  frontend paths found : ${calls.size}`);
log(`  backend routes declared: ${declared.size}`);
log(`  covered              : ${covered.length}`);
log(`  MISSING              : ${missing.length}\n`, missing.length ? 'red' : 'green');

if (missing.length) {
  log('  The frontend calls these paths but the edge function declares no route');
  log('  for them. Each one is a silent 404 at runtime:\n', 'red');
  for (const { path, sites } of missing) {
    log(`    ${path}`, 'red');
    for (const s of sites.slice(0, 3)) {
      log(`        ${s.file}:${s.line}`, 'red');
    }
    if (sites.length > 3) log(`        …and ${sites.length - 3} more call site(s)`, 'red');
  }
  log('\n  Fix by adding the route in supabase/functions/make-server-0b1f4071/index.ts');
  log('  (with the auth the route needs), or by repointing the caller to a route');
  log('  that exists — but only after checking the request bodies match, since a');
  log('  path that exists with a different contract fails just as silently.\n', 'yellow');
}

log('='.repeat(64), 'cyan');
process.exitCode = missing.length ? 1 : 0;
