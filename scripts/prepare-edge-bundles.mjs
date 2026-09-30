#!/usr/bin/env node

/**
 * Make every Deno edge function self-contained.
 *
 * `supabase functions deploy <name>` uploads ONLY the files under
 * `supabase/functions/<name>/`. Any relative import that escapes that
 * directory therefore cannot be resolved on the runtime, and Deno fails the
 * whole module graph at link time — the function answers every request with
 * `503 {"code":"BOOT_ERROR"}` even though `supabase functions list` reports it
 * as ACTIVE.
 *
 * That is exactly how make-server-0b1f4071 shipped broken: its
 * `_shared/rbac.ts` reached out to `packages/rbac/src/index.ts` and
 * `_shared/featureFlags.ts` reached out to `src/utils/featureFlags.ts`.
 *
 * This script vendors every escaping import into the function directory and
 * rewrites the specifier to the vendored copy, so the uploaded bundle is
 * closed over itself. `packages/` and `src/` stay the single source of truth;
 * the vendored files are generated and verified by `--check`.
 *
 * Usage:
 *   node scripts/prepare-edge-bundles.mjs           # write vendored copies
 *   node scripts/prepare-edge-bundles.mjs --check   # fail on drift (CI gate)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const CHECK_ONLY = process.argv.includes('--check');
const REPO_ROOT = resolve(process.cwd());
const FUNCTIONS_ROOT = join(REPO_ROOT, 'supabase', 'functions');
const SHARED_DIR_NAME = '_shared';
const VENDOR_DIR_NAME = '_vendor';

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const log = (m, c = 'reset') => console.log(`${COLORS[c]}${m}${COLORS.reset}`);

const toPosix = (p) => p.split(sep).join('/');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Collect every static relative import specifier in a source file. */
function relativeImports(source) {
  const specs = [];
  const patterns = [
    /\bimport\s+[^;'"]*?from\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*['"](\.[^'"]+)['"]/g,
    /\bexport\s+[^;'"]*?from\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) specs.push(m[1]);
  }
  return specs;
}

function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) || null;
}

function isInside(child, parent) {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !resolve(rel).startsWith(sep);
}

const BANNER = (source) => `// GENERATED FILE — DO NOT EDIT.
// Vendored from ${toPosix(relative(REPO_ROOT, source))}
// by scripts/prepare-edge-bundles.mjs so that this function is a closed,
// self-contained module graph. Edit the source of truth instead.
`;

/**
 * Copy `sourcePath` into `functionRoot` and rewrite the importing file.
 * Returns the specifier that the importer should use, or null if the file is
 * already inside the function root.
 */
function planVendoredPath(functionRoot, sourcePath) {
  const sharedRoot = join(FUNCTIONS_ROOT, SHARED_DIR_NAME);
  if (isInside(sourcePath, sharedRoot)) {
    // supabase/functions/_shared/* is the conventional shared location for the
    // other functions, so mirror it at <function>/_shared/* to keep the
    // diff readable.
    return join(functionRoot, SHARED_DIR_NAME, relative(sharedRoot, sourcePath));
  }
  // Anything else (packages/, src/, ...) is mirrored under _vendor/ using its
  // repo-relative path, so relative specifiers inside the copied file keep
  // resolving to their siblings.
  return join(functionRoot, VENDOR_DIR_NAME, relative(REPO_ROOT, sourcePath));
}

let drift = 0;
let vendoredCount = 0;
let checkedCount = 0;
let dangling = 0;

const functionDirs = readdirSync(FUNCTIONS_ROOT)
  .map((name) => join(FUNCTIONS_ROOT, name))
  .filter((p) => statSync(p).isDirectory() && p !== join(FUNCTIONS_ROOT, SHARED_DIR_NAME))
  // Only directories that are actual functions (they contain an index.ts or a
  // main entry file), not stray shared folders.
  .filter((p) => existsSync(join(p, 'index.ts')) || existsSync(join(p, 'main.ts')));

log('\n🔧 Edge bundle self-containment', 'cyan');
log('='.repeat(64), 'cyan');

for (const functionRoot of functionDirs) {
  const name = relative(FUNCTIONS_ROOT, functionRoot);
  const files = walk(functionRoot).filter((f) => !isInside(f, join(functionRoot, VENDOR_DIR_NAME)));

  // Resolve the transitive closure of escaping imports.
  const queue = files.map((f) => ({ file: f, source: f }));
  const seen = new Set(files);
  const escapes = [];

  while (queue.length) {
    const { file, source } = queue.shift();
    let text;
    try {
      text = readFileSync(source, 'utf8');
    } catch {
      continue;
    }
    for (const spec of relativeImports(text)) {
      const target = resolveSpecifier(source, spec);
      if (!target) {
        // A relative specifier that resolves to nothing is just as fatal as one
        // that escapes the function root: Deno cannot link either one, and the
        // failure only shows up as a runtime BOOT_ERROR.
        log(`    DANGLING ${toPosix(relative(REPO_ROOT, source))} imports '${spec}' (no such file)`, 'red');
        dangling += 1;
        continue;
      }
      if (!isInside(target, functionRoot)) {
        escapes.push({ importer: file, spec, target });
        if (!seen.has(target)) {
          seen.add(target);
          queue.push({ file: target, source: target });
        }
      }
    }
  }

  if (!escapes.length) {
    checkedCount += 1;
    continue;
  }
  log(`\n  ${name}`, 'yellow');
  const uniqueTargets = [...new Set(escapes.map((e) => e.target))].sort();
  for (const target of uniqueTargets) {
    const dest = planVendoredPath(functionRoot, target);
    const content = BANNER(target) + readFileSync(target, 'utf8');
    log(`    vendor ${toPosix(relative(REPO_ROOT, target))}`, 'cyan');
    log(`       ->    ${toPosix(relative(REPO_ROOT, dest))}`, 'cyan');

    if (CHECK_ONLY) {
      if (!existsSync(dest) || readFileSync(dest, 'utf8') !== content) {
        log(`       DRIFT: ${toPosix(relative(REPO_ROOT, dest))} is missing or out of date`, 'red');
        drift += 1;
      }
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content, 'utf8');
    }
    vendoredCount += 1;
  }

  if (!CHECK_ONLY) {
    // Rewrite the specifiers in the function's own (non-vendored) sources.
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      let next = text;
      for (const { spec, target } of escapes.filter((e) => e.importer === file)) {
        const dest = planVendoredPath(functionRoot, target);
        let relSpec = toPosix(relative(dirname(file), dest));
        if (!relSpec.startsWith('.')) relSpec = `./${relSpec}`;
        next = next.split(`'${spec}'`).join(`'${relSpec}'`).split(`"${spec}"`).join(`"${relSpec}"`);
      }
      if (next !== text) writeFileSync(file, next, 'utf8');
    }
  }
}

// Stale vendored output: drop anything under _vendor/ that is no longer needed.
if (!CHECK_ONLY) {
  for (const functionRoot of functionDirs) {
    const vendorRoot = join(functionRoot, VENDOR_DIR_NAME);
    if (!existsSync(vendorRoot)) continue;
    const expected = new Set();
    const files = walk(functionRoot).filter((f) => !isInside(f, vendorRoot));
    const queue = files.map((f) => ({ file: f, source: f }));
    const seen = new Set(files);
    while (queue.length) {
      const { source } = queue.shift();
      for (const spec of relativeImports(readFileSync(source, 'utf8'))) {
        const target = resolveSpecifier(source, spec);
        if (!target || !isInside(target, functionRoot)) continue;
        expected.add(target);
        if (!seen.has(target)) {
          seen.add(target);
          queue.push({ file: target, source: target });
        }
      }
    }
    for (const file of walk(vendorRoot)) {
      if (!expected.has(file)) {
        log(`\n  ${relative(FUNCTIONS_ROOT, file)}: removing stale vendored copy`, 'yellow');
        rmSync(file, { force: true });
      }
    }
  }
}

// Refresh already-vendored files from their recorded source. This runs on every
// invocation (not only when an escape is found) so that editing packages/ or
// src/ is always mirrored into the bundles — a stale vendored copy is exactly
// the kind of drift that makes a deploy silently differ from the repo.
if (!CHECK_ONLY) {
  for (const functionRoot of functionDirs) {
    const vendorRoot = join(functionRoot, VENDOR_DIR_NAME);
    if (!existsSync(vendorRoot)) continue;
    for (const file of walk(vendorRoot)) {
      const first = readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 3).join('\n');
      const match = /^\/\/ Vendored from (.+)$/m.exec(first);
      if (!match) continue;
      const source = resolve(REPO_ROOT, match[1]);
      if (!existsSync(source)) {
        log(`\n  ${relative(FUNCTIONS_ROOT, file)}: recorded source ${match[1]} no longer exists`, 'red');
        dangling += 1;
        continue;
      }
      const content = BANNER(source) + readFileSync(source, 'utf8');
      if (readFileSync(file, 'utf8') !== content) {
        log(`\n  refresh ${toPosix(relative(REPO_ROOT, file))} from ${match[1]}`, 'cyan');
        writeFileSync(file, content, 'utf8');
        vendoredCount += 1;
      }
    }
  }
}

log('\n' + '='.repeat(64), 'cyan');
if (CHECK_ONLY) {
  // --check must also catch a vendored copy that drifted from its source.
  for (const functionRoot of functionDirs) {
    const vendorRoot = join(functionRoot, VENDOR_DIR_NAME);
    if (!existsSync(vendorRoot)) continue;
    for (const file of walk(vendorRoot)) {
      const first = readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 3).join('\n');
      const match = /^\/\/ Vendored from (.+)$/.exec(first);
      if (!match) continue;
      const source = resolve(REPO_ROOT, match[1]);
      if (!existsSync(source)) {
        log(`    DANGLING ${toPosix(relative(REPO_ROOT, file))} was vendored from ${match[1]}, which no longer exists`, 'red');
        dangling += 1;
        continue;
      }
      if (readFileSync(file, 'utf8') !== BANNER(source) + readFileSync(source, 'utf8')) {
        log(`    DRIFT ${toPosix(relative(REPO_ROOT, file))} differs from ${match[1]}`, 'red');
        drift += 1;
      }
    }
  }
}
if (dangling) {
  log(`FAIL: ${dangling} relative import(s) resolve to no file — Deno cannot link them`, 'red');
  process.exitCode = 1;
}
if (CHECK_ONLY) {
  if (drift) {
    log(`FAIL: ${drift} vendored file(s) out of date — run \`npm run edge:sync\``, 'red');
    process.exitCode = 1;
  }
  if (!drift && !dangling) {
    log(`OK: ${functionDirs.length} edge function(s) are self-contained`, 'green');
  }
} else {
  log(`Vendored ${vendoredCount} file(s) across ${functionDirs.length} edge function(s)`, 'green');
  if (!dangling) {
    log('Run `node scripts/check-edge-module-graph.mjs` next to verify the graph.', 'cyan');
  }
}
log('='.repeat(64) + '\n', 'cyan');
