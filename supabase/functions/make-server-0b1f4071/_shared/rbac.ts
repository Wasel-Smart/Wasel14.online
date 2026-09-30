/**
 * Wasel RBAC — Deno/Edge Function Entry Point (make-server)
 *
 * Re-exports from the canonical @wasel/rbac package (Deno entry point).
 * The implementation lives in packages/rbac/src/index.ts and is shared between
 * frontend (React) and backend (Deno edge functions); packages/rbac/deno
 * adds the Deno-visible role/permission matrix on top of it.
 *
 * `npm run edge:sync` vendors that module into this function directory and
 * rewrites the specifier below, because `supabase functions deploy` uploads
 * only the files under supabase/functions/make-server-0b1f4071/.
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
  ROLE_PERMISSIONS_DENO as ROLE_PERMISSIONS,
  VALID_ROLES_DENO as VALID_ROLES,
  type AccessRole,
  type AccessPermission,
} from '../_vendor/packages/rbac/deno/index.ts';
