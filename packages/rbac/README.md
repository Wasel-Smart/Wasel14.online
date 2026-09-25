# @wasel/rbac

Canonical RBAC definitions for the Wasel platform. Single source of truth for roles and permissions used by both frontend (React) and backend (Deno edge functions).

## Installation

```bash
# From workspace root
npm install @wasel/rbac
```

## Usage

### Frontend (React/TypeScript)

```typescript
import {
  hasPermission,
  resolveAccessRole,
  userHasPermission,
  getRolePermissions,
  getRolesWithPermission,
  type AccessRole,
  type AccessPermission,
} from '@wasel/rbac';

// Check permissions
if (hasPermission(userRole, 'rides:write')) {
  // Allow creating trips
}

// Resolve raw DB/JWT role (fail-closed)
const canonicalRole = resolveAccessRole(rawRoleFromDB);

// Safe check with raw role
if (userHasPermission(rawRoleFromDB, 'payments:write')) {
  // Allow payment operations
}
```

### Backend (Deno Edge Functions)

```typescript
import {
  hasPermission,
  resolveAccessRole,
  userHasPermission,
  ROLE_PERMISSIONS_DENO,
  VALID_ROLES_DENO,
} from 'jsr:@wasel/rbac'; // or npm:@wasel/rbac/deno

// Same API available
const role = resolveAccessRole(user.role);
if (hasPermission(role, 'rides:assign')) {
  // Allow driver assignment
}
```

## API Reference

### Types

- `AccessRole` - 14 canonical roles: `admin`, `finance`, `trust`, `support`, `operator`, `driver`, `user`, `corporate`, `school`, `medical`, `package_agent`, `bus_operator`, `guest`, `service`
- `AccessPermission` - 60+ permissions in `resource:action` format

### Functions

| Function | Description |
|----------|-------------|
| `hasPermission(role, permission)` | Check if role has permission |
| `assertPermission(role, permission)` | Throw if role lacks permission |
| `resolveAccessRole(rawRole)` | Map raw string to canonical role (fail-closed) |
| `userHasPermission(rawRole, permission)` | Safe check with raw role |
| `getRolePermissions(role)` | Get all permissions for role |
| `getRolesWithPermission(permission)` | Get all roles with permission |
| `getAllRoles()` | Get all valid roles |
| `getAllPermissions()` | Get all valid permissions |
| `isHighPrivilegeRole(role)` | Check if role is admin/finance/trust |
| `canWritePayments(role)` | Check if role can write payments |
| `canManageUsers(role)` | Check if role can manage users |

## Role-Permission Matrix

| Permission | admin | finance | trust | support | operator | driver | user | corporate | school | medical | package_agent | bus_operator | guest | service |
|------------|-------|---------|-------|---------|----------|--------|------|-----------|--------|---------|---------------|--------------|-------|---------|
| rides:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ |
| rides:write | ✓ | | | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| rides:assign | ✓ | | | | ✓ | | | | | | | | | |
| payments:read | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| payments:write | ✓ | ✓ | | | | | | | | | | | | |
| trust:ban | ✓ | | ✓ | | | | | | | | | | | |
| users:impersonate | ✓ | | | | | | | | | | | | | |

## Design Principles

1. **Fail-closed**: Unknown roles → `guest` (least privilege)
2. **Additive permissions**: No role inheritance at runtime
3. **Single source of truth**: One definition shared across frontend/backend
4. **Explicit over implicit**: All permissions listed, no wildcards
5. **Auditable**: `getRolesWithPermission()` enables security reviews

## Validation

The package validates itself at load time:
- All 14 roles defined in `ROLE_PERMISSIONS`
- No missing or extra roles
- All permissions are known types

Run tests: `npm test` (Vitest)

## Updating Roles/Permissions

1. Edit `packages/rbac/src/index.ts`
2. Run `npm run build` in package directory
3. Run tests: `npm test`
4. Update consumers (frontend, edge functions)

## License

MIT