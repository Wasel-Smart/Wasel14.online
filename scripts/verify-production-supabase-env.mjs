import { readFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/verify-production-supabase-env.mjs <env-file>');
  process.exit(2);
}

const variables = Object.fromEntries(
  readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?([^#=\s]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(([, key, rawValue]) => [key, rawValue.replace(/^(['"])(.*)\1$/, '$2')]),
);

const expected = {
  VITE_SUPABASE_URL: 'https://zexlxabdcsjefptmjhuq.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_mmpnEORTSVIa3K-l3jiz6Q_wYVDEdkP', // secretscan:allow - anon/publishable keys are public; RLS protects data.
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mmpnEORTSVIa3K-l3jiz6Q_wYVDEdkP', // secretscan:allow - publishable keys are public; RLS protects data.
};
let failed = false;
for (const [name, value] of Object.entries(expected)) {
  const matches = variables[name] === value;
  console.log(`${name}: ${matches ? 'correct' : variables[name] ? 'mismatch' : 'missing'}`);
  failed ||= !matches;
}
process.exitCode = failed ? 1 : 0;
