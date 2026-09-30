/**
 * Wasel RBAC — Deno/Edge Function Entry Point (make-server)
 *
 * Re-exports from the canonical @wasel/rbac package (deno entry point).
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
  ROLE_PERMISSIONS_DENO as ROLE_PERMISSIONS,
  VALID_ROLES_DENO as VALID_ROLES,
  type AccessRole,
  type AccessPermission,
} from '../../packages/rbac/deno/index.ts';