#!/usr/bin/env node
/**
 * Secret scanner for tracked files and local-only env files.
 *
 * Design rules (do not weaken these without a security review):
 *  1. Template/example files (`.env.example`, `*.template`) and security docs
 *     are scanned like everything else. Those are exactly the files where
 *     real values leak by accident, so they are NEVER excluded wholesale.
 *  2. A finding is suppressed only when the *matched value itself* looks like
 *     a placeholder, or when the line carries an explicit
 *     `secretscan:allow` marker (use sparingly, with a reason).
 *  3. The scanner never prints the secret value, only file, line and rule.
 *
 * Exit codes: 0 = clean, 1 = potential secret found (or scanner error).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RULES = [
  { id: 'STRIPE_SECRET_KEY', re: /\b[sr]k_live_[A-Za-z0-9]{16,}/ },
  { id: 'STRIPE_TEST_SECRET_KEY', re: /\b[sr]k_test_[A-Za-z0-9]{24,}/ },
  { id: 'STRIPE_WEBHOOK_SECRET', re: /\bwhsec_[A-Za-z0-9+/=]{24,}/ },
  { id: 'TWILIO_ACCOUNT_SID', re: /\bAC[a-f0-9]{32}\b/ },
  { id: 'TWILIO_API_KEY_SID', re: /\bSK[a-f0-9]{32}\b/ },
  { id: 'SUPABASE_SECRET_KEY', re: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { id: 'SUPABASE_PUBLISHABLE_KEY', re: /\bsb_publishable_[A-Za-z0-9_-]{20,}/ },
  { id: 'GOOGLE_OAUTH_SECRET', re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/ },
  { id: 'GOOGLE_API_KEY', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'SENDGRID_API_KEY', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  { id: 'RESEND_API_KEY', re: /\bre_[A-Za-z0-9]{32,}\b/ },
  { id: 'SLACK_TOKEN', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'AWS_ACCESS_KEY_ID', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'PRIVATE_KEY_BLOCK', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { id: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // Database URL with an inline password. Group 1 = user, group 2 = password, group 3 = host.
  {
    id: 'DATABASE_URL_PASSWORD',
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:\s/@]+):([^@\s]+)@([^/\s:?]+)/i,
    validate: (m) => !isPlaceholderValue(m[2]) && !isLocalHost(m[3]),
  },
];

const PLACEHOLDER_HINTS = [
  'your', 'placeholder', 'replace', 'example', 'changeme', 'change-me', 'dummy', 'sample',
  'fake', 'redacted', 'xxxx', 'password', 'passwd', 'secret_here', 'paste_', 'rotate_and_set',
  'set_real', '<', '>', '${', '...', '••••',
];

function isPlaceholderValue(value) {
  const v = String(value).toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => v.includes(hint));
}

function isLocalHost(host) {
  return ['localhost', '127.0.0.1', '0.0.0.0', 'host.docker.internal', 'db', 'postgres', 'redis']
    .includes(String(host).toLowerCase());
}

/** Supabase's public local-dev demo JWTs are not secrets. */
function isSupabaseDemoJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return json?.iss === 'supabase-demo';
  } catch {
    return false;
  }
}

/** Files that legitimately contain detection patterns or opaque hashes. */
const SKIP_PATHS = [
  'node_modules/',
  '.git/',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'scripts/validate-no-secrets.mjs',
  'scripts/check-env-exposure.mjs',
  '.gitleaks.toml',
  '.trufflehog-ignore',
];

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.gz', '.woff', '.woff2',
  '.ttf', '.otf', '.mp4', '.mov', '.lockb',
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Real env files that are gitignored but may sit in a cloud-synced folder. */
const LOCAL_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.staging',
  '.env.staging.local',
  'mobile/.env',
  'mobile/.env.local',
  'mobile/.env.production',
];

function shouldSkip(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (SKIP_PATHS.some((skip) => normalized === skip || normalized.includes(skip))) return true;
  return SKIP_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function scanContent(file, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('secretscan:allow')) continue;
    for (const rule of RULES) {
      const match = rule.re.exec(line);
      if (!match) continue;
      if (rule.id === 'JWT' && isSupabaseDemoJwt(match[0])) continue;
      if (rule.validate) {
        if (!rule.validate(match)) continue;
      } else if (isPlaceholderValue(match[0])) {
        continue;
      }
      findings.push({ file, line: i + 1, rule: rule.id });
    }
  }
  return findings;
}

function readIfSmall(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
  return fs.readFileSync(file, 'utf8');
}

function main() {
  const findings = [];

  // 1. Local-only env files (never committed, but exposed by folder sync).
  for (const localFile of LOCAL_ENV_FILES) {
    if (!fs.existsSync(localFile)) continue;
    const content = readIfSmall(localFile);
    if (content === null) continue;
    for (const f of scanContent(localFile, content)) findings.push({ ...f, scope: 'local-only' });
  }

  // 2. Every tracked file, templates and docs included.
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);

  for (const file of tracked) {
    if (shouldSkip(file) || !fs.existsSync(file)) continue;
    let content;
    try {
      content = readIfSmall(file);
    } catch {
      continue;
    }
    if (content === null) continue;
    for (const f of scanContent(file, content)) findings.push({ ...f, scope: 'tracked' });
  }

  if (findings.length === 0) {
    console.log('OK: no hardcoded secrets detected in tracked files or local env files.');
    return 0;
  }

  for (const f of findings) {
    console.error(`FAIL [${f.scope}] ${f.file}:${f.line}  rule=${f.rule}`);
  }
  console.error(
    `\n${findings.length} potential secret(s) found. Values are intentionally not printed.\n` +
      'Rotate anything real at the provider, replace it with a placeholder, and purge git history if it was committed.',
  );
  return 1;
}

try {
  process.exit(main());
} catch (error) {
  console.error('Error running secret validation:', error instanceof Error ? error.message : error);
  process.exit(1);
}
