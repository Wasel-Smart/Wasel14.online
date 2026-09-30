import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const FUNCTIONS_ROOT = 'supabase/functions';

// `supabase functions deploy` uploads one directory at a time, so every
// function is its own bundle and each one has to be checked independently.
// Defaults to all of them; pass a directory to narrow the check.
const roots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(FUNCTIONS_ROOT)
    .map((name) => join(FUNCTIONS_ROOT, name))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, 'index.ts')));

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

let problems = 0;
let checkedFiles = 0;

for (const root of roots) {
  const files = walk(root);
  checkedFiles += files.length;
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

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[2];
      if (!spec.startsWith('.')) continue;
      const target = resolve(dirname(f), spec);
      const available = exportsOf.get(target);

      // A specifier that escapes the function directory, or that resolves to no
      // file at all, cannot be linked by Deno on the deployed runtime — the whole
      // module graph fails at boot and every route answers 503 BOOT_ERROR. This
      // used to `continue` silently, which is how a broken bundle shipped green.
      const rel = relative(root, target).split(/[\\/]/).join('/');
      if (rel.startsWith('..')) {
        console.log(`ESCAPES   ${f.replace(/\\/g, '/')} imports '${spec}' which resolves outside ${root.replace(/\\/g, '/')}`);
        problems++;
        continue;
      }
      if (!existsSync(target) && !existsSync(`${target}.ts`)) {
        console.log(`DANGLING  ${f.replace(/\\/g, '/')} imports '${spec}' which does not exist`);
        problems++;
        continue;
      }
      if (!available) continue;
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        if (!available.has(name)) {
          console.log(`UNRESOLVED  ${f.replace(/\\/g, '/')}  imports { ${name } from ${spec}  (not exported)`);
          problems++;
        }
      }
    }
  }
}

console.log(problems === 0
  ? `OK: all relative imports resolve across ${checkedFiles} files in ${roots.length} edge function(s)`
  : `${problems} module graph problem(s)`);
process.exit(problems === 0 ? 0 : 1);
