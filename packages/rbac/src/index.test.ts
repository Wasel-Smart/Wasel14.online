import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  assertPermission,
  resolveAccessRole,
  userHasPermission,
  getRolePermissions,
  getRolesWithPermission,
  getAllRoles,
  getAllPermissions,
  isHighPrivilegeRole,
  canWritePayments,
  canManageUsers,
  type AccessRole,
  type AccessPermission,
} from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_ROLES: AccessRole[] = [
  'admin', 'finance', 'trust', 'support', 'operator', 'driver', 'user',
  'corporate', 'school', 'medical', 'package_agent', 'bus_operator', 'guest', 'service',
];

const SENSITIVE: AccessPermission[] = [
  'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
  'trust:ban', 'users:impersonate', 'config:write',
  'rides:price_override', 'rides:cancel_any',
];

const LOW_TRUST: AccessRole[] = ['guest', 'user', 'driver', 'package_agent'];

// ── Role coverage ─────────────────────────────────────────────────────────────

describe('RBAC — role coverage', () => {
  it('defines exactly 14 roles', () => {
    expect(ALL_ROLES).toHaveLength(14);
    expect(getAllRoles()).toHaveLength(14);
  });

  it.each(ALL_ROLES)('role %s has at least one permission', (role) => {
    expect(getRolePermissions(role).length).toBeGreaterThan(0);
  });

  it('getAllPermissions returns all unique permissions', () => {
    const perms = getAllPermissions();
    expect(perms.length).toBeGreaterThan(50);
    // No duplicates
    expect(new Set(perms).size).toBe(perms.length);
  });
});

// ── Admin completeness ────────────────────────────────────────────────────────

describe('RBAC — admin role', () => {
  it.each(SENSITIVE)('admin has sensitive permission %s', (perm) => {
    expect(hasPermission('admin', perm)).toBe(true);
  });

  it('admin has all payment permissions', () => {
    const paymentPerms: AccessPermission[] = [
      'payments:read', 'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
    ];
    for (const p of paymentPerms) {
      expect(hasPermission('admin', p)).toBe(true);
    }
  });

  it('isHighPrivilegeRole returns true for admin', () => {
    expect(isHighPrivilegeRole('admin')).toBe(true);
  });

  it('canWritePayments returns true for admin', () => {
    expect(canWritePayments('admin')).toBe(true);
  });

  it('canManageUsers returns true for admin', () => {
    expect(canManageUsers('admin')).toBe(true);
  });
});

// ── Sensitive permission isolation ────────────────────────────────────────────

describe('RBAC — sensitive permission isolation', () => {
  it.each(LOW_TRUST)('low-trust role %s has no payment:write', (role) => {
    expect(hasPermission(role, 'payments:write')).toBe(false);
  });

  it.each(LOW_TRUST)('low-trust role %s has no trust:ban', (role) => {
    expect(hasPermission(role, 'trust:ban')).toBe(false);
  });

  it.each(LOW_TRUST)('low-trust role %s has no users:impersonate', (role) => {
    expect(hasPermission(role, 'users:impersonate')).toBe(false);
  });

  it.each(LOW_TRUST)('low-trust role %s has no config:write', (role) => {
    expect(hasPermission(role, 'config:write')).toBe(false);
  });

  it.each(LOW_TRUST)('low-trust role %s has no rides:price_override', (role) => {
    expect(hasPermission(role, 'rides:price_override')).toBe(false);
  });

  it('isHighPrivilegeRole returns false for low-trust roles', () => {
    for (const role of LOW_TRUST) {
      expect(isHighPrivilegeRole(role)).toBe(false);
    }
  });

  it('canWritePayments returns false for low-trust roles', () => {
    for (const role of LOW_TRUST) {
      expect(canWritePayments(role)).toBe(false);
    }
  });

  it('canManageUsers returns false for low-trust roles', () => {
    for (const role of LOW_TRUST) {
      expect(canManageUsers(role)).toBe(false);
    }
  });
});

// ── Guest role ────────────────────────────────────────────────────────────────

describe('RBAC — guest role', () => {
  const WRITE_PERMS: AccessPermission[] = [
    'rides:write', 'packages:write', 'payments:write', 'operations:write',
    'trust:moderate', 'trust:ban', 'disputes:write', 'support:write',
    'users:write', 'notifications:send', 'bus:write', 'config:write',
  ];

  it.each(WRITE_PERMS)('guest does NOT have write permission %s', (perm) => {
    expect(hasPermission('guest', perm)).toBe(false);
  });

  it('guest can read rides', () => {
    expect(hasPermission('guest', 'rides:read')).toBe(true);
  });

  it('guest can read bus', () => {
    expect(hasPermission('guest', 'bus:read')).toBe(true);
  });

  it('guest can read config', () => {
    expect(hasPermission('guest', 'config:read')).toBe(true);
  });
});

// ── Service role ──────────────────────────────────────────────────────────────

describe('RBAC — service role', () => {
  const BLOCKED: AccessPermission[] = [
    'rides:write', 'packages:write', 'payments:write', 'trust:ban', 'users:write',
    'users:impersonate', 'config:write',
  ];

  it.each(BLOCKED)('service does NOT have user-facing write %s', (perm) => {
    expect(hasPermission('service', perm)).toBe(false);
  });

  it('service can publish events', () => {
    expect(hasPermission('service', 'events:publish')).toBe(true);
  });

  it('service can consume events', () => {
    expect(hasPermission('service', 'events:consume')).toBe(true);
  });

  it('service can read rides and packages', () => {
    expect(hasPermission('service', 'rides:read')).toBe(true);
    expect(hasPermission('service', 'packages:read')).toBe(true);
  });

  it('service can send notifications', () => {
    expect(hasPermission('service', 'notifications:send')).toBe(true);
  });
});

// ── Finance role ──────────────────────────────────────────────────────────────

describe('RBAC — finance role', () => {
  const BLOCKED: AccessPermission[] = [
    'trust:moderate', 'trust:ban', 'identity:review', 'users:impersonate',
    'rides:write', 'packages:write', 'operations:write',
  ];

  it.each(BLOCKED)('finance does NOT have %s', (perm) => {
    expect(hasPermission('finance', perm)).toBe(false);
  });

  it('finance can reconcile payments', () => {
    expect(hasPermission('finance', 'payments:reconcile')).toBe(true);
  });

  it('finance can export analytics', () => {
    expect(hasPermission('finance', 'analytics:export')).toBe(true);
  });

  it('isHighPrivilegeRole returns true for finance', () => {
    expect(isHighPrivilegeRole('finance')).toBe(true);
  });

  it('canWritePayments returns true for finance', () => {
    expect(canWritePayments('finance')).toBe(true);
  });
});

// ── Trust role ────────────────────────────────────────────────────────────────

describe('RBAC — trust role', () => {
  it('trust can ban users', () => {
    expect(hasPermission('trust', 'trust:ban')).toBe(true);
  });

  it('trust can review identity', () => {
    expect(hasPermission('trust', 'identity:review')).toBe(true);
  });

  it('trust cannot write payments', () => {
    expect(hasPermission('trust', 'payments:write')).toBe(false);
  });

  it('trust cannot impersonate users', () => {
    expect(hasPermission('trust', 'users:impersonate')).toBe(false);
  });

  it('isHighPrivilegeRole returns true for trust', () => {
    expect(isHighPrivilegeRole('trust')).toBe(true);
  });
});

// ── Operator role ─────────────────────────────────────────────────────────────

describe('RBAC — operator role', () => {
  it('operator can manage fleet', () => {
    expect(hasPermission('operator', 'fleet:manage')).toBe(true);
  });

  it('operator can manage corridors', () => {
    expect(hasPermission('operator', 'corridors:manage')).toBe(true);
  });

  it('operator cannot write payments', () => {
    expect(hasPermission('operator', 'payments:write')).toBe(false);
  });

  it('operator cannot ban users', () => {
    expect(hasPermission('operator', 'trust:ban')).toBe(false);
  });

  it('isHighPrivilegeRole returns false for operator', () => {
    expect(isHighPrivilegeRole('operator')).toBe(false);
  });
});

// ── Specialised roles ─────────────────────────────────────────────────────────

describe('RBAC — specialised roles', () => {
  it('school role has school:write', () => {
    expect(hasPermission('school', 'school:write')).toBe(true);
  });

  it('school role cannot access medical', () => {
    expect(hasPermission('school', 'medical:write')).toBe(false);
  });

  it('medical role has medical:write', () => {
    expect(hasPermission('medical', 'medical:write')).toBe(true);
  });

  it('medical role cannot access school', () => {
    expect(hasPermission('medical', 'school:write')).toBe(false);
  });

  it('package_agent cannot book rides', () => {
    expect(hasPermission('package_agent', 'rides:write')).toBe(false);
  });

  it('bus_operator can manage schedules', () => {
    expect(hasPermission('bus_operator', 'bus:manage_schedules')).toBe(true);
  });

  it('bus_operator cannot write payments', () => {
    expect(hasPermission('bus_operator', 'payments:write')).toBe(false);
  });

  it('corporate has corporate:write', () => {
    expect(hasPermission('corporate', 'corporate:write')).toBe(true);
  });

  it('corporate can read analytics', () => {
    expect(hasPermission('corporate', 'analytics:read')).toBe(true);
  });
});

// ── assertPermission ──────────────────────────────────────────────────────────

describe('RBAC — assertPermission', () => {
  it('does not throw when permission is granted', () => {
    expect(() => assertPermission('admin', 'payments:write')).not.toThrow();
  });

  it('throws when permission is denied', () => {
    expect(() => assertPermission('guest', 'payments:write')).toThrow(
      "Role 'guest' is not allowed to perform 'payments:write'",
    );
  });

  it('throws with correct message format', () => {
    expect(() => assertPermission('driver', 'trust:ban')).toThrow(/Role 'driver'/);
  });
});

// ── resolveAccessRole ─────────────────────────────────────────────────────────

describe('RBAC — resolveAccessRole', () => {
  it('returns guest for undefined', () => {
    expect(resolveAccessRole(undefined)).toBe('guest');
  });

  it('returns guest for empty string', () => {
    expect(resolveAccessRole('')).toBe('guest');
  });

  it('returns guest for unknown role string (fail-closed)', () => {
    expect(resolveAccessRole('superuser')).toBe('guest');
    expect(resolveAccessRole('moderator')).toBe('guest');
    expect(resolveAccessRole('hacker')).toBe('guest');
  });

  it.each(ALL_ROLES)('passes through valid role %s unchanged', (role) => {
    expect(resolveAccessRole(role)).toBe(role);
  });

  it('is case-sensitive (fail-closed)', () => {
    expect(resolveAccessRole('Admin')).toBe('guest');
    expect(resolveAccessRole('ADMIN')).toBe('guest');
    expect(resolveAccessRole('User')).toBe('guest');
  });
});

// ── userHasPermission ─────────────────────────────────────────────────────────

describe('RBAC — userHasPermission', () => {
  it('returns false for undefined role on sensitive permission', () => {
    expect(userHasPermission(undefined, 'payments:write')).toBe(false);
  });

  it('returns true for admin on any permission', () => {
    expect(userHasPermission('admin', 'users:impersonate')).toBe(true);
  });

  it('returns false for unknown role on sensitive permission', () => {
    expect(userHasPermission('hacker', 'payments:write')).toBe(false);
  });

  it('returns true for user on rides:read', () => {
    expect(userHasPermission('user', 'rides:read')).toBe(true);
  });

  it('handles raw DB role strings correctly', () => {
    // Simulating raw DB values
    expect(userHasPermission('driver', 'rides:write')).toBe(true);
    expect(userHasPermission('driver', 'payments:write')).toBe(false);
  });
});

// ── getRolesWithPermission ────────────────────────────────────────────────────

describe('RBAC — getRolesWithPermission', () => {
  it('only admin has users:impersonate', () => {
    expect(getRolesWithPermission('users:impersonate')).toEqual(['admin']);
  });

  it('only admin has config:write', () => {
    expect(getRolesWithPermission('config:write')).toEqual(['admin']);
  });

  it('only admin has rides:price_override', () => {
    expect(getRolesWithPermission('rides:price_override')).toEqual(['admin']);
  });

  it('multiple roles have rides:read', () => {
    const roles = getRolesWithPermission('rides:read');
    expect(roles.length).toBeGreaterThan(5);
    expect(roles).toContain('admin');
    expect(roles).toContain('driver');
    expect(roles).toContain('user');
    expect(roles).not.toContain('package_agent');
  });

  it('finance and admin have payments:reconcile', () => {
    const roles = getRolesWithPermission('payments:reconcile');
    expect(roles).toContain('admin');
    expect(roles).toContain('finance');
    expect(roles).not.toContain('driver');
    expect(roles).not.toContain('user');
  });

  it('trust and admin have trust:ban', () => {
    const roles = getRolesWithPermission('trust:ban');
    expect(roles).toContain('admin');
    expect(roles).toContain('trust');
    expect(roles).not.toContain('support');
  });
});

// ── Cross-role privilege escalation guard ─────────────────────────────────────

describe('RBAC — no privilege escalation', () => {
  it('no low-trust role has any sensitive permission', () => {
    for (const role of LOW_TRUST) {
      for (const perm of SENSITIVE) {
        expect(
          hasPermission(role, perm),
          `${role} should NOT have ${perm}`,
        ).toBe(false);
      }
    }
  });

  it('support role cannot escalate to payment writes', () => {
    const paymentWrites: AccessPermission[] = [
      'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
    ];
    for (const p of paymentWrites) {
      expect(hasPermission('support', p)).toBe(false);
    }
  });

  it('driver cannot access operations or trust', () => {
    const blocked: AccessPermission[] = [
      'operations:read', 'operations:write', 'fleet:manage',
      'trust:moderate', 'trust:ban', 'identity:review',
    ];
    for (const p of blocked) {
      expect(hasPermission('driver', p)).toBe(false);
    }
  });

  it('finance cannot access trust moderation', () => {
    expect(hasPermission('finance', 'trust:moderate')).toBe(false);
    expect(hasPermission('finance', 'trust:ban')).toBe(false);
    expect(hasPermission('finance', 'identity:review')).toBe(false);
  });

  it('operator cannot access payments write', () => {
    expect(hasPermission('operator', 'payments:write')).toBe(false);
    expect(hasPermission('operator', 'payments:refund')).toBe(false);
  });
});

// ── Deno compatibility check ──────────────────────────────────────────────────

describe('RBAC — Deno compatibility', () => {
  it('VALID_ROLES_DENO matches VALID_ROLES', async () => {
    const { VALID_ROLES_DENO } = await import('../deno/index.ts');
    expect(VALID_ROLES_DENO).toEqual(getAllRoles());
  });

  it('ROLE_PERMISSIONS_DENO matches ROLE_PERMISSIONS', async () => {
    const { ROLE_PERMISSIONS_DENO } = await import('../deno/index.ts');
    const roles = getAllRoles();
    for (const role of roles) {
      expect(ROLE_PERMISSIONS_DENO[role]).toEqual(getRolePermissions(role));
    }
  });
});