#!/usr/bin/env node

/**
 * Live frontend <-> backend wiring check.
 *
 * The unit suite and `deno check` both passed while the deployed edge function
 * could not read a single row: `/health` answered 200 and every route that
 * touched the database answered 500 "Unregistered API key". This script probes
 * the deployed function the way the browser does and fails loudly on that class
 * of silent breakage.
 *
 * Usage: node scripts/verify-frontend-backend-wiring.mjs [envFile]
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const log = (m, c = 'reset') => console.log(`${COLORS[c]}${m}${COLORS.reset}`);

let passed = 0;
const failures = [];
let warned = 0;

function ok(label) {
  passed += 1;
  log(`  PASS  ${label}`, 'green');
}
function fail(label, detail) {
  failures.push(label);
  log(`  FAIL  ${label}`, 'red');
  if (detail) log(`        ${detail}`, 'red');
}
function warn(label) {
  warned += 1;
  log(`  WARN  ${label}`, 'yellow');
}

function readEnv(file) {
  const env = {};
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const envFile = process.argv[2] || '.env';
const env = readEnv(envFile);

log('\n🔌 Frontend ↔ backend wiring verification', 'cyan');
log('='.repeat(64), 'cyan');

if (!env) {
  log(`\n❌ ${envFile} not found — cannot resolve the backend URL.`, 'red');
  process.exitCode = 1;
} else {
  const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const functionsBase = (env.VITE_EDGE_FUNCTIONS_BASE_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '')).replace(/\/$/, '');
  const fnName = env.VITE_EDGE_FUNCTION_NAME || 'make-server-0b1f4071';
  const API_URL = functionsBase ? `${functionsBase}/${fnName}` : '';
  const auth = { apikey: anon, Authorization: `Bearer ${anon}` };

  log(`\n  API_URL : ${API_URL || '(unresolved)'}`);

  if (!API_URL || !anon) {
    fail('Backend URL and anon key resolve from env');
  } else {
    ok('Backend URL and anon key resolve from env');

    // ---- 1. Function is deployed and reachable -------------------------
    log('\n1. Function reachability', 'cyan');
    let health = null;
    try {
      const res = await fetch(`${API_URL}/health`, { headers: auth, redirect: 'manual' });
      health = { status: res.status, body: await res.text() };
      if (res.status === 200) ok(`/health responds 200 — ${health.body.slice(0, 60)}`);
      else fail(`/health responds 200`, `got ${res.status}: ${health.body.slice(0, 120)}`);
    } catch (e) {
      fail('/health responds 200', `network error: ${e.message}`);
    }

    // ---- 2. The service-role key actually works ------------------------
    // /health does no database work, so it stays green while every real query
    // fails. These routes are public and hit the database immediately.
    log('\n2. Service-role key (public routes that read the database)', 'cyan');
    const DB_ROUTES = ['/trips/search', '/mobility-os/public-snapshot'];
    const keyLooksBroken = [];
    for (const route of DB_ROUTES) {
      try {
        const res = await fetch(`${API_URL}${route}`, { headers: auth, redirect: 'manual' });
        const body = await res.text();
        if (/unregistered api key|invalid api key/i.test(body)) {
          keyLooksBroken.push(route);
          fail(`${route} can read the database`, `invalid key: ${body.slice(0, 120)}`);
        } else if (res.status >= 500) {
          fail(`${route} can read the database`, `HTTP ${res.status}: ${body.slice(0, 120)}`);
        } else {
          ok(`${route} reaches the database (HTTP ${res.status})`);
        }
      } catch (e) {
        fail(`${route} can read the database`, e.message);
      }
    }
    if (keyLooksBroken.length) {
      log('', 'reset');
      log('  ┌─ ACTION REQUIRED (not fixable in the repo) ─────────────────────', 'yellow');
      log('  │ The deployed function cannot reach Postgres. The key in its env', 'yellow');
      log('  │ is not registered for this project, so every data route 500s.', 'yellow');
      log('  │', 'yellow');
      log('  │   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service key>', 'yellow');
      log('  │   supabase secrets set SUPABASE_URL=' + supabaseUrl, 'yellow');
      log('  │   supabase functions deploy ' + fnName, 'yellow');
      log('  └────────────────────────────────────────────────────────────────', 'yellow');
    }

    // ---- 3. CORS allows every method the app uses ----------------------
    log('\n3. CORS preflight (browser blocks unlisted methods)', 'cyan');
    const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const seen = new Set();
    for (const method of METHODS) {
      let res;
      try {
        res = await fetch(`${API_URL}/bookings`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://wasel14.online',
            'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': 'authorization,content-type,x-csrf-token,apikey',
          },
        });
      } catch (e) {
        fail(`preflight ${method}`, e.message);
        continue;
      }
      (res.headers.get('access-control-allow-methods') || '').split(',').forEach((m) => seen.add(m.trim()));
    }
    for (const method of METHODS) {
      if (seen.has(method)) ok(`${method} allowed by Access-Control-Allow-Methods`);
      else fail(`${method} allowed by Access-Control-Allow-Methods`, 'the browser will refuse to send it');
    }

    // ---- 4. Auth is actually enforced ---------------------------------
    log('\n4. Authentication is enforced', 'cyan');
    try {
      const res = await fetch(`${API_URL}/bookings`, { redirect: 'manual' });
      if (res.status === 401) ok('unauthenticated /bookings is rejected with 401');
      else fail('unauthenticated /bookings is rejected with 401', `got ${res.status}`);
    } catch (e) {
      fail('unauthenticated /bookings is rejected with 401', e.message);
    }

    // ---- 5. /v1 prefix handling ---------------------------------------
    log('\n5. Route namespace', 'cyan');
    const bare = await fetch(`${API_URL}/bookings`, { headers: auth, redirect: 'manual' });
    const prefixed = await fetch(`${API_URL}/v1/bookings`, { headers: auth, redirect: 'manual' });
    if (bare.status === 404) {
      fail('/bookings route exists', `got 404 — ${fnName} may not be the function the app calls`);
    } else {
      ok(`/bookings resolves (HTTP ${bare.status})`);
    }
    if (prefixed.status === 404) {
      fail('/v1/bookings resolves', 'the deployed build does not strip the /v1 prefix in index.ts — redeploy required');
    } else {
      ok(`/v1/bookings resolves (HTTP ${prefixed.status})`);
    }
  }
}

log('\n' + '='.repeat(64), 'cyan');
log(`${passed} passed, ${failures.length} failed, ${warned} warnings`, failures.length ? 'red' : 'green');
log('='.repeat(64) + '\n', 'cyan');

process.exitCode = failures.length ? 1 : 0;
