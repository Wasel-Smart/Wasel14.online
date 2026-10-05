import { unwrapApiEnvelope } from '../platform/api-envelope';
import { createCorrelationId } from '../platform/observability';
import { API_URL, publicAnonKey } from '../services/core';
import { logger, trackAPICall } from './monitoring';
import { sanitizeString, validateApiUrl } from './sanitization';
import { supabase } from './supabase/client';
import { getConfig } from './env';
import { addCSRFHeader } from './csrf';

export const API_BASE_URL = API_URL;
export const REQUEST_TIMEOUT = 30_000;

export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1_000,
  retryableStatusCodes: [ 408, 429, 500, 502, 503, 504 ],
};

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown,
  ) {
    super( message );
    this.name = 'APIError';
  }

  toJSON () {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

export class NetworkError extends Error {
  constructor( message: string = 'Network request failed' ) {
    super( message );
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor( message: string = 'Request timeout' ) {
    super( message );
    this.name = 'TimeoutError';
  }
}

export function getApiHeaders ( accessToken?: string, requestId?: string, method?: string ): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Client-Info': 'wasel-web',
    'X-Request-Id': requestId ?? createCorrelationId(),
    'X-Api-Version': 'v1',
    Authorization: `Bearer ${ accessToken || publicAnonKey }`,
  };

  if ( method && [ 'POST', 'PUT', 'PATCH', 'DELETE' ].includes( method ) ) {
    return addCSRFHeader( headers );
  }

  return headers;
}

function sleep ( ms: number ): Promise<void> {
  return new Promise( resolve => setTimeout( resolve, ms ) );
}

export function generateId ( prefix: string = 'id' ): string {
  if ( !globalThis.crypto?.randomUUID ) {
    throw new APIError( 'Secure random ID generation is unavailable', 503, 'secure_random_unavailable' );
  }
  return `${ prefix }-${ crypto.randomUUID() }`;
}

function isRetryable ( statusCode: number ): boolean {
  return RETRY_CONFIG.retryableStatusCodes.includes( statusCode );
}

async function fetchWithTimeout (
  url: string,
  options: RequestInit,
  timeout: number = REQUEST_TIMEOUT,
): Promise<Response> {
  // Validate URL to prevent SSRF attacks
  const { allowedApiDomain } = getConfig();
  const allowedDomains = [ 'supabase.co', 'supabase.net', 'localhost', allowedApiDomain ].filter(
    Boolean,
  );

  if ( !validateApiUrl( url, allowedDomains ) ) { // nosec CWE-918
    throw new APIError( 'Invalid or unauthorized URL', 403, 'invalid_url' );
  }

  const controller = new AbortController();
  const timer = setTimeout( () => controller.abort(), timeout );

  try {
    const response = await fetch( url, {
      ...options,
      signal: controller.signal,
    } );
    return response;
  } catch ( error ) {
    if ( error instanceof DOMException && error.name === 'AbortError' ) {
      throw new TimeoutError( `Request timeout after ${ timeout }ms` );
    }

    if ( error instanceof TypeError ) {
      throw new NetworkError( error.message );
    }

    throw error;
  } finally {
    clearTimeout( timer );
  }
}

async function resolveSessionToken (): Promise<string | undefined> {
  if ( !supabase ) { return undefined; }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? undefined;
}

// A caller that passed an explicit `accessToken` already built its own
// Authorization header (see getApiHeaders). Recover that token so it can be
// honoured; getApiHeaders' anon-key fallback must never be the one that wins.
function readCallerBearer ( headers: HeadersInit | undefined ): string | undefined {
  if ( !headers ) { return undefined; }
  const value = new Headers( headers ).get( 'Authorization' ) ?? '';
  return value.startsWith( 'Bearer ' ) ? value.slice( 7 ) : undefined;
}

// Explicit caller token first, then the ambient session, and only then the
// anon-key fallback inside getApiHeaders. The apiGet/apiPost/... helpers
// pre-build their own headers, so a bearer equal to the anon key just means
// "no token supplied" rather than a deliberate choice.
function resolveAuthToken ( headers: HeadersInit | undefined, sessionToken: string | undefined ): string | undefined {
  const callerBearer = readCallerBearer( headers );
  if ( callerBearer && callerBearer !== publicAnonKey ) { return callerBearer; }
  return sessionToken;
}

function parseApiErrorPayload (
  payload: unknown,
  statusText: string,
): { message: string; code?: string; details?: unknown } {
  if ( typeof payload === 'object' && payload !== null ) {
    const obj = payload as { error?: string; message?: string; code?: string; details?: unknown };
    const message = String( obj.error || obj.message || statusText ) || 'Request failed';
    return { message, code: obj.code, details: obj.details };
  }
  return {
    message: String( payload || statusText || 'Request failed' ),
    code: undefined,
    details: undefined,
  };
}

function isFatalClientError ( error: Error ): boolean {
  return (
    error instanceof APIError &&
    error.statusCode >= 400 &&
    error.statusCode < 500 &&
    error.statusCode !== 429
  );
}

function isRetryableRuntimeError ( error: Error ): boolean {
  return error instanceof NetworkError || error instanceof TimeoutError;
}

export async function apiRequest<T = unknown> (
  endpoint: string,
  options: RequestInit = {},
  retries: number = RETRY_CONFIG.maxRetries,
): Promise<T> {
  if ( !API_BASE_URL && !endpoint.startsWith( 'http' ) ) {
    throw new APIError( 'Backend API base URL is not configured.', 500, 'api_not_configured' );
  }

  const method = options.method || 'GET';
  const url = endpoint.startsWith( 'http' ) ? endpoint : `${ API_BASE_URL }${ endpoint }`;
  const requestId = createCorrelationId();
  const sessionToken = await resolveSessionToken();
  const authToken = resolveAuthToken( options.headers, sessionToken );
  let lastError: Error | null = null;

  for ( let attempt = 0; attempt <= retries; attempt += 1 ) {
    const startedAt = performance.now();

    try {
      const response = await fetchWithTimeout( url, {
        ...options,
        // Caller headers go first so the resolved auth headers below win.
        // The apiGet/apiPost/... helpers build their own headers from an
        // `accessToken` argument that is usually undefined, which made
        // getApiHeaders() fall back to the anon key and overwrite the real
        // session bearer — every request through adminApi went out anonymous.
        headers: {
          ...options.headers,
          ...getApiHeaders( authToken, requestId, method ),
        },
      } );

      const duration = Math.round( performance.now() - startedAt );
      trackAPICall( endpoint, method, duration, response.status );

      const contentType = response.headers.get( 'content-type' ) || '';
      const hasJson = contentType.includes( 'application/json' );
      const payload = hasJson ? await response.json().catch( () => ( {} ) ) : await response.text();

      if ( response.ok ) {
        return unwrapApiEnvelope<T>( payload as T );
      }

      const normalizedError = parseApiErrorPayload( payload, response.statusText );

      if ( isRetryable( response.status ) && attempt < retries ) {
        const delay = RETRY_CONFIG.retryDelay * Math.pow( 2, attempt );
        logger.warning( `Retrying API request after ${ response.status }`, {
          endpoint,
          method,
          attempt: attempt + 1,
          delay,
          requestId,
        } );
        await sleep( delay );
        continue;
      }

      throw new APIError(
        normalizedError.message,
        response.status,
        normalizedError.code,
        normalizedError.details,
      );
    } catch ( error ) {
      lastError = error instanceof Error ? error : new Error( String( error ) );

      if ( isFatalClientError( lastError ) ) {
        throw lastError;
      }

      if ( attempt >= retries || !isRetryableRuntimeError( lastError ) ) {
        if ( !( lastError instanceof APIError ) ) {
          logger.error( 'API request failed', lastError, {
            endpoint: sanitizeString( endpoint ),
            method: sanitizeString( method ),
            requestId,
          } );
        }
        break;
      }

      const delay = RETRY_CONFIG.retryDelay * Math.pow( 2, attempt );
      logger.warning( 'Retrying failed network call', {
        endpoint: sanitizeString( endpoint ),
        method: sanitizeString( method ),
        attempt: attempt + 1,
        delay,
        requestId,
        error: sanitizeString( lastError.message ),
      } );
      await sleep( delay );
    }
  }

  throw lastError || new NetworkError( 'Request failed after all retries' );
}

export async function apiGet<T = unknown> (
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  accessToken?: string,
): Promise<T> {
  const queryString = params
    ? `?${ new URLSearchParams(
      Object.entries( params )
        .filter( ( [ , value ] ) => value !== undefined && value !== null )
        .map( ( [ key, value ] ) => [ key, String( value ) ] ),
    ).toString() }`
    : '';

  return apiRequest<T>( endpoint + queryString, {
    method: 'GET',
    headers: getApiHeaders( accessToken, undefined, 'GET' ),
  } );
}

export async function apiPost<T = unknown> (
  endpoint: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  return apiRequest<T>( endpoint, {
    method: 'POST',
    headers: getApiHeaders( accessToken, undefined, 'POST' ),
    body: body ? JSON.stringify( body ) : undefined,
  } );
}

export async function apiPut<T = unknown> (
  endpoint: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  return apiRequest<T>( endpoint, {
    method: 'PUT',
    headers: getApiHeaders( accessToken, undefined, 'PUT' ),
    body: body ? JSON.stringify( body ) : undefined,
  } );
}

export async function apiPatch<T = unknown> (
  endpoint: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  return apiRequest<T>( endpoint, {
    method: 'PATCH',
    headers: getApiHeaders( accessToken, undefined, 'PATCH' ),
    body: body ? JSON.stringify( body ) : undefined,
  } );
}

export async function apiDelete<T = unknown> ( endpoint: string, accessToken?: string ): Promise<T> {
  return apiRequest<T>( endpoint, {
    method: 'DELETE',
    headers: getApiHeaders( accessToken, undefined, 'DELETE' ),
  } );
}

export const API_ENDPOINTS = {
  TRIPS: '/v1/trips',
  TRIPS_SEARCH: '/v1/trips/search',
  TRIPS_CALCULATE_PRICE: '/v1/trips/calculate-price',
  MY_TRIPS: '/v1/trips/user',
  ACTIVE_TRIP: '/v1/active-trip',
  BOOKINGS: '/v1/bookings',
  BOOKINGS_USER: '/v1/bookings/user',
  BOOKINGS_TRIP: (tripId: string) => `/v1/trips/${tripId}/bookings`,
  BOOKINGS_ID: (bookingId: string) => `/v1/bookings/${bookingId}`,
  PACKAGES: '/v1/packages',
  PACKAGES_SENDER: (userId: string) => `/v1/packages/sender/${userId}`,
  PACKAGES_ID: (id: string) => `/v1/packages/${id}`,
  PACKAGES_STATUS: (id: string) => `/v1/packages/${id}/status`,
  PACKAGES_ASSIGN: (id: string) => `/v1/packages/${id}/assign-to-trip`,
  RATINGS: '/v1/ratings',
  RATINGS_DRIVER: (driverId: string) => `/v1/ratings/drivers/${driverId}`,
  RATINGS_ELIGIBILITY: (bookingId: string) => `/v1/ratings/bookings/${bookingId}/eligibility`,
  REVIEWS: '/v1/reviews',
  NOTIFICATIONS: '/v1/notifications',
  NOTIFICATIONS_READ: (id: string) => `/v1/notifications/${id}/read`,
  NOTIFICATIONS_SEND_PUSH: '/v1/notifications/send-push',
  NOTIFICATIONS_PUSH_PREF: '/v1/notifications/push-pref',
  WALLET: (userId: string) => `/v1/wallet/${userId}`,
  WALLET_TRANSACTIONS: (userId: string) => `/v1/wallet/${userId}/transactions`,
  WALLET_INSIGHTS: (userId: string) => `/v1/wallet/${userId}/insights`,
  WALLET_WITHDRAW: (userId: string) => `/v1/wallet/${userId}/withdraw`,
  WALLET_SEND: (userId: string) => `/v1/wallet/${userId}/send`,
  WALLET_REWARDS: (userId: string) => `/v1/wallet/${userId}/rewards`,
  WALLET_REWARDS_CLAIM: (userId: string) => `/v1/wallet/${userId}/rewards/claim`,
  WALLET_SUBSCRIPTION: (userId: string) => `/v1/wallet/${userId}/subscription`,
  WALLET_TOPUP: (userId: string) => `/v1/wallet/${userId}/top-up`,
  WALLET_SUBSCRIBE: (userId: string) => `/v1/wallet/${userId}/subscribe`,
  WALLET_PIN_SET: (userId: string) => `/v1/wallet/${userId}/pin/set`,
  WALLET_PIN_VERIFY: (userId: string) => `/v1/wallet/${userId}/pin/verify`,
  WALLET_AUTO_TOPUP: (userId: string) => `/v1/wallet/${userId}/auto-topup`,
  WALLET_PAYMENT_METHODS: (userId: string) => `/v1/wallet/${userId}/payment-methods`,
  WALLET_PAYMENT_METHOD: (userId: string, methodId: string) => `/v1/wallet/${userId}/payment-methods/${methodId}`,
  WALLET_TRUST_SCORE: (userId: string) => `/v1/wallet/${userId}/trust-score`,
  WALLET_PAY: (userId: string) => `/v1/wallet/${userId}/pay`,
  MOBILITY_OS_LIVE: '/v1/mobility-os/live-rows',
  MOBILITY_OS_SNAPSHOT: '/v1/mobility-os/snapshot',
  MOBILITY_OS_BOOKING: '/v1/mobility-os/booking/create',
  MOBILITY_OS_PUBLIC: '/v1/mobility-os/public-snapshot',
  CHAT_MESSAGES: (tripId: string) => `/v1/chat/trips/${tripId}/messages`,
  CHAT_READ: '/v1/chat/messages/read',
  CHAT_UNREAD: (tripId: string) => `/v1/chat/trips/${tripId}/unread-count`,
  TRUST_STATUS: '/v1/trust/status',
  TRUST_PHONE_START: '/v1/trust/phone/start',
  TRUST_PHONE_CONFIRM: '/v1/trust/phone/confirm',
  TRUST_IDENTITY: '/v1/trust/identity/submit',
  TRUST_DRIVER_MODE: '/v1/trust/driver-mode/enable',
  TRUST_DRIVER_DOCS: '/v1/trust/driver-documents/submit',
  ADMIN_USERS: '/v1/admin/users',
  ADMIN_USER_STATUS: (userId: string) => `/v1/admin/users/${userId}/status`,
  ADMIN_DISPUTES: '/v1/admin/disputes',
  ADMIN_DISPUTE_RESOLVE: (disputeId: string) => `/v1/admin/disputes/${disputeId}/resolve`,
  ADMIN_DASHBOARD: '/v1/admin/dashboard/metrics',
  ADMIN_DRIVERS_PENDING: '/v1/admin/drivers/pending',
  ADMIN_DRIVER_APPROVE: (driverId: string) => `/v1/admin/drivers/${driverId}/approve`,
  COMMUNICATIONS_PREFS: '/v1/communications/preferences',
  COMMUNICATIONS_DELIVER: '/v1/communications/deliver',
  COMMUNICATIONS_PROCESS: '/v1/communications/process',
  COMMUNICATIONS_ADMIN_TEST: '/v1/communications/admin/send-test',
  COMMUNICATIONS_ADMIN_DIAG: '/v1/communications/admin/provider-diagnostics',
  COMMUNICATIONS_ADMIN_MIGRATIONS: '/v1/communications/admin/apply-migrations',
  MODERATION_ADMIN_MIGRATIONS: '/v1/moderation/admin/apply-migrations',
  GDPR_CONSENTS: '/v1/gdpr/consents',
  GDPR_CONSENT: (userId: string) => `/v1/gdpr/consents/${userId}`,
  GDPR_DATA_EXPORTS: '/v1/gdpr/data-exports',
  GDPR_DELETIONS: '/v1/gdpr/deletions',
  GDPR_DELETIONS_CANCEL: '/v1/gdpr/deletions/cancel',
  PAYMENTS_INTENT: '/v1/payment/create-intent',
  PAYMENTS_REFUND: '/v1/payment/refund',
  PAYMENTS_STATUS: (bookingId: string) => `/v1/booking/${bookingId}/payment-status`,
  PROFILE: '/v1/profile',
  PROFILE_ID: (userId: string) => `/v1/profile/${userId}`,
  AUTH_2FA_SETUP: '/v1/auth/2fa/setup',
  AUTH_2FA_VERIFY: '/v1/auth/2fa/verify',
  AUTH_2FA_DISABLE: '/v1/auth/2fa/disable',
  CANCELLATIONS_BOOKING: '/v1/cancellations/bookings',
  CANCELLATIONS_TRIP: '/v1/cancellations/trips',
  CANCELLATIONS_ELIGIBILITY: (bookingId: string) => `/v1/cancellations/bookings/${bookingId}/eligibility`,
  REPORTS: '/v1/reports',
  LIVE_TRIP: '/v1/live-trip',
  HEALTH: '/health',
} as const;

export async function getSessionUserId (): Promise<string | null> {
  if ( !supabase ) { return null; }
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export default {
  baseUrl: API_BASE_URL,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
  request: apiRequest,
  endpoints: API_ENDPOINTS,
};
