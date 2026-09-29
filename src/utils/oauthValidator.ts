/**
 * OAuth Configuration Validator
 * Validates that OAuth providers are properly configured before use
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { publicAnonKey, publicSupabaseUrl } from './supabase/info';

export type OAuthProvider = 'google' | 'facebook' | 'microsoft' | 'apple';

export interface OAuthProviderStatus {
  provider: OAuthProvider;
  enabled: boolean;
  configured: boolean;
  error?: string;
}

export interface OAuthValidationResult {
  valid: boolean;
  providers: OAuthProviderStatus[];
  redirectUri: string;
  warnings: string[];
}

/**
 * Get the expected redirect URI for Supabase OAuth
 */
export function getOAuthRedirectUri(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/auth/v1/callback`;
}

// ── Provider availability (real check) ────────────────────────────────────────
// `signInWithOAuth({ skipBrowserRedirect: true })` only builds a URL client-side
// and never contacts Supabase, so it can NOT detect a disabled provider. The
// public GET /auth/v1/settings endpoint reports which external providers are
// enabled for the project, which is the correct source of truth.
let providerSettingsPromise: Promise<Record<string, boolean> | null> | null = null;

export function fetchEnabledOAuthProviders(force = false): Promise<Record<string, boolean> | null> {
  if (!publicSupabaseUrl || !publicAnonKey) {
    return Promise.resolve(null);
  }

  if (!providerSettingsPromise || force) {
    const request = (async (): Promise<Record<string, boolean> | null> => {
      try {
        const response = await fetch(`${publicSupabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
          headers: { apikey: publicAnonKey },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) {return null;}
        const data = (await response.json()) as { external?: Record<string, boolean> };
        return data.external && typeof data.external === 'object' ? data.external : null;
      } catch {
        return null;
      }
    })();

    providerSettingsPromise = request;
    // Never cache a failed lookup; the next caller retries.
    void request.then(result => {
      if (result === null && providerSettingsPromise === request) {
        providerSettingsPromise = null;
      }
    });
  }

  return providerSettingsPromise;
}

/**
 * Validate that a provider is enabled for the Supabase project.
 * When the settings endpoint is unreachable the provider is optimistically
 * treated as available so a transient failure never blocks sign-in.
 */
export async function validateOAuthProvider(
  // Kept for API compatibility with existing callers; the check no longer
  // needs a Supabase client because it queries the project's auth settings.
  _client: SupabaseClient,
  provider: OAuthProvider,
): Promise<OAuthProviderStatus> {
  const external = await fetchEnabledOAuthProviders();

  if (!external || !(provider in external)) {
    return { provider, enabled: true, configured: true };
  }

  if (external[provider] === false) {
    return {
      provider,
      enabled: false,
      configured: false,
      error: classifyConfigError('provider is not enabled', provider),
    };
  }

  return { provider, enabled: true, configured: true };
}

/**
 * Classify configuration errors into actionable messages
 */
function classifyConfigError(message: string, provider: OAuthProvider): string {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  // Classify by pattern only — never reflect the raw error message back to
  // the caller to avoid leaking internal OAuth configuration details.
  const lower = message.toLowerCase();

  if (lower.includes('redirect_uri') || lower.includes('redirect uri') || lower.includes('uri not allowed')) {
    return `${providerName} redirect URI is not whitelisted. Add the Supabase callback URL to your ${provider === 'facebook' ? 'Facebook Developer Console' : 'Google Cloud Console'} > Valid OAuth Redirect URIs.`;
  }

  if (lower.includes('client_id') || lower.includes('client id') || lower.includes('invalid_client')) {
    return `${providerName} Client ID is missing or invalid. Check your Supabase Dashboard > Authentication > Providers > ${providerName}.`;
  }

  if (lower.includes('client_secret') || lower.includes('client secret') || lower.includes('unauthorized')) {
    return `${providerName} Client Secret is missing or invalid. Check your Supabase Dashboard > Authentication > Providers > ${providerName}.`;
  }

  if (lower.includes('provider is not enabled') || lower.includes('not enabled')) {
    return `${providerName} provider is not enabled in Supabase Dashboard > Authentication > Providers.`;
  }

  // Return a generic message — do NOT include the raw error string
  return `${providerName} OAuth configuration error. Check your Supabase Dashboard > Authentication > Providers > ${providerName}.`;
}

/**
 * Get the expected redirect URI for this app
 */
export function getExpectedRedirectUri(): string {
  return getOAuthRedirectUri(publicSupabaseUrl || import.meta.env.VITE_SUPABASE_URL || '');
}

/**
 * Get setup instructions for each provider
 */
export function getProviderSetupInstructions(provider: OAuthProvider): {
  steps: string[];
  docsUrl: string;
} {
  const redirectUri = getExpectedRedirectUri();

  if (provider === 'facebook') {
    return {
      steps: [
        'Go to Meta for Developers > Your App > Use cases / Products > Facebook Login > Settings',
        `Add "${redirectUri}" to Valid OAuth Redirect URIs`,
        'Go to Supabase Dashboard > Authentication > Sign In / Providers > Facebook',
        'Enable Facebook and enter your App ID + App Secret',
        'Set the app to "Live" mode and fill in the Privacy Policy URL and Data Deletion instructions URL',
      ],
      docsUrl: 'https://developers.facebook.com/docs/facebook-login',
    };
  }

  if (provider === 'microsoft') {
    return {
      steps: [
        'Go to Azure Portal > Microsoft Entra ID > App registrations',
        `Add "${redirectUri}" to Redirect URIs (web)`,
        'Go to Supabase Dashboard > Authentication > Sign In / Providers > Azure (Microsoft)',
        'Enable it and enter your Client ID + Client Secret',
        'Ensure the app is published and consent is granted for the required scopes',
      ],
      docsUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app',
    };
  }

  if (provider === 'apple') {
    return {
      steps: [
        'Go to Apple Developer > Certificates, Identifiers & Profiles > Identifiers',
        `Add "${redirectUri}" to Return URLs in your Apple Services ID`,
        'Go to Supabase Dashboard > Authentication > Sign In / Providers > Apple',
        'Enable Apple and enter your Services ID, Team ID, Key ID, and Private Key',
        'Ensure your Apple app is configured for Sign in with Apple',
      ],
      docsUrl: 'https://developer.apple.com/documentation/sign_in_with_apple',
    };
  }

  return {
    steps: [
      'Go to Google Cloud Console > APIs & Services > Credentials > your OAuth client (Web application)',
      `Add "${redirectUri}" to Authorized redirect URIs`,
      'Under OAuth consent screen, set Publishing status to "In production" (otherwise only test users can sign in)',
      'Go to Supabase Dashboard > Authentication > Sign In / Providers > Google',
      'Enable Google and enter your Client ID + Client Secret',
    ],
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  };
}

/**
 * Check if the current origin is in the Supabase allow-list
 */
export function isOriginAllowed(allowedOrigins: string[]): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const origin = window.location.origin;
  return allowedOrigins.some(allowed => {
    try {
      const allowedUrl = new URL(allowed);
      return allowedUrl.origin === origin;
    } catch {
      return allowed === origin;
    }
  });
}
