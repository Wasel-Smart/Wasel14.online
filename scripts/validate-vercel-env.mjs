#!/usr/bin/env node
/**
 * scripts/validate-vercel-env.mjs
 *
 * Validates that every environment variable required for a production Vercel
 * deployment is present and contains a real value (not a placeholder).
 *
 * Usage:
 *   node scripts/validate-vercel-env.mjs              # check .env.production + .env.local
 *   node scripts/validate-vercel-env.mjs --strict     # also fail on warnings
 *   node scripts/validate-vercel-env.mjs --fix-hints  # print exact Vercel CLI commands
 *
 * Exit 0 = all required vars are set and real.
 * Exit 1 = one or more required vars are missing or placeholder.
 *
 * Designed to run in CI before `vercel --prod` or as a local pre-deploy gate.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const FIX_HINTS = process.argv.includes('--fix-hints');

// ── Placeholder detection ─────────────────────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /PASTE_YOUR/i,
  /YOUR_KEY/i,
  /YOUR_DSN/i,
  /YOUR_SECRET/i,
  /YOUR_TOKEN/i,
  /YOUR_ID/i,
  /YOUR_SID/i,
  /YOUR_PROJECT/i,
  /placeholder/i,
  /example\.com/i,
  /SET_REAL/i,
  /TODO/i,
  /REPLACE_ME/i,
  /^pk_live_PASTE/,
  /^sk_live_PASTE/,
  /^whsec_PASTE/,
  /^re_live_PASTE/,
  /^SG\.PASTE/,
  /InstrumentationKey=PASTE/,
  /^https:\/\/PASTE/,
  /oPASTE_YOUR_ORG/,
];

function isPlaceholder(value) {
  if (!value || value.trim() === '') return true;
  return PLACEHOLDER_PATTERNS.some(p => p.test(value));
}

// ── Env file loading ──────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, 'utf8').split('\n');
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = val;
  }
  return result;
}

// Load in priority order: process.env > .env.production.local > .env.production > .env.local > .env
const envSources = [
  resolve(ROOT, '.env'),
  resolve(ROOT, '.env.local'),
  resolve(ROOT, '.env.production'),
  resolve(ROOT, '.env.production.local'),
];

// Check WASEL_ENV_DIR for offsite secrets
const offsiteDir = process.env.WASEL_ENV_DIR;
if (offsiteDir) {
  envSources.push(
    resolve(offsiteDir, '.env'),
    resolve(offsiteDir, '.env.local'),
    resolve(offsiteDir, '.env.production'),
    resolve(offsiteDir, '.env.production.local'),
  );
}

const merged = {};
for (const src of envSources) {
  Object.assign(merged, parseEnvFile(src));
}
// process.env wins over file values
Object.assign(merged, process.env);

function get(key) {
  return merged[key] ?? null;
}

// ── Variable definitions ──────────────────────────────────────────────────────
// severity: 'required' = blocks deploy, 'recommended' = warns only
const VARS = [
  // ── Supabase ──
  {
    key: 'VITE_SUPABASE_URL',
    severity: 'required',
    description: 'Supabase project URL',
    where: 'Supabase Dashboard → Settings → API → Project URL',
    vercelEnv: 'production',
  },
  {
    key: 'VITE_SUPABASE_PUBLISHABLE_KEY',
    severity: 'required',
    description: 'Supabase publishable (anon) key',
    where: 'Supabase Dashboard → Settings → API → Project API keys → anon/public',
    vercelEnv: 'production',
  },
  {
    key: 'VITE_EDGE_FUNCTION_NAME',
    severity: 'required',
    description: 'Main edge function name',
    where: 'Set to: make-server-0b1f4071',
    vercelEnv: 'production',
  },
  {
    key: 'VITE_APP_URL',
    severity: 'required',
    description: 'Canonical production URL',
    where: 'Set to: https://www.wasel14.online',
    vercelEnv: 'production',
  },

  // ── Stripe ──
  {
    key: 'VITE_STRIPE_PUBLISHABLE_KEY',
    severity: 'required',
    description: 'Stripe publishable key (browser-safe)',
    where: 'Stripe Dashboard → Developers → API Keys → Publishable key',
    vercelEnv: 'production',
  },
  {
    key: 'STRIPE_SECRET_KEY',
    severity: 'required',
    description: 'Stripe secret key (server-only)',
    where: 'Stripe Dashboard → Developers → API Keys → Secret key',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    severity: 'required',
    description: 'Stripe webhook signing secret',
    where: 'Stripe Dashboard → Developers → Webhooks → your endpoint → Signing secret',
    vercelEnv: 'production',
    serverOnly: true,
  },

  // ── Observability ──
  {
    key: 'VITE_SENTRY_DSN',
    severity: 'required',
    description: 'Sentry DSN for error monitoring',
    where: 'sentry.io → Your project → Settings → Client Keys (DSN)',
    vercelEnv: 'production',
  },
  {
    key: 'VITE_APP_INSIGHTS_CONNECTION_STRING',
    severity: 'recommended',
    description: 'Azure Application Insights connection string',
    where: 'Azure Portal → Application Insights → Overview → Connection String',
    vercelEnv: 'production',
  },

  // ── Twilio ──
  {
    key: 'TWILIO_ACCOUNT_SID',
    severity: 'required',
    description: 'Twilio Account SID',
    where: 'console.twilio.com → Account Info → Account SID',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'TWILIO_AUTH_TOKEN',
    severity: 'required',
    description: 'Twilio Auth Token',
    where: 'console.twilio.com → Account Info → Auth Token',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'TWILIO_MESSAGING_SERVICE_SID',
    severity: 'required',
    description: 'Twilio Messaging Service SID',
    where: 'Twilio Console → Messaging → Services → your service SID (MG...)',
    vercelEnv: 'production',
    serverOnly: true,
  },

  // ── Resend ──
  {
    key: 'RESEND_API_KEY',
    severity: 'required',
    description: 'Resend API key for transactional email',
    where: 'resend.com → API Keys → Create API key',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'RESEND_FROM_EMAIL',
    severity: 'required',
    description: 'Resend verified sender address',
    where: 'Set to: Wasel <notifications@wasel14.online> (must be verified in Resend)',
    vercelEnv: 'production',
    serverOnly: true,
  },

  // ── Worker secrets ──
  {
    key: 'COMMUNICATION_WORKER_SECRET',
    severity: 'required',
    description: 'Internal worker authentication secret',
    where: 'Generate: openssl rand -hex 32',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'OUTBOX_WORKER_SECRET',
    severity: 'required',
    description: 'Outbox worker authentication secret',
    where: 'Generate: openssl rand -hex 32',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'WASEL_INTERNAL_HEALTH_TOKEN',
    severity: 'required',
    description: 'Internal health endpoint token',
    where: 'Generate: openssl rand -hex 32',
    vercelEnv: 'production',
    serverOnly: true,
  },

  // ── OAuth ──
  {
    key: 'SUPABASE_AUTH_GOOGLE_CLIENT_SECRET',
    severity: 'required',
    description: 'Google OAuth client secret (Supabase Auth)',
    where: 'Google Cloud Console → APIs & Services → Credentials → OAuth client → Reset Secret',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET',
    severity: 'required',
    description: 'Facebook OAuth app secret (Supabase Auth)',
    where: 'Meta for Developers → App Settings → Basic → App Secret → Reset',
    vercelEnv: 'production',
    serverOnly: true,
  },

  // ── CliQ ──
  {
    key: 'CLIQ_API_KEY',
    severity: 'recommended',
    description: 'CliQ (JoPACC) API key for Jordan instant payments',
    where: 'CliQ merchant portal → API credentials',
    vercelEnv: 'production',
    serverOnly: true,
  },
  {
    key: 'CLIQ_WEBHOOK_SECRET',
    severity: 'recommended',
    description: 'CliQ webhook signing secret',
    where: 'CliQ merchant portal → Webhook settings',
    vercelEnv: 'production',
    serverOnly: true,
  },
];

// ── Run checks ────────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];
const passed = [];
const missing = [];

for (const v of VARS) {
  const val = get(v.key);
  const label = v.serverOnly ? `${v.key} (server-only)` : v.key;

  if (!val || val.trim() === '') {
    const msg = `${label} — ${v.description}`;
    if (v.severity === 'required') {
      errors.push({ ...v, msg, issue: 'missing' });
    } else {
      warnings.push({ ...v, msg, issue: 'missing' });
    }
    missing.push(v);
  } else if (isPlaceholder(val)) {
    const msg = `${label} — contains placeholder value`;
    if (v.severity === 'required') {
      errors.push({ ...v, msg, issue: 'placeholder' });
    } else {
      warnings.push({ ...v, msg, issue: 'placeholder' });
    }
    missing.push(v);
  } else {
    passed.push(`${label}`);
  }
}

// ── Output ────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   Wasel — Vercel Environment Variable Validation     ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

if (offsiteDir) {
  console.log(`  ℹ️  Loading secrets from WASEL_ENV_DIR: ${offsiteDir}\n`);
}

if (passed.length) {
  console.log(`✅ Set and valid (${passed.length}):`);
  for (const p of passed) console.log(`   ✓ ${p}`);
  console.log('');
}

if (warnings.length) {
  console.log(`⚠️  Recommended but missing/placeholder (${warnings.length}):`);
  for (const w of warnings) {
    console.log(`   ⚠ ${w.msg}`);
    console.log(`     Where: ${w.where}`);
  }
  console.log('');
}

if (errors.length) {
  console.log(`❌ Required but missing/placeholder (${errors.length}):`);
  for (const e of errors) {
    console.log(`   ✗ ${e.msg}`);
    console.log(`     Where: ${e.where}`);
  }
  console.log('');
}

// ── Fix hints ─────────────────────────────────────────────────────────────────
if (FIX_HINTS && missing.length > 0) {
  console.log('─'.repeat(60));
  console.log('VERCEL CLI COMMANDS (fill in real values first):');
  console.log('─'.repeat(60));
  for (const v of missing) {
    const env = v.vercelEnv ?? 'production';
    console.log(`vercel env add ${v.key} ${env}`);
  }
  console.log('');
  console.log('Or set all at once via Vercel Dashboard:');
  console.log('  https://vercel.com/dashboard → Your Project → Settings → Environment Variables');
  console.log('');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('─'.repeat(60));
console.log(`  Passed:   ${passed.length}`);
console.log(`  Warnings: ${warnings.length}`);
console.log(`  Errors:   ${errors.length}`);
console.log('─'.repeat(60));

const blocked = errors.length > 0 || (STRICT && warnings.length > 0);
if (blocked) {
  console.log('\n🚫 DEPLOY BLOCKED — set the required variables in Vercel before deploying.\n');
  if (!FIX_HINTS) {
    console.log('   Run with --fix-hints to see the exact vercel env add commands.\n');
  }
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  DEPLOY ALLOWED — but recommended variables are missing. Some features will be dark.\n');
} else {
  console.log('\n🚀 ALL REQUIRED VARIABLES SET — safe to deploy to production.\n');
}
