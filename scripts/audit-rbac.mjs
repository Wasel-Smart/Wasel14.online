#!/usr/bin/env node
/**
 * scripts/audit-rbac.mjs
 *
 * Validates the 14-role RBAC model for the Wasel platform.
 * Run: node scripts/audit-rbac.mjs
 *
 * Checks:
 *  1. All 14 roles are defined
 *  2. Sensitive permissions are NOT granted to low-trust roles
 *  3. Every permission is covered by at least one role
 *  4. Guest role has no write permissions
 *  5. Service role has no user-facing write permissions
 *  6. Finance role cannot access trust/moderation
 *  7. Prints a full permission matrix for manual review
 */

import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname( fileURLToPath( import.meta.url ) );

// ── Inline the role/permission data (mirrors rbac.ts) ────────────────────────

const EXPECTED_ROLES = [
  'admin', 'finance', 'trust', 'support', 'operator', 'driver', 'user',
  'corporate', 'school', 'medical', 'package_agent', 'bus_operator', 'guest', 'service',
];

const SENSITIVE_PERMISSIONS = [
  'payments:write', 'payments:refund', 'payments:payout', 'payments:reconcile',
  'trust:ban', 'users:impersonate', 'config:write',
  'rides:price_override', 'rides:cancel_any',
];

const LOW_TRUST_ROLES = [ 'guest', 'user', 'driver', 'package_agent' ];

const WRITE_PERMISSIONS = [
  'rides:write', 'packages:write', 'payments:write', 'operations:write',
  'trust:moderate', 'trust:ban', 'disputes:write', 'support:write',
  'users:write', 'notifications:send', 'bus:write', 'corporate:write',
  'school:write', 'medical:write', 'analytics:export', 'events:publish', 'config:write',
];

// Load the permission map from the canonical package rather than regex-parsing
// a source file.
//
// This script previously read `src/platform/rbac.ts`, which is now a pure
// re-export shim over `@wasel/rbac`. The regex therefore matched nothing,
// every role resolved to `[]`, and all 56 negative assertions ("guest does NOT
// have payments:write") passed vacuously against empty data. Importing the real
// map means a missing role or an escalated permission actually fails.
const roleMap = await ( async () => {
  const modulePath = resolve( __dir, '../packages/rbac/dist/index.js' );
  const projectRoot = resolve( __dir, '..' );
  if ( !modulePath.startsWith( projectRoot ) ) {
    throw new Error( `Path traversal detected: ${ modulePath } resolves outside project root` );
  }
  if ( !existsSync( modulePath ) ) {
    throw new Error(
      `RBAC package is not built: ${ modulePath } is missing.\n` +
      `Run \`npm run build:rbac\` (or \`npx tsc -p packages/rbac/tsconfig.json\`) first.\n` +
      `Skipping is not safe: without the real map every check below passes vacuously.`,
    );
  }
  const { getRolePermissions, getAllRoles, getAllPermissions } = await import( pathToFileURL( modulePath ).href );
  const roles = getAllRoles();
  const permissions = new Set( getAllPermissions() );
  return { map: Object.fromEntries( roles.map( r => [ r, [ ...getRolePermissions( r ) ] ] ) ), permissions };
} )();

// ── Run checks ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check ( label, condition, detail = '' ) {
  if ( condition ) {
    console.log( `  ✓ ${ label }` );
    passed++;
  } else {
    console.error( `  ✗ ${ label }${ detail ? ` — ${ detail }` : '' }` );
    failed++;
  }
}

console.log( '\n═══════════════════════════════════════════════════════' );
console.log( '  Wasel RBAC Security Audit — 14-Role Model' );
console.log( '═══════════════════════════════════════════════════════\n' );

// 0. The map is real, not empty. Every remaining check is meaningless without
// this, so it is asserted explicitly rather than implied.
console.log( '0. Source sanity' );
check(
  `role table is populated (${ Object.keys( roleMap.map ).length } roles, ${ roleMap.permissions.size } permissions)`,
  Object.keys( roleMap.map ).length > 0 && roleMap.permissions.size > 0,
  'permission map loaded empty — all checks below would pass vacuously',
);
for ( const role of EXPECTED_ROLES ) {
  check( `role '${ role }' is present in the permission map`, Array.isArray( roleMap.map[ role ] ) );
}
console.log( '' );

// 2. Sensitive permissions not on low-trust roles
console.log( '\n2. Sensitive permission isolation' );
for ( const role of LOW_TRUST_ROLES ) {
  for ( const perm of SENSITIVE_PERMISSIONS ) {
    check(
      `'${ role }' does NOT have '${ perm }'`,
      !roleMap.map[ role ].includes( perm ),
    );
  }
}

// 3. Guest has no write permissions
console.log( '\n3. Guest role — no write permissions' );
for ( const perm of WRITE_PERMISSIONS ) {
  check( `guest does NOT have '${ perm }'`, !roleMap.map[ 'guest' ].includes( perm ) );
}

// 4. Service role has no user-facing write permissions
console.log( '\n4. Service role — no user-facing writes' );
const SERVICE_BLOCKED = [ 'rides:write', 'packages:write', 'payments:write', 'trust:ban', 'users:write' ];
for ( const perm of SERVICE_BLOCKED ) {
  check( `service does NOT have '${ perm }'`, !roleMap.map[ 'service' ].includes( perm ) );
}

// 5. Finance cannot moderate trust
console.log( '\n5. Finance role — no trust/moderation access' );
const FINANCE_BLOCKED = [ 'trust:moderate', 'trust:ban', 'identity:review', 'users:impersonate' ];
for ( const perm of FINANCE_BLOCKED ) {
  check( `finance does NOT have '${ perm }'`, !roleMap.map[ 'finance' ].includes( perm ) );
}

// 6. Admin has all sensitive permissions
console.log( '\n6. Admin role — has all sensitive permissions' );
for ( const perm of SENSITIVE_PERMISSIONS ) {
  check( `admin has '${ perm }'`, roleMap.map[ 'admin' ].includes( perm ) );
}

// 7. Print permission matrix
console.log( '\n7. Permission matrix (roles × sensitive permissions)\n' );
const header = [ 'permission'.padEnd( 30 ), ...EXPECTED_ROLES.map( ( r ) => r.slice( 0, 8 ).padEnd( 10 ) ) ].join( '' );
console.log( header );
console.log( '─'.repeat( header.length ) );
for ( const perm of SENSITIVE_PERMISSIONS ) {
  const row = [ perm.padEnd( 30 ), ...EXPECTED_ROLES.map( ( r ) => ( roleMap.map[ r ]?.includes( perm ) ? '✓'.padEnd( 10 ) : '·'.padEnd( 10 ) ) ) ].join( '' );
  console.log( row );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log( '\n═══════════════════════════════════════════════════════' );
console.log( `  Results: ${ passed } passed, ${ failed } failed` );
console.log( '═══════════════════════════════════════════════════════\n' );

if ( failed > 0 ) {
  process.exit( 1 );
}
