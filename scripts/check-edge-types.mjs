import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve a real Deno binary.
 *
 * The `deno` npm package on Windows is a shim that mis-parses `deno check`, so a
 * bare `deno` on PATH can silently report a broken function as passing. DENO_BIN
 * wins, then a locally installed copy, then whatever is on PATH — and whatever
 * is chosen is version-checked so a shim cannot masquerade as the real thing.
 */
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
    // The npm shim reports 1.0.1; anything that old predates `deno check`.
    const [major, minor] = version.split('.').map(Number);
    if (major < 2) {
      console.error(`skipping Deno ${version} at ${candidate} — too old to run \`deno check\``);
      continue;
    }
    return { bin: candidate, version };
  }
  return null;
}

const DENO = resolveDeno();
if (!DENO) {
  console.error(
    'No usable Deno binary found. Install Deno 2+ (https://deno.com) or set DENO_BIN,\n' +
    'then re-run `npm run edge:types`. Skipping is not safe: without this check a\n' +
    'function that cannot link its module graph ships as an ACTIVE 503 BOOT_ERROR.',
  );
  process.exit(1);
}

const ROOT = 'supabase/functions';
const fns = readdirSync(ROOT)
  .map((n) => join(ROOT, n))
  .filter((p) => statSync(p).isDirectory() && p !== join(ROOT, '_shared') && existsSync(join(p, 'index.ts')));

let total = 0;
console.log(`deno ${DENO.version} (${DENO.bin})`);
for (const fn of fns) {
  const res = spawnSync(DENO.bin, ['check', '--no-lock', join(fn, 'index.ts')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const text = `${res.stdout || ''}${res.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const re = /TS(\d+) \[ERROR\]: (.*?)\n([\s\S]*?)\n\s*at file:\/\/\/.*?supabase[/\\]functions[/\\](.+?):(\d+):(\d+)/g;
  const sites = [];
  for (const m of text.matchAll(re)) {
    sites.push(`${m[4]}:${m[5]}:${m[6]} TS${m[1]} ${m[2].trim()}`);
  }
  total += sites.length;
  if (sites.length) {
    console.log(`\n${fn}`);
    for (const s of sites) console.log(`  ${s}`);
  }
}
console.log(`\nTOTAL: ${total}`);
process.exitCode = total ? 1 : 0;
