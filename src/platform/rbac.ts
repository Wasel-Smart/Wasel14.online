/**
 * Wasel RBAC — Re-exports from @wasel/rbac (single source of truth)
 *
 * This file is a compatibility layer that re-exports the canonical RBAC
 * definitions from the shared @wasel/rbac package.
 *
 * The actual implementation lives in packages/rbac/src/index.ts
 * and is shared between frontend (React) and backend (Deno edge functions).
 */

export {
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
} from '@wasel/rbac';