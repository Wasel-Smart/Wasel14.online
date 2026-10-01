import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from '@supabase/auth-js';
import type { Provider, SupabaseClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl, resolveAuthRedirectOrigin } from '../utils/env';
import { deriveAccountTrustScore } from '../domain/trust/score';

export type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  phone_verified?: boolean | null;
  email_verified?: boolean | null;
  role?: string | null;
  wallet_balance?: number | null;
  rating?: number | null;
  rating_as_driver?: number | null;
  trip_count?: number | null;
  verified?: boolean | null;
  sanad_verified?: boolean | null;
  verification_level?: string | null;
  wallet_status?: string | null;
  avatar_url?: string | null;
  two_factor_enabled?: boolean | null;
  driver_status?: string | null;
};

export type AuthOperationError = AuthError | Error | null;

export interface WaselUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'rider' | 'driver' | 'both' | 'admin';
  balance: number;
  rating: number;
  trips: number;
  verified: boolean;
  sanadVerified: boolean;
  verificationLevel: string;
  walletStatus: 'active' | 'limited' | 'frozen' | 'closed' | 'unavailable';
  avatar?: string;
  joinedAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  trustScore: number;
  driverStatus?: string;
  backendMode: 'supabase';
}

export function createLocalAuthUser(localUser: WaselUser): User {
  return {
    id: localUser.id,
    email: localUser.email,
    phone: localUser.phone,
    user_metadata: {
      name: localUser.name,
      role: localUser.role,
    },
  } as unknown as User;
}

export function createLocalAuthProfile(localUser: WaselUser): Profile {
  return {
    id: localUser.id,
    email: localUser.email,
    full_name: localUser.name,
    phone_number: localUser.phone ?? null,
    wallet_balance: localUser.balance,
    rating: localUser.rating,
    trip_count: localUser.trips,
    verified: localUser.verified,
    sanad_verified: localUser.sanadVerified,
    verification_level: localUser.verificationLevel,
    wallet_status: localUser.walletStatus,
    avatar_url: localUser.avatar ?? null,
    phone_verified: localUser.phoneVerified,
    email_verified: localUser.emailVerified,
    two_factor_enabled: localUser.twoFactorEnabled,
    role: localUser.role,
    driver_status: localUser.driverStatus ?? null,
  };
}

export function shouldIgnoreProfileError(error: Error): boolean {
  return error.message?.includes('aborted') || error.message?.includes('not found');
}

export function normalizeOperationError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export async function signInWithOAuthProvider(
  client: SupabaseClient | null,
  provider: 'google' | 'facebook' | 'microsoft' | 'apple',
  returnTo?: string,
): Promise<{ error: AuthOperationError }> {
  if (!client) {
    return { error: new Error('Backend not configured') };
  }

  try {
    const redirectTo = getAuthCallbackUrl(
      resolveAuthRedirectOrigin(),
      returnTo ? { returnTo } : undefined,
    );

    // Generate and store a one-time nonce so the AuthContext message listener
    // can verify the wasel-auth-complete postMessage came from our own callback.
    // Storage can throw (Safari private mode, blocked cookies); a missing nonce
    // only disables the popup postMessage handshake, never the redirect flow.
    try {
      sessionStorage.setItem('wasel_oauth_nonce', crypto.randomUUID());
    } catch {
      /* ignore */
    }

    // Supabase prepends each provider's default scopes to whatever is passed
    // here (`email profile` for Google, `email` for Facebook). Re-requesting
    // them produced duplicated values on the provider URL, e.g.
    // `email profile openid profile email`, so only the extra scopes are listed.
    const scopes =
      provider === 'facebook'
        ? 'public_profile'
        : provider === 'google'
          ? 'openid'
          : provider === 'microsoft'
            ? 'openid profile email'
            : 'name email';

    const { error } = await client.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo,
        scopes,
        // Supabase recommends PKCE for OAuth when supported; it's a no-op for
        // providers that don't support it (Apple, older Facebook clients).
        // Full-page redirect flow: do NOT request Facebook's `display=popup`
        // dialog (it renders a popup-sized dialog inside the main window).
        // Google: always show the account chooser so users can switch accounts.
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });

    return { error: error ?? null };
  } catch (error: unknown) {
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    return {
      error: normalizeOperationError(
        error,
        `${providerName} login failed`,
      ),
    };
  }
}

export function shouldRefreshProfile(event: AuthChangeEvent, session: Session | null): boolean {
  return Boolean(session?.user) && event === 'SIGNED_IN';
}

function computeTrustScore(
  user: Pick<
    WaselUser,
    'verified' | 'sanadVerified' | 'emailVerified' | 'phoneVerified' | 'trips' | 'rating'
  >,
) {
  return deriveAccountTrustScore(user);
}

function resolveUserName(
  profile: Profile | null,
  authUser: Pick<User, 'user_metadata' | 'email'> | null,
): string {
  return (
    profile?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    authUser?.email?.split('@')?.[0] ||
    'Wasel User'
  );
}

/**
 * Maps the raw `profiles.role` / `users.role` DB string to the local
 * `WaselUser['role']` union.
 *
 * SCHEMA LIMITATION (verified against supabase/migrations/, 2026-09-30):
 *   - `public.profiles.role` is constrained by
 *     supabase/migrations/20260224000002_wasel_complete_schema.sql:104
 *       CHECK (role IN ('rider', 'driver', 'admin', 'support'))
 *   - `public.users.role` is typed by
 *     supabase/migrations/20260327090000_production_operating_model.sql:7
 *       user_role_v2 AS ENUM ('passenger', 'driver', 'admin')
 *   - No migration ever ADDs corporate / school / finance / trust /
 *     operator / medical / package_agent / bus_operator to either column.
 *
 * The canonical RBAC matrix (packages/rbac/src/index.ts) therefore models
 * staff roles that the live database schema CANNOT actually store. This
 * function is the honest boundary: it preserves the rider-facing behaviour
 * the app already relies on, and it refuses to fabricate a staff role.
 *
 * Rider-facing mapping (unchanged behaviour):
 *   'rider'/'passenger' -> 'rider'  (RBAC 'user' permission set)
 *   'driver'           -> 'driver' (RBAC 'driver' permission set)
 *   'both'             -> 'both'   (driver + rider surfaces; RBAC 'driver')
 *   'admin'            -> 'admin'  (full access)
 *   'support'          -> 'rider'  (see below)
 *
 * 'support' is the only CHECK-allowed value that is NOT a rider-facing role.
 * The DB permits it, but the local type does not, and collapsing it to
 * 'rider' here is a deliberate, documented loss: a 'support' account is
 * signed in and is shown the signed-out preview on every gated surface,
 * including the surfaces it legitimately owns (admin/users, admin/disputes).
 * That is a fail-closed misfire, not a security regression — the gates still
 * reject it, they just reject it at the preview instead of the gate. Fixing
 * it requires a schema migration (widening the CHECK/enum), which is out of
 * scope for this frontend-only change.
 *
 * GATE OUTCOME AFTER THIS CHANGE (9 gated surfaces, all still fail-closed):
 *   services/corporate  (corporate:read)  -> UNREACHABLE (schema has no 'corporate' role)
 *   services/school     (school:read)     -> UNREACHABLE (schema has no 'school' role)
 *   innovation-hub      (operations:read)  -> UNREACHABLE (schema has no 'operator' role)
 *   ai-intelligence     (operations:read)  -> UNREACHABLE (schema has no 'operator' role)
 *   analytics           (analytics:read)   -> UNREACHABLE (no role in the schema holds it)
 *   moderation          (trust:moderate)   -> UNREACHABLE (schema has no 'trust' role)
 *   admin/users         (users:read)       -> UNREACHABLE (no role in the schema holds it)
 *   admin/disputes      (disputes:read)    -> UNREACHABLE (no role in the schema holds it)
 *   admin               (config:write)     -> admin ONLY (correct today)
 * Only 'admin' can pass any gate, exactly as before. No gate is weakened.
 */
function resolveUserRole(profileRole: string | null | undefined): WaselUser['role'] {
  if (profileRole === 'driver' || profileRole === 'both') {return profileRole;}
  if (profileRole === 'admin') {return 'admin';}
  // 'support' is schema-valid but has no local representation; collapse to
  // 'rider' rather than inventing a role the DB cannot store.
  return 'rider';
}

function resolveVerificationLevel(
  profile: Profile | null,
  role: WaselUser['role'],
  sanadVerified: boolean,
  phoneVerified: boolean,
  emailVerified: boolean,
): string {
  if (profile?.verification_level) {return profile.verification_level;}
  if (sanadVerified) {
    return role === 'driver' || role === 'both' ? 'level_3' : 'level_2';
  }
  if (phoneVerified || emailVerified) {return 'level_1';}
  return 'level_0';
}

function resolveWalletStatus(
  profileStatus: string | null | undefined,
): WaselUser['walletStatus'] {
  if (
    profileStatus === 'limited' ||
    profileStatus === 'frozen' ||
    profileStatus === 'closed' ||
    profileStatus === 'unavailable'
  ) {
    return profileStatus;
  }
  return 'active';
}

export function mapBackendProfile({
  authUser,
  profile,
}: {
  authUser: Pick<
    User,
    | 'id'
    | 'email'
    | 'phone'
    | 'created_at'
    | 'email_confirmed_at'
    | 'phone_confirmed_at'
    | 'user_metadata'
  >;
  profile: Profile | null;
}): WaselUser {
  const name = resolveUserName(profile, authUser);
  const phone = profile?.phone_number ?? authUser?.phone ?? undefined;
  const verified = Boolean(profile?.verified ?? profile?.sanad_verified ?? false);
  const sanadVerified = Boolean(profile?.sanad_verified ?? verified);
  const emailVerified = Boolean(profile?.email_verified ?? authUser?.email_confirmed_at ?? false);
  const phoneVerified = Boolean(profile?.phone_verified ?? authUser?.phone_confirmed_at ?? false);
  const role = resolveUserRole(profile?.role);
  const verificationLevel = resolveVerificationLevel(profile, role, sanadVerified, phoneVerified, emailVerified);
  const walletStatus = resolveWalletStatus(profile?.wallet_status);

  const baseUser: WaselUser = {
    id: authUser.id,
    name,
    email: authUser?.email || profile?.email || '',
    phone,
    role,
    balance: Number(profile?.wallet_balance ?? 0),
    rating: Number(profile?.rating ?? 5),
    trips: Number(profile?.trip_count ?? 0),
    verified,
    sanadVerified,
    verificationLevel,
    walletStatus,
    avatar: profile?.avatar_url ?? authUser?.user_metadata?.avatar_url ?? authUser?.user_metadata?.picture ?? undefined,
    joinedAt: String(authUser?.created_at ?? new Date().toISOString()).slice(0, 10),
    emailVerified,
    phoneVerified,
    twoFactorEnabled: Boolean(profile?.two_factor_enabled),
    trustScore: 0,
    driverStatus: profile?.driver_status ?? undefined,
    backendMode: 'supabase',
  };

  return {
    ...baseUser,
    trustScore: computeTrustScore(baseUser),
  };
}

export function applyUserUpdates(user: WaselUser, updates: Partial<WaselUser>): WaselUser {
  const next = { ...user, ...updates };
  next.trustScore = computeTrustScore({
    verified: next.verified,
    sanadVerified: next.sanadVerified,
    emailVerified: next.emailVerified,
    phoneVerified: next.phoneVerified,
    trips: next.trips,
    rating: next.rating,
  });

  next.verificationLevel =
    next.verificationLevel ||
    (next.sanadVerified
      ? next.role === 'driver' || next.role === 'both'
        ? 'level_3'
        : 'level_2'
      : next.phoneVerified || next.emailVerified
        ? 'level_1'
        : 'level_0');

  return next;
}
