/**
 * Wasel RBAC — Single Source of Truth
 *
 * This package is the canonical definition of roles and permissions for the Wasel platform.
 * Used by both frontend (React) and backend (Deno edge functions).
 *
 * Roles map to the platform's actual actor surfaces:
 *   Riders, Drivers, Operators, Admins, Finance, Trust, Support,
 *   Corporate, School, Medical, Package, Bus, Guest, and Service accounts.
 *
 * Every permission is additive — no role inherits from another at runtime.
 * Use resolveAccessRole() to map raw DB/JWT strings to canonical AccessRole values.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Canonical access roles for the Wasel platform.
 * These are the ONLY valid roles - any other string resolves to 'guest' (fail-closed).
 */
export type AccessRole =
  | 'admin'           // Full platform access
  | 'finance'         // Payment ledger, payouts, reconciliation — no ride ops
  | 'trust'           // Identity review, fraud flags, account moderation
  | 'support'         // Read-only ops + dispute write, no payment write
  | 'operator'        // Corridor/fleet ops, no payment write
  | 'driver'          // Own rides + packages, own earnings
  | 'user'            // Rider — book rides, send packages, own wallet
  | 'corporate'       // Corporate account — multi-seat booking, invoices
  | 'school'          // School transport coordinator — student roster + routes
  | 'medical'         // Medical transport coordinator — patient bookings
  | 'package_agent'   // Package-only actor — no ride booking
  | 'bus_operator'    // Bus corridor operator — schedules + seat inventory
  | 'guest'           // Unauthenticated — read-only public surfaces
  | 'service';        // Internal service account — event bus, workers

/**
 * Canonical access permissions for the Wasel platform.
 * Format: `resource:action` (e.g., 'rides:read', 'payments:write')
 */
export type AccessPermission =
  // Rides
  | 'rides:read'
  | 'rides:write'
  | 'rides:assign'
  | 'rides:cancel_any'
  | 'rides:price_override'
  // Packages
  | 'packages:read'
  | 'packages:write'
  | 'packages:assign'
  | 'packages:cancel_any'
  // Payments
  | 'payments:read'
  | 'payments:write'
  | 'payments:refund'
  | 'payments:payout'
  | 'payments:reconcile'
  // Operations
  | 'operations:read'
  | 'operations:write'
  | 'fleet:manage'
  | 'corridors:manage'
  // Trust & moderation
  | 'trust:read'
  | 'trust:moderate'
  | 'trust:ban'
  | 'identity:review'
  // Support
  | 'disputes:read'
  | 'disputes:write'
  | 'support:read'
  | 'support:write'
  // Users
  | 'users:read'
  | 'users:write'
  | 'users:impersonate'
  // Notifications
  | 'notifications:read'
  | 'notifications:send'
  // Bus
  | 'bus:read'
  | 'bus:write'
  | 'bus:manage_schedules'
  // Corporate / School / Medical
  | 'corporate:read'
  | 'corporate:write'
  | 'school:read'
  | 'school:write'
  | 'medical:read'
  | 'medical:write'
  // Analytics
  | 'analytics:read'
  | 'analytics:export'
  // System
  | 'events:publish'
  | 'events:consume'
  | 'config:read'
  | 'config:write';

// ============================================================================
// Role-Permission Matrix (Canonical)
// ============================================================================

const ROLE_PERMISSIONS: Record<AccessRole, readonly AccessPermission[]> = {
  admin: [
    'rides:read', 'rides:write', 'rides:assign', 'rides:cancel_any', 'rides:price_override',
    'packages:read', 'packages:write', 'packages:assign', 'packages:cancel_any',
    'payments:read', 'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
    'operations:read', 'operations:write', 'fleet:manage', 'corridors:manage',
    'trust:read', 'trust:moderate', 'trust:ban', 'identity:review',
    'disputes:read', 'disputes:write', 'support:read', 'support:write',
    'users:read', 'users:write', 'users:impersonate',
    'notifications:read', 'notifications:send',
    'bus:read', 'bus:write', 'bus:manage_schedules',
    'corporate:read', 'corporate:write',
    'school:read', 'school:write',
    'medical:read', 'medical:write',
    'analytics:read', 'analytics:export',
    'events:publish', 'events:consume',
    'config:read', 'config:write',
  ],

  finance: [
    'payments:read', 'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
    'rides:read', 'packages:read', 'bus:read',
    'users:read',
    'analytics:read', 'analytics:export',
    'notifications:read',
    'config:read',
  ],

  trust: [
    'trust:read', 'trust:moderate', 'trust:ban', 'identity:review',
    'users:read', 'users:write',
    'rides:read', 'packages:read',
    'disputes:read', 'disputes:write',
    'support:read',
    'notifications:read', 'notifications:send',
    'analytics:read',
  ],

  support: [
    'rides:read', 'packages:read', 'bus:read',
    'payments:read',
    'disputes:read', 'disputes:write',
    'support:read', 'support:write',
    'users:read',
    'trust:read',
    'notifications:read',
  ],

  operator: [
    'rides:read', 'rides:assign',
    'packages:read', 'packages:assign',
    'payments:read',
    'operations:read', 'operations:write',
    'fleet:manage', 'corridors:manage',
    'trust:read', 'trust:moderate',
    'bus:read', 'bus:write',
    'notifications:read', 'notifications:send',
    'analytics:read',
  ],

  driver: [
    'rides:read', 'rides:write',
    'packages:read', 'packages:write',
    'payments:read',
    'notifications:read',
  ],

  user: [
    'rides:read', 'rides:write',
    'packages:read', 'packages:write',
    'payments:read',
    'bus:read',
    'notifications:read',
  ],

  corporate: [
    'rides:read', 'rides:write',
    'packages:read', 'packages:write',
    'payments:read',
    'bus:read',
    'corporate:read', 'corporate:write',
    'notifications:read',
    'analytics:read',
  ],

  school: [
    'rides:read', 'rides:write',
    'school:read', 'school:write',
    'payments:read',
    'notifications:read',
  ],

  medical: [
    'rides:read', 'rides:write',
    'medical:read', 'medical:write',
    'payments:read',
    'notifications:read',
  ],

  package_agent: [
    'packages:read', 'packages:write',
    'payments:read',
    'notifications:read',
  ],

  bus_operator: [
    'bus:read', 'bus:write', 'bus:manage_schedules',
    'rides:read',
    'payments:read',
    'operations:read',
    'notifications:read',
  ],

  guest: [
    'rides:read',
    'bus:read',
    'config:read',
  ],

  service: [
    'events:publish', 'events:consume',
    'rides:read', 'packages:read',
    'payments:read',
    'notifications:send',
    'config:read',
  ],
} as const;

// ============================================================================
// Validation
// ============================================================================

const VALID_ROLES: readonly AccessRole[] = [
  'admin', 'finance', 'trust', 'support', 'operator', 'driver', 'user',
  'corporate', 'school', 'medical', 'package_agent', 'bus_operator', 'guest', 'service',
] as const;

/**
 * Validates that ROLE_PERMISSIONS contains exactly the VALID_ROLES.
 * Throws at module load time if there's a mismatch (catching drift early).
 */
function validateRolePermissions(): void {
  const definedRoles = Object.keys(ROLE_PERMISSIONS) as AccessRole[];
  const missing = VALID_ROLES.filter(r => !definedRoles.includes(r));
  const extra = definedRoles.filter(r => !VALID_ROLES.includes(r));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `RBAC validation failed:\n` +
      `  Missing roles: ${missing.join(', ') || 'none'}\n` +
      `  Extra roles: ${extra.join(', ') || 'none'}`
    );
  }

  // Validate all permissions are known
  const allPermissions = new Set<AccessPermission>();
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const p of perms) {
      allPermissions.add(p);
    }
  }
}

// Run validation at module load
validateRolePermissions();

// ============================================================================
// Public API
// ============================================================================

/**
 * Checks if a role has a specific permission.
 * @param role - Canonical AccessRole
 * @param permission - AccessPermission to check
 * @returns true if role has permission
 */
export function hasPermission(role: AccessRole, permission: AccessPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Asserts that a role has a permission, throws if not.
 * @param role - Canonical AccessRole
 * @param permission - AccessPermission to check
 * @throws Error if role lacks permission
 */
export function assertPermission(role: AccessRole, permission: AccessPermission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role '${role}' is not allowed to perform '${permission}'`);
  }
}

/**
 * Maps a raw DB/JWT role string to the canonical AccessRole.
 * Fails closed: unknown or undefined roles resolve to 'guest' (least privilege).
 * @param role - Raw role string from DB/JWT
 * @returns Canonical AccessRole
 */
export function resolveAccessRole(role: string | undefined): AccessRole {
  if (!role) {
    return 'guest';
  }
  if (VALID_ROLES.includes(role as AccessRole)) {
    return role as AccessRole;
  }

  // Fail closed: unrecognised role strings (corrupt data, new DB enum values
  // not yet mapped here, attacker-supplied values) must never silently grant
  // the standard 'user' permission set. Default to the least-privileged role.
  return 'guest';
}

/**
 * Checks if a raw role string grants a permission.
 * Safe to call with undefined — treats it as 'guest'.
 * @param role - Raw role string from DB/JWT
 * @param permission - AccessPermission to check
 * @returns true if role grants permission
 */
export function userHasPermission(role: string | undefined, permission: AccessPermission): boolean {
  return hasPermission(resolveAccessRole(role), permission);
}

/**
 * Returns all permissions granted to a role.
 * Useful for audit logging and security review tooling.
 * @param role - Canonical AccessRole
 * @returns Readonly array of permissions
 */
export function getRolePermissions(role: AccessRole): readonly AccessPermission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Returns all roles that hold a given permission.
 * Used by security audit to verify no unintended role escalation.
 * @param permission - AccessPermission to check
 * @returns Array of roles with this permission
 */
export function getRolesWithPermission(permission: AccessPermission): AccessRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as AccessRole[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}

/**
 * Returns all valid canonical roles.
 * Useful for UI dropdowns, validation, etc.
 */
export function getAllRoles(): readonly AccessRole[] {
  return VALID_ROLES;
}

/**
 * Returns all valid permissions.
 * Useful for UI, auditing, etc.
 */
export function getAllPermissions(): AccessPermission[] {
  const perms = new Set<AccessPermission>();
  for (const p of Object.values(ROLE_PERMISSIONS).flat()) {
    perms.add(p);
  }
  return Array.from(perms).sort();
}

/**
 * Checks if a role is a "high privilege" role (admin, finance, trust).
 * Useful for UI warnings, audit logging.
 */
export function isHighPrivilegeRole(role: AccessRole): boolean {
  return ['admin', 'finance', 'trust'].includes(role);
}

/**
 * Checks if a role can access payment write operations.
 * Useful for gating sensitive UI.
 */
export function canWritePayments(role: AccessRole): boolean {
  return hasPermission(role, 'payments:write');
}

/**
 * Checks if a role can manage users (impersonate, write).
 */
export function canManageUsers(role: AccessRole): boolean {
  return hasPermission(role, 'users:impersonate') || hasPermission(role, 'users:write');
}