/**
 * Wasel RBAC — Deno/Edge Function Shared Entry Point
 *
 * Re-exports from the canonical @wasel/rbac package (Deno entry point) so the
 * service functions can import RBAC from '../_shared/rbac.ts'.
 *
 * `npm run edge:sync` vendors that module into each function that uses it,
 * because `supabase functions deploy` uploads only the files under
 * supabase/functions/<function>/.
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
} from '../../../packages/rbac/deno/index.ts';
