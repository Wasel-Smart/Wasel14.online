import {
  json,
  authenticateRequest,
  enforcePermission,
  ensureRuntimeAdminAccess,
  getAdminClient,
} from './shared.ts';
import { hasPermission, resolveAccessRole, type AccessPermission } from '../_shared/rbac.ts';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface Pagination {
  page: number;
  limit: number;
  from: number;
  to: number;
}

/**
 * Clamps caller-supplied pagination so a hostile or fat-fingered query string
 * cannot ask the database for the whole table.
 */
function parsePagination ( url: URL ): Pagination {
  const rawPage = Number.parseInt ( url.searchParams.get ( 'page' ) ?? '1', 10 );
  const rawLimit = Number.parseInt (
    url.searchParams.get ( 'limit' ) ?? String ( DEFAULT_PAGE_SIZE ),
    10,
  );

  const page = Number.isFinite ( rawPage ) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite ( rawLimit ) && rawLimit > 0 ? Math.min ( rawLimit, MAX_PAGE_SIZE ) : DEFAULT_PAGE_SIZE;

  return { page, limit, from: ( page - 1 ) * limit, to: page * limit - 1 };
}

function toCount ( value: number | null | undefined ): number {
  return typeof value === 'number' && Number.isFinite ( value ) ? value : 0;
}

interface AuthorizedContext {
  admin: any;
  canonicalUser: any;
}

/**
 * Resolves the caller once and asserts a single canonical permission.
 * Returns either a ready-to-send error response or the authenticated context.
 */
async function authorize (
  request: Request,
  permission: AccessPermission,
): Promise<{ error: Response } | AuthorizedContext> {
  const auth = await authenticateRequest ( request );
  if ( 'error' in auth ) {return { error: auth.error };}

  const denied = enforcePermission ( auth, permission );
  if ( denied ) {return { error: denied };}

  return { admin: auth.admin, canonicalUser: auth.canonicalUser };
}

async function readJsonBody ( request: Request ): Promise<Record<string, unknown> | Response> {
  try {
    const parsed = await request.json ();
    if ( typeof parsed !== 'object' || parsed === null ) {
      return json ( { error: 'Invalid JSON body' }, 400 );
    }
    return parsed as Record<string, unknown>;
  } catch {
    return json ( { error: 'Invalid JSON body' }, 400 );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Users — users:read / users:write
// ─────────────────────────────────────────────────────────────────────────────

const USER_LIST_COLUMNS =
  'id, full_name, email, phone_number, role, profile_status, verification_level, created_at, updated_at';

export async function handleAdminListUsers ( request: Request ) {
  const auth = await authorize ( request, 'users:read' );
  if ( 'error' in auth ) {return auth.error;}

  const { page, limit, from, to } = parsePagination ( new URL ( request.url ) );

  const { data, error, count } = await auth.admin
    .from ( 'users' )
    .select ( USER_LIST_COLUMNS, { count: 'exact' } )
    .is ( 'deleted_at', null )
    .order ( 'created_at', { ascending: false } )
    .range ( from, to );

  if ( error ) {return json ( { error: error.message }, 500 );}

  return json ( { data: data ?? [], meta: { total: toCount ( count ), page, limit } } );
}

export async function handleAdminSetUserStatus ( request: Request, userId: string ) {
  const auth = await authorize ( request, 'users:write' );
  if ( 'error' in auth ) {return auth.error;}

  if ( !userId ) {return json ( { error: 'userId is required' }, 400 );}

  const body = await readJsonBody ( request );
  if ( body instanceof Response ) {return body;}

  // The UI speaks in active/inactive, but the canonical column is the
  // profile_status_v2 enum (pending | active | suspended | blocked). There is
  // no 'inactive' member, so deactivation maps onto 'suspended' — which is
  // also what the rest of the product means by a de-activated account.
  const requested = String ( body.status ?? '' ).trim ().toLowerCase ();
  let profileStatus: 'active' | 'suspended';

  if ( requested === 'active' ) {
    profileStatus = 'active';
  } else if ( requested === 'inactive' ) {
    profileStatus = 'suspended';
  } else {
    return json ( { error: 'status must be "active" or "inactive"' }, 400 );
  }

  const { data, error } = await auth.admin
    .from ( 'users' )
    .update ( { profile_status: profileStatus, updated_at: new Date().toISOString () } )
    .eq ( 'id', userId )
    .is ( 'deleted_at', null )
    .select ( USER_LIST_COLUMNS )
    .maybeSingle ();

  if ( error ) {return json ( { error: error.message }, 500 );}
  if ( !data ) {return json ( { error: 'User not found' }, 404 );}

  return json ( { data } );
}

// ─────────────────────────────────────────────────────────────────────────────
// Disputes — disputes:read / disputes:write
// ─────────────────────────────────────────────────────────────────────────────

const DISPUTE_LIST_COLUMNS =
  'id, type, description, status, resolution, complainant_id, respondent_id, created_at, resolved_at, updated_at';

const TERMINAL_DISPUTE_STATUSES = [ 'resolved', 'closed' ] as const;

export async function handleAdminListDisputes ( request: Request ) {
  const auth = await authorize ( request, 'disputes:read' );
  if ( 'error' in auth ) {return auth.error;}

  const { page, limit, from, to } = parsePagination ( new URL ( request.url ) );

  const { data, error, count } = await auth.admin
    .from ( 'disputes' )
    .select ( DISPUTE_LIST_COLUMNS, { count: 'exact' } )
    .order ( 'created_at', { ascending: false } )
    .range ( from, to );

  if ( error ) {return json ( { error: error.message }, 500 );}

  return json ( { data: data ?? [], meta: { total: toCount ( count ), page, limit } } );
}

export async function handleAdminResolveDispute ( request: Request, disputeId: string ) {
  const auth = await authorize ( request, 'disputes:write' );
  if ( 'error' in auth ) {return auth.error;}

  if ( !disputeId ) {return json ( { error: 'disputeId is required' }, 400 );}

  const body = await readJsonBody ( request );
  if ( body instanceof Response ) {return body;}

  const resolution = typeof body.resolution === 'string' ? body.resolution.trim () : '';
  if ( !resolution ) {return json ( { error: 'resolution is required' }, 400 );}
  if ( resolution.length > 2000 ) {return json ( { error: 'resolution is too long' }, 400 );}

  // The disputes.status CHECK constraint allows exactly these four values.
  const action = String ( body.action ?? 'resolved' ).trim ().toLowerCase ();
  if ( action !== 'investigating' && action !== 'resolved' && action !== 'closed' ) {
    return json ( { error: 'action must be "investigating", "resolved", or "closed"' }, 400 );
  }

  const { data: existing, error: readError } = await auth.admin
    .from ( 'disputes' )
    .select ( 'id, status' )
    .eq ( 'id', disputeId )
    .maybeSingle ();

  if ( readError ) {return json ( { error: readError.message }, 500 );}
  if ( !existing ) {return json ( { error: 'Dispute not found' }, 404 );}

  if (
    TERMINAL_DISPUTE_STATUSES.includes (
      existing.status as ( typeof TERMINAL_DISPUTE_STATUSES )[number],
    )
  ) {
    return json ( { error: `Dispute is already ${ existing.status }` }, 409 );
  }

  const now = new Date ().toISOString ();
  const patch: Record<string, unknown> = { status: action, resolution, updated_at: now };

  if ( action !== 'investigating' ) {
    patch.resolved_at = now;
    patch.resolved_by = auth.canonicalUser.id;
  }

  const { data, error } = await auth.admin
    .from ( 'disputes' )
    .update ( patch )
    .eq ( 'id', disputeId )
    .select ( DISPUTE_LIST_COLUMNS )
    .single ();

  if ( error ) {return json ( { error: error.message }, 500 );}

  return json ( { data } );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard metrics
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_DAYS: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30 };

/**
 * Operational metrics for the admin dashboard.
 *
 * Revenue is a flow and is scoped to the requested `range` window. The other
 * four are state snapshots ("how many are active right now"), so they are
 * deliberately NOT range-scoped — scoping them would turn a live gauge into a
 * mislabelled historical count.
 */
export async function handleAdminDashboardMetrics ( request: Request ) {
  const auth = await authorize ( request, 'analytics:read' );
  if ( 'error' in auth ) {return auth.error;}

  const url = new URL ( request.url );
  const requestedRange = String ( url.searchParams.get ( 'range' ) ?? '1d' ).trim ().toLowerCase ();
  const days = RANGE_DAYS[requestedRange] ?? RANGE_DAYS['1d'];
  const since = new Date ( Date.now () - days * 24 * 60 * 60 * 1000 ).toISOString ();

  const [ trips, packages, disputes, users, revenue ] = await Promise.all ( [
    auth.admin
      .from ( 'trips' )
      .select ( 'trip_id', { count: 'exact', head: true } )
      .in ( 'trip_status', [ 'open', 'booked', 'in_progress' ] ),
    auth.admin
      .from ( 'packages' )
      .select ( 'package_id', { count: 'exact', head: true } )
      .is ( 'deleted_at', null ),
    auth.admin
      .from ( 'disputes' )
      .select ( 'id', { count: 'exact', head: true } )
      .in ( 'status', [ 'pending', 'investigating' ] ),
    auth.admin
      .from ( 'users' )
      .select ( 'id', { count: 'exact', head: true } )
      .eq ( 'profile_status', 'active' )
      .is ( 'deleted_at', null ),
    // Aggregated in the database — pulling every posted transaction row into
    // the function just to sum it would not scale with the range window.
    auth.admin.rpc ( 'admin_revenue_since', { since } ),
  ] );

  const firstError = trips.error ?? packages.error ?? disputes.error ?? users.error ?? revenue.error;
  if ( firstError ) {
    return json ( { success: false, error: { message: firstError.message } }, 500 );
  }

  const totalRevenueJOD = Number ( revenue.data ) || 0;

  // Enveloped: AdminDashboardPage reads `response.success` / `response.data`
  // directly, so this endpoint must satisfy the shared API envelope contract.
  return json ( {
    success: true,
    data: {
      activeTrips: toCount ( trips.count ),
      totalPackages: toCount ( packages.count ),
      pendingDisputes: toCount ( disputes.count ),
      totalRevenueJOD,
      activeUsers: toCount ( users.count ),
    },
  } );
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver approvals — worker-secret gated (pre-existing behaviour)
// ─────────────────────────────────────────────────────────────────────────────

export async function handleAdminListPendingDrivers ( request: Request ) {
  const accessError = ensureRuntimeAdminAccess ( request );
  if ( accessError ) {return accessError;}

  const auth = await authenticateRequest ( request );
  if ( 'error' in auth ) {return auth.error;}

  const role = resolveAccessRole ( auth.canonicalUser.role );
  if ( !hasPermission ( role, 'users:impersonate' ) && !hasPermission ( role, 'config:write' ) ) {
    return json ( { error: 'Insufficient permissions' }, 403 );
  }

  const admin = getAdminClient ();
  const { data, error } = await admin
    .from ( 'drivers' )
    .select (
      'driver_id, user_id, driver_status, verification_level, sanad_identity_linked, background_check_status, created_at, updated_at',
    )
    .eq ( 'driver_status', 'pending_approval' )
    .order ( 'created_at', { ascending: false } );

  if ( error ) {return json ( { error: error.message }, 500 );}
  return json ( { drivers: data ?? [] } );
}

export async function handleAdminApproveDriver ( request: Request, driverId: string ) {
  const accessError = ensureRuntimeAdminAccess ( request );
  if ( accessError ) {return accessError;}

  const auth = await authenticateRequest ( request );
  if ( 'error' in auth ) {return auth.error;}

  const role = resolveAccessRole ( auth.canonicalUser.role );
  if ( !hasPermission ( role, 'users:impersonate' ) && !hasPermission ( role, 'config:write' ) ) {
    return json ( { error: 'Insufficient permissions' }, 403 );
  }

  const admin = getAdminClient ();
  const { data, error } = await admin
    .from ( 'drivers' )
    .update ( { driver_status: 'approved', updated_at: new Date ().toISOString () } )
    .eq ( 'driver_id', driverId )
    .select ( '*' )
    .single ();

  if ( error ) {return json ( { error: error.message }, 500 );}
  return json ( { driver: data } );
}
