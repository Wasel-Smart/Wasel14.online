import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { userHasPermission, type AccessRole } from '@/platform/rbac';

/**
 * The admin console spans three files that cannot be imported together (the
 * edge function is Deno-only, the React pages need a DOM), so this suite
 * asserts the contract statically: the client paths, the router patterns, and
 * the permissions each handler demands must all line up, or the console
 * silently 403s or 404s in production.
 */
const ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const EDGE_INDEX = readSource(
  'supabase/functions/make-server-0b1f4071/index.ts',
);
const EDGE_ADMIN = readSource(
  'supabase/functions/make-server-0b1f4071/_handlers/admin.ts',
);
const APP_ROUTES = readSource('src/wasel-routes.tsx');
const ADMIN_API = readSource('src/services/adminApi.ts');
const USERS_PAGE = readSource('src/features/admin/AdminUsersPage.tsx');
const DISPUTES_PAGE = readSource('src/features/admin/AdminDisputesPage.tsx');

/** Roles the canonical RBAC matrix considers legitimate console operators. */
const CONSOLE_ROLES: AccessRole[] = ['admin', 'finance', 'trust', 'support'];

describe('admin console — edge router', () => {
  const requiredRoutes = [
    { id: 'admin-users', path: "path === '/admin/users'" },
    { id: 'admin-user-status', path: '/^\\/admin\\/users\\/[^/]+\\/status$/' },
    { id: 'admin-disputes', path: "path === '/admin/disputes'" },
    { id: 'admin-dispute-resolve', path: '/^\\/admin\\/disputes\\/[^/]+\\/resolve$/' },
    { id: 'admin-dashboard-metrics', path: "path === '/admin/dashboard/metrics'" },
  ];

  for (const route of requiredRoutes) {
    it(`registers the ${route.id} route`, () => {
      expect(EDGE_INDEX).toContain(`id: '${route.id}'`);
      expect(EDGE_INDEX).toContain(route.path);
    });
  }

  it('routes the list endpoints as GET and the mutation endpoints as PATCH', () => {
    expect(EDGE_INDEX).toMatch(/id: 'admin-users',\s*methods: \[ 'GET' \]/);
    expect(EDGE_INDEX).toMatch(/id: 'admin-dispute-resolve',\s*methods: \[ 'PATCH' \]/);
  });

  it('exports every admin handler the router dispatches to', () => {
    // Before this was fixed the handlers were module-private, so index.ts
    // referenced identifiers that did not exist and the whole edge function
    // failed to build.
    for (const name of [
      'handleAdminListUsers',
      'handleAdminSetUserStatus',
      'handleAdminListDisputes',
      'handleAdminResolveDispute',
      'handleAdminDashboardMetrics',
    ]) {
      expect(EDGE_ADMIN).toMatch(new RegExp(`export async function ${name}\\b`));
      expect(EDGE_INDEX).toContain(name);
    }
  });
});

describe('admin console — handler permissions', () => {
  const expectations: Array<{ handler: string; permission: string }> = [
    { handler: 'handleAdminListUsers', permission: 'users:read' },
    { handler: 'handleAdminSetUserStatus', permission: 'users:write' },
    { handler: 'handleAdminListDisputes', permission: 'disputes:read' },
    { handler: 'handleAdminResolveDispute', permission: 'disputes:write' },
  ];

  for (const { handler, permission } of expectations) {
    it(`${handler} asserts ${permission}`, () => {
      const body = EDGE_ADMIN.slice(EDGE_ADMIN.indexOf(`export async function ${handler}`));
      expect(body.slice(0, 400)).toContain(`authorize ( request, '${permission}' )`);
    });
  }

  it('never lets a handler skip authorisation', () => {
    for (const { handler } of expectations) {
      const start = EDGE_ADMIN.indexOf(`export async function ${handler}`);
      const body = EDGE_ADMIN.slice(start, start + 400);
      expect(body).toContain('authorize ( request,');
      expect(body).toContain("if ( 'error' in auth ) return auth.error;");
    }
  });
});

describe('admin console — client and server agree on the paths', () => {
  it('adminApi targets paths the edge router actually serves', () => {
    expect(ADMIN_API).toContain('/v1/admin/users?page=');
    expect(ADMIN_API).toContain('/v1/admin/users/${userId}/status');
    expect(ADMIN_API).toContain('/v1/admin/disputes?page=');
    expect(ADMIN_API).toContain('/v1/admin/disputes/${disputeId}/resolve');
    expect(ADMIN_API).toContain('/v1/admin/dashboard/metrics?range=');
  });

  it('every adminApi call targets a path registered in the router', () => {
    // Explicit pairs rather than derived regexes: the point of this test is to
    // catch drift between the two files, and a hand-written mapping states
    // the expectation far more readably than a generated pattern.
    const pairs: Array<[string, string]> = [
      ['/v1/admin/users?page=', "path === '/admin/users'"],
      ['/v1/admin/users/${userId}/status', '/^\\/admin\\/users\\/[^/]+\\/status$/'],
      ['/v1/admin/disputes?page=', "path === '/admin/disputes'"],
      ['/v1/admin/disputes/${disputeId}/resolve', '/^\\/admin\\/disputes\\/[^/]+\\/resolve$/'],
      ['/v1/admin/dashboard/metrics?range=', "path === '/admin/dashboard/metrics'"],
    ];

    for (const [clientPath, routerPattern] of pairs) {
      expect(ADMIN_API).toContain(clientPath);
      expect(EDGE_INDEX).toContain(routerPattern);
    }
  });
});

describe('admin console — React route guards', () => {
  it('gates /app/admin/users on users:read', () => {
    const index = APP_ROUTES.indexOf("path: 'admin/users'");
    expect(index).toBeGreaterThan(-1);
    const window = APP_ROUTES.slice(Math.max(0, index - 300), index);
    expect(window).toContain("require: 'users:read'");
  });

  it('gates /app/admin/disputes on disputes:read', () => {
    const index = APP_ROUTES.indexOf("path: 'admin/disputes'");
    expect(index).toBeGreaterThan(-1);
    const window = APP_ROUTES.slice(Math.max(0, index - 300), index);
    expect(window).toContain("require: 'disputes:read'");
  });

  it('no longer links to an unregistered /app/admin/disputes route', () => {
    expect(APP_ROUTES).toContain("path: 'admin/disputes'");
  });
});

describe('admin console — UI permission gating', () => {
  it('gates the users page on users:read and its write action on users:write', () => {
    expect(USERS_PAGE).toContain("userHasPermission(user?.role, 'users:read')");
    expect(USERS_PAGE).toContain("userHasPermission(user?.role, 'users:write')");
  });

  it('gates the disputes page on disputes:read and its write action on disputes:write', () => {
    expect(DISPUTES_PAGE).toContain("userHasPermission(user?.role, 'disputes:read')");
    expect(DISPUTES_PAGE).toContain("userHasPermission(user?.role, 'disputes:write')");
  });

  it('only offers the status toggle to roles that hold users:write', () => {
    for (const role of CONSOLE_ROLES) {
      const canWrite = userHasPermission(role, 'users:write');
      // finance and support can read the roster but must not flip accounts.
      expect(canWrite).toBe(role === 'admin' || role === 'trust');
    }
  });

  it('only offers the resolve action to roles that hold disputes:write', () => {
    for (const role of CONSOLE_ROLES) {
      expect(userHasPermission(role, 'disputes:write')).toBe(
        role === 'admin' || role === 'trust' || role === 'support',
      );
    }
  });

  it('keeps the write surface away from every non-privileged role', () => {
    for (const role of ['user', 'driver', 'guest', 'package_agent', 'operator'] as AccessRole[]) {
      expect(userHasPermission(role, 'users:write')).toBe(false);
      expect(userHasPermission(role, 'disputes:write')).toBe(false);
      expect(userHasPermission(role, 'users:read')).toBe(false);
      expect(userHasPermission(role, 'disputes:read')).toBe(false);
    }
  });
});

describe('admin console — status mapping', () => {
  it('maps the UI "inactive" onto the profile_status_v2 "suspended" member', () => {
    // profile_status_v2 is (pending | active | suspended | blocked); there is
    // no "inactive", so the handler must translate or the update 400s on the
    // enum check constraint.
    expect(EDGE_ADMIN).toContain("requested === 'inactive'");
    expect(EDGE_ADMIN).toContain("profileStatus = 'suspended'");
  });

  it('rejects any status outside active/inactive', () => {
    expect(EDGE_ADMIN).toContain('status must be "active" or "inactive"');
  });

  it('refuses to re-resolve an already terminal dispute', () => {
    expect(EDGE_ADMIN).toContain('TERMINAL_DISPUTE_STATUSES');
    expect(EDGE_ADMIN).toContain('Dispute is already');
  });

  it('clamps the requested page size instead of trusting the query string', () => {
    expect(EDGE_ADMIN).toContain('MAX_PAGE_SIZE = 100');
    expect(EDGE_ADMIN).toContain('Math.min ( rawLimit, MAX_PAGE_SIZE )');
  });
});
