#!/usr/bin/env node
/**
 * Reports translation keys that components ask for but that do not exist in
 * either language table. `verify-translations.mjs` only checks en/ar parity, so
 * a component calling a key that was never added renders the raw key to the user
 * and nothing fails.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

  // Flat key tables, built the same way translations.ts builds them. Keys may be
  // bare or quoted (e.g. `'10_wasel_points'`), so both forms must be captured.
  const existing = new Set();
  const chunkDir = join(SRC, 'locales', 'chunks');
  for (const file of readdirSync(chunkDir).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(chunkDir, file), 'utf8');
    for (const m of source.matchAll(/^\s{2,}'?([A-Za-z0-9_]+)'?\s*:\s*'/gm)) {
      existing.add(m[1]);
    }
  }

// Keys the components ask for.
const usage = new Map();
const CALL = /\b(?:t|tx)\(\s*'([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)'/g;
for (const file of walk(SRC)) {
  if (file.includes('__tests__') || file.includes('locales')) continue;
  const source = readFileSync(file, 'utf8');
  let m;
  CALL.lastIndex = 0;
  while ((m = CALL.exec(source)) !== null) {
    // Skip matches inside comments, so prose about `t('namespace.key')` in a
    // doc comment is not mistaken for a real call site.
    const lineStart = source.lastIndexOf('\n', m.index) + 1;
    if (source.slice(lineStart, m.index).trimStart().startsWith(('*', '//'))) continue;
    const key = m[2];
    if (!usage.has(key)) usage.set(key, []);
    usage.get(key).push(`${relative(ROOT, file)}`);
  }
}

const missing = [...usage.entries()]
  .filter(([key]) => !existing.has(key))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`existing flat keys : ${existing.size}`);
console.log(`keys requested     : ${usage.size}`);
console.log(`MISSING keys       : ${missing.length}\n`);
for (const [key, sites] of missing) {
  console.log(`  ${key}`);
  for (const s of [...new Set(sites)].slice(0, 2)) console.log(`      ${s}`);
}
process.exitCode = missing.length ? 1 : 0;
