// One-shot diagnosis for `npm run dev` and `npm run build`.
//   node scripts/diagnose-build.mjs
// Writes diagnose-report.log (git-ignored via *.log). Paste that file back when asking for help.
// It changes nothing except creating dist/ (via vite build) and the report itself.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
process.chdir(root);
const out = [];
const log = (line = '') => { out.push(line); console.log(line); };
const isWin = process.platform === 'win32';

function section(title) { log(`\n===== ${title} =====`); }

function run(title, cmd, args, { tail = 60, env = {} } = {}) {
  section(title);
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, shell: isWin, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = text.split(/\r?\n/);
  const errorLines = lines.filter((l) => /error|ERR!|failed|Cannot find|TS\d{4}/i.test(l));
  log(`exit=${r.status} signal=${r.signal ?? '-'} time=${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (errorLines.length) {
    log(`-- first ${Math.min(errorLines.length, 40)} of ${errorLines.length} error lines --`);
    errorLines.slice(0, 40).forEach((l) => log(l));
  }
  log(`-- last ${tail} lines --`);
  lines.slice(-tail).forEach((l) => log(l));
  return r.status === 0;
}

section('Environment');
log(`node ${process.version}  platform ${process.platform}`);
log(`cwd ${root}`);

section('node_modules sanity');
const must = ['typescript', 'vite', '@types/node', '@supabase/supabase-js', 'react', 'react-dom', 'react-router', '@vitejs/plugin-react', '@tailwindcss/vite', 'lucide-react', 'framer-motion', 'motion'];
let missing = 0;
for (const name of must) {
  const ok = fs.existsSync(path.join(root, 'node_modules', ...name.split('/')));
  if (!ok) missing += 1;
  log(`${ok ? 'ok     ' : 'MISSING'} ${name}`);
}
if (missing > 3) {
  log('\nToo many packages are missing: node_modules is not installed. Run `npm ci` first, then rerun this script.');
  fs.writeFileSync('diagnose-report.log', out.join('\n'));
  process.exit(1);
}

const tscOk = run('tsc (what `npm run build` runs first: tsconfig.json)', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { tail: 30 });
const viteOk = run('vite build', 'npx', ['vite', 'build'], { tail: 40 });
const swOk = viteOk && run('post-build: PWA manifest + service worker stamp', 'node', ['scripts/generate-pwa-manifest.mjs'], { tail: 5 })
  && run('post-build: version sw.js', 'node', ['scripts/version-sw.mjs'], { tail: 5 });

// Dev server smoke test: start vite, wait for the ready line, fetch the entry module, stop it.
section('vite dev server smoke test (30s max)');
const devOk = await new Promise((resolve) => {
  const child = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: root, shell: isWin, env: { ...process.env, WASEL_NO_OPEN: 'true', CI: 'true' } });
  let buf = '';
  let done = false;
  const finish = (ok, note) => { if (done) return; done = true; log(note); try { isWin ? spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']) : child.kill('SIGTERM'); } catch { /* ignore */ } resolve(ok); };
  const onData = async (d) => {
    buf += d.toString().replace(/\x1b\[[0-9;]*m/g, '');
    if (/ready in|Local:/i.test(buf) && !done) {
      try {
        const html = await fetch('http://127.0.0.1:5199/');
        const entry = await fetch('http://127.0.0.1:5199/src/main.tsx');
        const body = await entry.text();
        log(`GET /              -> ${html.status}`);
        log(`GET /src/main.tsx  -> ${entry.status} (${body.length} bytes)`);
        if (entry.status !== 200) log(body.slice(0, 1500));
        finish(html.status === 200 && entry.status === 200, 'dev server responded');
      } catch (e) { finish(false, `dev server fetch failed: ${e.message}`); }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  setTimeout(() => finish(false, `dev server did not become ready in 30s. Output so far:\n${buf.slice(-2000)}`), 30000);
});

section('Summary');
log(`tsc            ${tscOk ? 'PASS' : 'FAIL'}`);
log(`vite build     ${viteOk ? 'PASS' : 'FAIL'}`);
log(`post-build     ${swOk ? 'PASS' : 'FAIL/SKIPPED'}`);
log(`dev server     ${devOk ? 'PASS' : 'FAIL'}`);
fs.writeFileSync('diagnose-report.log', out.join('\n'));
console.log('\nReport written to diagnose-report.log');
process.exit(tscOk && viteOk && swOk && devOk ? 0 : 1);
