#!/usr/bin/env node

/**
 * Run the Deno test suites under `supabase/functions/tests/`.
 *
 * These suites cover Edge Function behaviour that neither Vitest nor ESLint can
 * reach: they import the real handler modules and execute them. They must run
 * under the same binary-resolution rules as `check-edge-types.mjs`, because the
 * `deno` npm package on Windows is a shim that cannot parse `deno test` and
 * reports a broken function as passing.
 *
 * Usage:
 *   node scripts/run-edge-tests.mjs            # every suite
 *   node scripts/run-edge-tests.mjs phone-otp  # only matching suites
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = join('supabase', 'functions', 'tests');

function resolveDeno() {
  const candidates = [
    process.env.DENO_BIN,
    join(process.env.LOCALAPPDATA || '', 'Temp', 'kilo', 'denobin', 'deno.exe'),
    'deno',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', shell: false });
    if (probe.error || probe.status !== 0) continue;
    const version = /deno (\d+\.\d+\.\d+)/.exec(`${probe.stdout || ''}${probe.stderr || ''}`)?.[1];
    if (!version) continue;
    const [major, minor] = version.split('.').map(Number);
    if (major < 2) {
      console.error(`skipping Deno ${version} at ${candidate} — too old to run \`deno test\``);
      continue;
    }
    return { bin: candidate, version };
  }
  return null;
}

const DENO = resolveDeno();
if (!DENO) {
  console.error(
    'No usable Deno binary found. Install Deno 2+ (https://deno.com) or set DENO_BIN.\n' +
    'Skipping is not safe: the edge suites are the only coverage of the handler layer.',
  );
  process.exit(1);
}

const filter = process.argv[2];
const suites = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.test.ts'))
  .filter((name) => !filter || name.includes(filter))
  .map((name) => join(TESTS_DIR, name));

if (suites.length === 0) {
  console.error(`No edge test suites matched ${JSON.stringify(filter ?? '*')}.`);
  process.exit(1);
}

console.log(`deno ${DENO.version} (${DENO.bin}) — ${suites.length} suite(s)\n`);

// Each suite runs in its OWN process. `_handlers/shared.ts` reads every secret at
// module scope, so the environment is frozen on first import and a suite needing
// secrets absent is incompatible with a suite needing them present. Separate
// processes give separate module graphs, which `--parallel` does not: its workers
// share Deno's module evaluation cache.
let failed = 0;

for (const suite of suites) {
  console.log(`\n── ${ suite } ${'─'.repeat(Math.max(0, 46 - suite.length))}`);
  const result = spawnSync(
    DENO.bin,
    ['test', '--allow-env', '--allow-net', '--no-lock', suite],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) failed += 1;
}

process.exit(failed === 0 ? 0 : 1);