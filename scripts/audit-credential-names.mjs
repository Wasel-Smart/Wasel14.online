import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const credentialName =
  /(SUPABASE|STRIPE|TWILIO|CLIQ|RESEND|SENDGRID|GOOGLE|FACEBOOK|META|VERCEL|DATABASE|POSTGRES|REDIS|SENTRY|APP_INSIGHTS|COMMUNICATION|WORKER|WEBHOOK|AWS|AUTH0|SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/i;
const sourcesByName = new Map();

function record(name, source) {
  if (!credentialName.test(name)) {return;}
  const sources = sourcesByName.get(name) ?? new Set();
  sources.add(source);
  sourcesByName.set(name, sources);
}

function inspectEnvFile(directory, filename) {
  const source = `${basename(directory)}${directory === process.cwd() ? '' : ` (${directory})`}/${filename}`;
  const template = /(?:\.example|\.template|\.sample)$/i.test(filename);

  for (const line of readFileSync(resolve(directory, filename), 'utf8').split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator < 0) {continue;}

    const declaration = line.slice(0, separator).trim().replace(/^export\s+/, '');
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(declaration)) {
      record(declaration, `${source}${template ? ' [template]' : ''}`);
    }
  }
}

const envDirectories = new Set([process.cwd()]);
if (process.env.WASEL_ENV_DIR) {
  envDirectories.add(resolve(process.env.WASEL_ENV_DIR));
}

for (const [name] of Object.entries(process.env)) {
  record(name, 'process environment (set)');
}

for (const directory of envDirectories) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    console.warn(`Could not read env directory: ${directory}`);
    continue;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith('.env')) {
      inspectEnvFile(directory, entry.name);
    }
  }
}

console.log('Credential variable names only; values are never printed.');
for (const [name, sources] of [...sourcesByName].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`${name}: ${[...sources].sort().join(', ')}`);
}

if (sourcesByName.size === 0) {
  console.log('No matching credential variable names found.');
}
