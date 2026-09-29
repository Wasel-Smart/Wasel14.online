/**
 * Server-side auth callback — /api/auth/callback
 *
 * Google, Facebook, and Supabase's own email links (signup confirmation,
 * password recovery, resend-confirmation) all redirect the browser here
 * with `?code=...&returnTo=...` once Supabase has finished the provider
 * handshake at https://<project>.supabase.co/auth/v1/callback.
 *
 * This exchanges that code for a session using @supabase/ssr, writes the
 * session into cookies, then 302-redirects into the app. The browser
 * client (src/utils/supabase/client.ts) reads the same cookies, so it
 * must use the same `cookieOptions.name` as COOKIE_NAME below — if the
 * two ever drift, sign-in will silently fail because the server can't
 * find the code_verifier the browser stored.
 *
 * Local dev note: `vite dev` does NOT run this function — only
 * `vercel dev` or the deployed site does. Local development therefore
 * keeps using the client-side /app/auth/callback route (see
 * VITE_AUTH_CALLBACK_PATH in .env vs .env.production).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  writeHead: (statusCode: number, headers: Record<string, string | string[]>) => void;
  end: () => void;
};

const DEFAULT_RETURN_TO = '/app/find-ride';
const SIGN_IN_PATH = '/app/auth';
// Client route that renders the new-password form (WaselAuthCallback).
const CLIENT_CALLBACK_PATH = '/app/auth/callback';
const COOKIE_NAME = 'wasel-auth-token';

function getEnv(name: string): string {
  return process.env[name] ?? '';
}

function getSupabaseUrl(): string {
  return getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
}

function getSupabaseAnonKey(): string {
  return (
    getEnv('SUPABASE_ANON_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnv('VITE_SUPABASE_ANON_KEY')
  );
}

function getHeader(request: VercelRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getRequestOrigin(request: VercelRequest): string {
  const proto = getHeader(request, 'x-forwarded-proto') || 'https';
  const host = getHeader(request, 'host') || 'www.wasel14.online';
  return `${proto}://${host}`;
}

/** Never redirect off-site — only allow paths back into our own app. */
function safeReturnTo(value: string | null): string {
  if (!value) {return DEFAULT_RETURN_TO;}
  return value.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_RETURN_TO;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {return out;}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) {continue;}
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) {continue;}
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function serializeCookie(name: string, value: string, options?: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options?.path ?? '/'}`);
  if (options?.domain) {parts.push(`Domain=${options.domain}`);}
  if (typeof options?.maxAge === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  parts.push(`SameSite=${options?.sameSite === true ? 'Strict' : (options?.sameSite || 'Lax')}`);
  // Secure cookies are allowed on http://localhost / http://127.0.0.1 by
  // browser spec (treated as a secure context), so this is safe to keep on
  // unconditionally rather than branching on protocol.
  parts.push('Secure');
  if (options?.httpOnly !== false) {parts.push('HttpOnly');}
  return parts.join('; ');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const origin = getRequestOrigin(request);
  const url = new URL(request.url ?? '/api/auth/callback', origin);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const isRecovery = url.searchParams.get('type') === 'recovery';

  if (oauthError) {
    response.writeHead(302, { Location: `${SIGN_IN_PATH}?error=${encodeURIComponent(oauthError)}` });
    response.end();
    return;
  }

  if (!code) {
    // Someone loaded this URL directly with no code and no error — just send
    // them to sign in rather than showing a raw error page.
    response.writeHead(302, { Location: SIGN_IN_PATH });
    response.end();
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    response.writeHead(302, {
      Location: `${SIGN_IN_PATH}?error=${encodeURIComponent('Sign-in service is not configured.')}`,
    });
    response.end();
    return;
  }

  const incomingCookies = parseCookies(getHeader(request, 'cookie'));
  const outgoingCookies: string[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: { name: COOKIE_NAME },
    cookies: {
      getAll() {
        return Object.entries(incomingCookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          outgoingCookies.push(serializeCookie(name, value, options));
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // A password-recovery link signs the user in via the code exchange above,
  // but they still have to choose a new password. Hand off to the client
  // callback page (session cookie is already set) instead of dropping them
  // straight into the app at `returnTo`.
  const successLocation = isRecovery
    ? `${CLIENT_CALLBACK_PATH}?type=recovery&returnTo=${encodeURIComponent(returnTo)}`
    : returnTo;

  const headers: Record<string, string | string[]> = {
    Location: error ? `${SIGN_IN_PATH}?error=${encodeURIComponent(error.message)}` : successLocation,
  };
  if (outgoingCookies.length > 0) {
    headers['Set-Cookie'] = outgoingCookies;
  }

  response.writeHead(302, headers);
  response.end();
}
