import { addCSRFHeader } from '../../utils/csrf';

export function createEdgeHeaders(
  headers?: HeadersInit,
  userToken?: string,
  includeCSRF = true,
): Headers {
  let headersInit = headers ?? {};

  if (includeCSRF) {
    headersInit = addCSRFHeader(headersInit);
  }

  const finalHeaders = new Headers(headersInit);

  // NOTE: we intentionally do NOT inject the Supabase `apikey` header here.
  // The Edge Function gateway validates `apikey` against the project's anon JWT,
  // which Supabase disabled in September 2026; the publishable key
  // (`sb_publishable_...`) is rejected by the gateway with
  // `UNAUTHORIZED_INVALID_API_KEY` before the function body runs. With
  // `verify_jwt = false` (see supabase/config.toml) the function authenticates
  // requests itself via the `Authorization: Bearer` JWT through
  // `authenticateRequest()` (admin.auth.getUser), and the public `/health` route
  // is unauthenticated — so the `apikey` header is both rejected and unneeded.
  // Gotrue auth calls go through the supabase-js client, not this helper.

  if (userToken) {
    finalHeaders.set('Authorization', `Bearer ${userToken}`);
  }

  return finalHeaders;
}
