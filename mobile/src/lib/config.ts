import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { secureSessionStorage } from './secureStorage';

type ExtraConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleMapsKey?: string;
  stripePublishableKey?: string;
  supabaseFunctionUrl?: string;
  authRedirectUrl?: string;
  apiUrl?: string;
  wsUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
const processEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

function readPublicEnv(key: string, fallback?: string): string {
  return processEnv[key] ?? fallback ?? '';
}

const supabaseUrl = readPublicEnv('EXPO_PUBLIC_SUPABASE_URL', extra.supabaseUrl);
const supabaseAnonKey = readPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', extra.supabaseAnonKey);
const googleMapsKey = readPublicEnv('EXPO_PUBLIC_GOOGLE_MAPS_KEY', extra.googleMapsKey);
const stripePublishableKey = readPublicEnv(
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  extra.stripePublishableKey,
);
const supabaseFunctionUrl = readPublicEnv(
  'EXPO_PUBLIC_SUPABASE_FUNCTION_URL',
  extra.supabaseFunctionUrl,
);
const authRedirectUrl = readPublicEnv('EXPO_PUBLIC_AUTH_REDIRECT_URL', extra.authRedirectUrl);
const apiUrl = readPublicEnv('EXPO_PUBLIC_API_URL', extra.apiUrl);
const wsUrl = readPublicEnv('EXPO_PUBLIC_WS_URL', extra.wsUrl);
const hasSupabaseConfiguration = Boolean(supabaseUrl && supabaseAnonKey);

export const waselMobileConfig = {
  supabaseUrl,
  supabaseAnonKey,
  googleMapsKey,
  stripePublishableKey,
  supabaseFunctionUrl,
  authRedirectUrl: authRedirectUrl || 'wasel://auth/callback',
  apiUrl,
  wsUrl,
  hasSupabase: hasSupabaseConfiguration,
  hasMaps: Boolean(googleMapsKey),
  hasStripe: Boolean(stripePublishableKey),
  hasFunctions: Boolean(supabaseFunctionUrl),
};

export function validateMobileEnvironment(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return { valid: missing.length === 0, missing };
}

// Supabase persists refresh tokens. AsyncStorage is plaintext on most devices,
// so authentication material goes to the OS-protected keychain/keystore through
// a chunking adapter (see ./secureStorage) that copes with large sessions.

// Keep module initialization safe when a release is misconfigured. App.tsx
// gates all workflows before this inert client can be used.
const clientUrl = hasSupabaseConfiguration ? supabaseUrl : 'https://configuration-required.invalid';
const clientKey = hasSupabaseConfiguration ? supabaseAnonKey : 'configuration-required';

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    storage: secureSessionStorage,
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    // PKCE: the deep link carries a one-time `code` that only this device can
    // exchange. The implicit flow put raw access/refresh tokens in the URL, so
    // any app able to open the custom scheme could sign a victim into an
    // attacker's account.
    flowType: 'pkce',
  },
});
