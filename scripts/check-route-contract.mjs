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

function extractStaticPrefix(path) {
  // Extract the static prefix before any template expression
  const idx = path.indexOf('${');
  if (idx === -1) return path;
  const prefix = path.slice(0, idx);
  // Remove trailing slash if it ends with one before the template
  return prefix.replace(/\/+$/, '') || '/';
}

// ---------------------------------------------------------------------------
// 1. Paths the frontend asks for
// ---------------------------------------------------------------------------
const CALL_PATTERNS = [
  // API_URL template literals: `${API_URL}/path` or `${API_URL}/path/${var}`
  { re: /\$\{\s*API_URL\s*\}\/([^'"`\s${}]*(?:\$\{[^}]+\}[^'"`\s${}]*)*)/g, prefix: '/', groups: [1] },
  // String literals with optional v1 prefix: '/v1/path' or '/path' (including template expressions)
  { re: /['"`]\/(v1\/)?([A-Za-z0-9_\-/{}]+(?:\$\{[^}]+\}[A-Za-z0-9_\-/{}]*)*)/g, prefix: '', groups: [2] },
  // api.get/post/put/patch/delete calls with string endpoints
  { re: /api\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g, prefix: '', groups: [1] },
  // API_ENDPOINTS references: API_ENDPOINTS.SOME_ENDPOINT or API_ENDPOINTS.SOME_ENDPOINT(id)
  { re: /API_ENDPOINTS\.[A-Z_]+(?:\([^)]*\))?/g, prefix: '', groups: [] },
];

const calls = new Map(); // path -> [{file, line}]

for (const file of walk(SRC)) {
  if (file.includes('__tests__') || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
    for (const { re, prefix, groups } of CALL_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        let path = '';
        if (groups.length === 0) {
          // API_ENDPOINTS pattern - skip, handled separately
          continue;
        } else if (groups.length === 1) {
          // Single capture group
          path = `${prefix}${m[groups[0]] || ''}`;
        } else if (groups.length === 2) {
          // Two capture groups (v1 prefix + path)
          path = `${prefix}/${m[groups[0]] || ''}${m[groups[1]] || ''}`;
        } else {
          continue;
        }
        path = path.replace(/^['"`]/, '').replace(/['"`]$/, '');
        if (!path || path === '/') continue;
        if (!path.startsWith('/')) continue;
        // Normalise the path prefix the edge strips at runtime.
        path = path.replace(/^\/v1(?=\/|$)/, '');
        // Extract static prefix for dynamic paths
        const staticPath = extractStaticPrefix(path);
        if (!calls.has(staticPath)) calls.set(staticPath, []);
        calls.get(staticPath).push({ file: relative(ROOT, file), line: i + 1 });
      }
    }
  });
}

// Also scan for API_ENDPOINTS usage by reading the actual constant values
// This is a simplified approach - we'll also check the api.ts file for endpoint definitions
const apiTsContent = readFileSync(join(ROOT, 'src', 'utils', 'api.ts'), 'utf8');
// Extract endpoint paths from API_ENDPOINTS object (both string literals and functions)
const endpointPattern = /([A-Z_]+):\s*(?:['"`]([^'"`]+)['"`]|\([^)]*\)\s*=>\s*['"`]([^'"`]+)['"`])/g;
for (const m of apiTsContent.matchAll(endpointPattern)) {
  let path = m[2] || m[3];
  if (!path) continue;
  path = path.replace(/^\/v1(?=\/|$)/, '');
  const staticPath = extractStaticPrefix(path);
  if (!calls.has(staticPath)) calls.set(staticPath, []);
  calls.get(staticPath).push({ file: 'src/utils/api.ts (API_ENDPOINTS)', line: 0 });
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
// parseEntityRoute prefixes
for (const m of edgeSource.matchAll(/parseEntityRoute\(\s*path\s*,\s*'([^']+)'/g)) declared.add(`/${m[1]}`);
// parseWalletRoute - the regex is /^\/wallet\/([^/]+)/
// Already covered by regex-literal pattern above

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
