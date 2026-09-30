// GENERATED FILE — DO NOT EDIT.
// Vendored from supabase/functions/_shared/rbac.ts
// by scripts/prepare-edge-bundles.mjs so that this function is a closed,
// self-contained module graph. Edit the source of truth instead.
/**
 * Wasel RBAC — Deno/Edge Function Entry Point
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
} from '../_vendor/packages/rbac/deno/index.ts';