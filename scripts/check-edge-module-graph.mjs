import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// Deno fails the whole bundle at boot if any named import is not exported by
// the target module, so this checks that statically instead of at runtime.
const root = process.argv[2] || 'supabase/functions/make-server-0b1f4071';

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(root);
const exportsOf = new Map();

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (n) names.add(n.trim());
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  exportsOf.set(resolve(f), names);
}

let problems = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(f), spec);
    const available = exportsOf.get(target);
    if (!available) continue;
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      if (!available.has(name)) {
        console.log(`UNRESOLVED  ${f.replace(/\\/g, '/')}  imports { ${name} } from ${spec}  (not exported)`);
        problems++;
      }
    }
  }
}

console.log(problems === 0 ? `OK: all relative imports resolve across ${files.length} files` : `${problems} unresolved import(s)`);
process.exit(problems === 0 ? 0 : 1);
