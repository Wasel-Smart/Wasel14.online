#!/usr/bin/env node
/**
 * Fails the build when a configured Supabase public key is rejected by Supabase.
 *
 * Why this exists: a stale key shipped to production and every sign-in failed with
 * "Unregistered API key". Vite inlines VITE_* values at build time, so nothing
 * noticed until users did. This check runs from `prebuild`, asks Supabase's auth
 * service whether each configured key is accepted, and stops the deploy if not.
 *
 * It never prints a key (only a short prefix and the length) and it never blocks a
 * build because the network is down: transport errors are warnings.
 *
 * Skip with SKIP_SUPABASE_KEY_CHECK=1.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const KEY_VARS = [
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_PUBLIC_SUPABASE_ANON_KEY',
];
const IS_PRODUCTION_BUILD = process.env.VERCEL_ENV === 'production';

function parseEnvFile(file) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1].startsWith('#')) {continue;}
    out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// Same precedence Vite uses for a production build; real environment variables win.
const fileEnv = ['.env.production.local', '.env.local', '.env.production', '.env']
  .map(parseEnvFile)
  .reduce((acc, next) => ({ ...next, ...acc }), {});
const readVar = (name) => (process.env[name] ?? fileEnv[name] ?? '').trim();

const mask = (value) => `${value.slice(0, 12)}… (len ${value.length})`;

async function main() {
  if (process.env.SKIP_SUPABASE_KEY_CHECK === '1') {
    console.log('[supabase-key] skipped (SKIP_SUPABASE_KEY_CHECK=1)');
    return 0;
  }

  const url = readVar('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const keys = KEY_VARS.map((name) => ({ name, value: readVar(name) })).filter((entry) => entry.value);

  if (!url || keys.length === 0) {
    console.warn('[supabase-key] VITE_SUPABASE_URL or a public key is not set; nothing to verify');
    return IS_PRODUCTION_BUILD ? 1 : 0;
  }

  let failed = false;

  const distinct = new Set(keys.map((entry) => entry.value));
  if (distinct.size > 1) {
    const names = keys.map((entry) => entry.name).join(', ');
    console.error(`[supabase-key] ${names} are set to DIFFERENT values; the first one wins at runtime.`);
    if (IS_PRODUCTION_BUILD) {failed = true;}
  }

  for (const { name, value } of keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: value },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        console.error(`[supabase-key] ${name} (${mask(value)}) was REJECTED by ${url} (HTTP ${response.status}).`);
        console.error('  Copy the Publishable key from Supabase → Project Settings → API Keys and update it everywhere it is set.');
        failed = true;
      } else if (response.ok) {
        console.log(`[supabase-key] ${name} (${mask(value)}) accepted`);
      } else {
        console.warn(`[supabase-key] ${name}: unexpected HTTP ${response.status}; not blocking the build`);
      }
    } catch (error) {
      console.warn(`[supabase-key] could not reach ${url} (${error instanceof Error ? error.name : 'error'}); not blocking the build`);
    } finally {
      clearTimeout(timer);
    }
  }

  return failed ? 1 : 0;
}

main().then((code) => process.exit(code));
