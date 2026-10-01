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
let broken = 0;
console.log(`deno ${DENO.version} (${DENO.bin})`);
for (const fn of fns) {
  const res = spawnSync(DENO.bin, ['check', '--no-lock', join(fn, 'index.ts')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const text = `${res.stdout || ''}${res.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

  // The regex below only matches diagnostics carrying a
  // `at file:///.../supabase/functions/...:line:col` frame. Module-resolution
  // failures (TS2307 and friends) are reported WITHOUT that frame, so counting
  // framed errors alone reported "TOTAL: 0" and exited 0 for a function that
  // cannot link at all — which ships as an active 503 BOOT_ERROR. The exit
  // status is therefore authoritative: anything non-zero is a failure, and the
  // output is printed so the cause is visible.
  const exitCode = res.status ?? 1;
  const spawnFailed = Boolean(res.error) || exitCode !== 0;

  const re = /TS(\d+) \[ERROR\]: (.*?)\n([\s\S]*?)\n\s*at file:\/\/\/.*?supabase[/\\]functions[/\\](.+?):(\d+):(\d+)/g;
  const sites = [];
  for (const m of text.matchAll(re)) {
    sites.push(`${m[4]}:${m[5]}:${m[6]} TS${m[1]} ${m[2].trim()}`);
  }

  // Any TS#### code anywhere in the output counts, framed or not.
  const unframed = [...text.matchAll(/TS(\d+) \[ERROR\]/g)]
    .filter(() => sites.length === 0)
    .map((m) => `unframed TS${m[1]}`);

  total += sites.length + unframed.length;

  if (spawnFailed) {
    broken += 1;
    console.log(`\n${fn}`);
    if (res.error) {
      console.log(`  failed to run deno check: ${res.error.message}`);
    }
    for (const s of sites) console.log(`  ${s}`);
    if (sites.length === 0) {
      const raw = text.trim().split('\n').filter(Boolean);
      for (const line of raw.slice(0, 20)) console.log(`  ${line}`);
    }
  }
}
console.log(`\nTOTAL: ${total}`);
if (broken) {
  console.error(`\n${broken} edge function(s) failed \`deno check\` (exit != 0).`);
}
process.exitCode = total || broken ? 1 : 0;
