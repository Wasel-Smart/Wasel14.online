import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { ROUTE_META, getRouteMeta } from '../../src/router/routeMeta';

/**
 * Guards the class of bug where a route renders a blank screen because its
 * lazy module never produced a component.
 *
 * `lazy()` in src/wasel-routes.tsx falls back to `mod.default` when no export
 * name is passed. Five pages (AdminDashboardPage, SchedulePage, PrivacyPolicy,
 * TermsOfService, SecurityPage) export a *named* function only, so
 * `Component` resolved to `undefined` and React threw "Element type is
 * invalid" — every one of those pages was unreachable. Nothing in the type
 * system, lint, or the existing suites could see it, because
 * `() => import('./x')` is typed as `Promise<any>`.
 *
 * These tests assert the contract statically: the module must exist, and it
 * must actually export the symbol the route asks for.
 */

const ROOT = resolve(__dirname, '../..');
const ROUTES_FILE = join(ROOT, 'src', 'wasel-routes.tsx');
const APP_DIR = join(ROOT, 'src');

function readFile(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8');
}

function resolveModule(specifier: string): string | undefined {
  const base = resolve(dirname(ROUTES_FILE), specifier);
  const candidates = [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate));
}

/** Every module the router lazily loads, with the export name it relies on. */
function readLazyRoutes(): Array<{ specifier: string; exportName?: string; file: string }> {
  const source = readFile(ROUTES_FILE);
  const pattern = /lazy\(\s*\(\)\s*=>\s*import\('([^']+)'\)\s*(?:,\s*'([^']+)'\s*)?\)/g;
  const routes: Array<{ specifier: string; exportName?: string; file: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const file = resolveModule(match[1] ?? '');
    if (!file) {
      throw new Error(`Route imports a module that does not exist: ${match[1]}`);
    }
    routes.push({ specifier: match[1] ?? '', exportName: match[2], file });
  }

  return routes;
}

/** True when `name` is exported from `source`, including re-export forms. */
function exportsName(source: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|let|var|class)\\s+${escaped}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`),
    new RegExp(`export\\s+\\*\\s+from`),
    new RegExp(`export\\s*\\{[^}]*\\bdefault\\b[^}]*\\}\\s*from`),
  ];

  return patterns.some((candidate) => candidate.test(source));
}

function hasDefaultExport(source: string): boolean {
  return (
    /export\s+default\b/.test(source) ||
    /export\s*\{[^}]*\bdefault\b[^}]*\}\s*from/.test(source) ||
    /export\s*\*\s+from/.test(source)
  );
}

const LAZY_ROUTES = readLazyRoutes();

describe('every lazy route resolves to a real component export', () => {
  it('the router actually declares lazy routes (guards against a silent parse miss)', () => {
    expect(LAZY_ROUTES.length).toBeGreaterThan(20);
  });

  for (const { specifier, exportName, file } of LAZY_ROUTES) {
    const label = exportName ? `${specifier} (named: ${exportName})` : `${specifier} (default)`;

    it(`${label} exports what the route renders`, () => {
      const source = readFile(file);

      if (exportName) {
        expect(exportsName(source, exportName)).toBe(true);
      } else {
        expect(hasDefaultExport(source)).toBe(true);
      }
    });
  }
});

/**
 * Paths declared by the top-level `createBrowserRouter([...])` array. These are
 * absolute by design and are not `/app` children, so the "relative child path"
 * and "duplicate path" contracts below must not consider them.
 */
const TOP_LEVEL_PATHS = new Set(['/', '/trust', '/security', '/app', '*']);

/** `/app` child paths only — the segment list the router actually declares. */
function declaredAppChildPaths(): string[] {
  const source = readFile(ROUTES_FILE);
  const start = source.indexOf('const buildMainChildren');
  // Bound the slice to the factory's own closing `];` so the top-level
  // createBrowserRouter array (which legitimately re-declares `*`) is excluded.
  const end = source.indexOf('\n];', start);
  const body = source.slice(start, end === -1 ? undefined : end);
  return [...body.matchAll(/path:\s*'([^']+)'/g)]
    .map((match) => match[1] ?? '')
    .filter((path) => !path.startsWith('/'));
}

describe('every declared route path is reachable', () => {
  const declaredPaths = declaredAppChildPaths();
  const topLevelPaths = [...readFile(ROUTES_FILE).matchAll(/path:\s*'\/([^']*)'/g)].map(
    (match) => match[1] ?? '',
  );

  it('declares paths and mounts the app shell', () => {
    expect(declaredPaths.length).toBeGreaterThan(20);
    expect(topLevelPaths).toContain('app');
  });

  it('every path declared inside /app children is relative, never absolute', () => {
    // An absolute child path would escape the /app layout and silently drop the
    // header, bottom nav and auth guard without any error.
    const absolute = [...readFile(ROUTES_FILE).matchAll(/path:\s*'([^']+)'/g)]
      .map((match) => match[1] ?? '')
      .filter((path) => path.startsWith('/') && !TOP_LEVEL_PATHS.has(path));

    expect(absolute).toEqual([]);
  });

  it('no two /app child routes declare the same path', () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const path of declaredPaths) {
      if (seen.has(path)) {
        duplicates.add(path);
      }
      seen.add(path);
    }
    expect([...duplicates]).toEqual([]);
  });

  it('every route metadata entry maps to a route the router declares', () => {
    const declared = new Set(declaredPaths);
    for (const meta of ROUTE_META) {
      if (meta.path === '/') {
        continue;
      }
      if (!meta.path.startsWith('/app')) {
        // Public marketing routes (/trust) are declared at the top level.
        expect(TOP_LEVEL_PATHS.has(meta.path), `${meta.path} is not a top-level route`).toBe(true);
        continue;
      }
      const relative = meta.path.replace(/^\/app\/?/, '');
      expect(declared.has(relative), `${meta.path} has no matching route`).toBe(true);
    }
  });
});

describe('route metadata drives document titles for every route', () => {
  const declaredPaths = declaredAppChildPaths();

  // Error routes, legacy redirect aliases and the top-level shell routes
  // intentionally have no metadata of their own: the aliases render a
  // <Navigate> immediately, so useSeo never runs for them.
  const WITHOUT_META = new Set([
    '403',
    '500',
    'auth404',
    'auth',
    'auth/callback',
    'dashboard',
    'home',
    'post-ride',
    'booking-requests',
    'awasel/send',
    'awasel/track',
    'services/raje3',
    'payments',
    'legal/privacy',
    'legal/terms',
  ]);

  it('each real page route resolves to metadata so useSeo sets a title', () => {
    // useSeo returns early when meta is undefined, which leaves the previous
    // page's document.title in place — the classic "Driver" title on /schedule.
    const unmapped = declaredPaths.filter((path) => {
      if (WITHOUT_META.has(path) || path === '*') {
        return false;
      }
      return getRouteMeta(`/app/${path}`) === undefined;
    });

    expect(unmapped).toEqual([]);
  });

  it('prefers the most specific metadata entry', () => {
    expect(getRouteMeta('/app/admin/users')?.path).toBe('/app/admin/users');
    expect(getRouteMeta('/app/admin/disputes')?.path).toBe('/app/admin/disputes');
    expect(getRouteMeta('/app/admin')?.path).toBe('/app/admin');
  });

  it('every metadata entry carries both English and Arabic copy', () => {
    for (const meta of ROUTE_META) {
      expect(meta.title, `${meta.path} missing title`).toBeTruthy();
      expect(meta.titleAr, `${meta.path} missing titleAr`).toBeTruthy();
    }
  });
});

describe('no dead internal navigation in rendered frontend code', () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '__tests__') {
        continue;
      }
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...sourceFiles(full));
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  // Every `/v1/...` and `/payment/...` string in these files is an API path
  // resolved by the edge function, not a page route, so both are excluded.
  const isApiPath = (raw: string) => raw.startsWith('/v1/') || raw.startsWith('/payment/');

  // `path:` is ambiguous: it is a route key in route tables but an API endpoint
  // inside `requestEdgeJson({ path: '/trips' })`. Only route tables declare a
  // module import or a component, so only those files are scanned for `path:`.
  const isRouteTable = (file: string) =>
    /wasel-routes\.tsx$|navigation|routes?\.tsx?$|router/i.test(file);

  it('every literal in-app link target is a route the router declares', () => {
    const declared = new Set(declaredAppChildPaths());
    const offenders: string[] = [];

    for (const file of sourceFiles(APP_DIR)) {
      const text = readFile(file);
      const patterns = [
        /\bto=\{?["'`](\/[^"'`$]*)["'`]/g,
        /\bhref=\{?["'`](\/[^"'`$]*)["'`]/g,
        /\bnavigate\(\s*["'`](\/[^"'`$]*)["'`]/g,
      ];
      if (isRouteTable(file)) {
        patterns.push(/\bpath:\s*["'](\/[^"'$]*)["']/g);
      }

      for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const raw = match[1] ?? '';
          if (raw.startsWith('//') || isApiPath(raw)) {
            continue;
          }
          const clean = raw.split('?')[0]?.split('#')[0] ?? '';
          const segments = clean.split('/').filter(Boolean);
          if (segments.length === 0) {
            continue;
          }
          if (segments[0] === 'app') {
            segments.shift();
          }
          if (segments.length === 0) {
            continue;
          }
          if (declared.has(segments.join('/'))) {
            continue;
          }
          // Allow a dynamic tail (e.g. /app/admin/users/:id) by accepting any
          // route that is a prefix of the target.
          const isParent = [...declared].some(
            (path) => path && segments.join('/').startsWith(`${path}/`),
          );
          if (isParent) {
            continue;
          }
          offenders.push(`${relative(ROOT, file)} -> ${raw}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
