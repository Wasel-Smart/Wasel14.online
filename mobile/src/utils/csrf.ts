/**
 * The edge function (supabase/functions/make-server-0b1f4071/_handlers/shared.ts,
 * enforceRequestSecurity) rejects every mutating, non-webhook request that lacks an
 * `x-csrf-token` header. The API is bearer-token authenticated, so this header is a
 * same-origin tripwire for browsers, not a secret: the server only checks that it is
 * present. Native clients have no browser origin, but they still must send it or every
 * POST/PUT/PATCH/DELETE answers 403.
 *
 * One token per app launch is enough. Do not treat it as a security control.
 */
export const CSRF_HEADER = 'x-csrf-token';

let sessionToken: string | null = null;

function randomSegment(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function getCsrfToken(): string {
  if (!sessionToken) {
    sessionToken = `m_${Date.now().toString(36)}_${randomSegment()}${randomSegment()}`;
  }
  return sessionToken;
}

/** Test helper: forces a new token on the next call. */
export function resetCsrfTokenForTests(): void {
  sessionToken = null;
}
