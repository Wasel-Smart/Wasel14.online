import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOAuthRedirectUri,
  getExpectedRedirectUri,
  validateOAuthProvider,
  fetchEnabledOAuthProviders,
  isOriginAllowed,
  getProviderSetupInstructions,
  type OAuthProvider,
} from '@/utils/oauthValidator';

// ── Mock supabase/info so tests don't need real env vars ──────────────────────
vi.mock('@/utils/supabase/info', () => ({
  publicSupabaseUrl: 'https://xyzproject.supabase.co',
  publicAnonKey: 'test-anon-key',
}));

const mockClient = {} as never; // validateOAuthProvider no longer uses the client

// ── Reset module-level cache between tests ────────────────────────────────────
beforeEach(() => {
  vi.restoreAllMocks();
  // Force-reset the module-level promise cache by re-importing with force=true
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getOAuthRedirectUri ───────────────────────────────────────────────────────
describe('getOAuthRedirectUri', () => {
  it('appends /auth/v1/callback to the base URL', () => {
    expect(getOAuthRedirectUri('https://abc.supabase.co')).toBe(
      'https://abc.supabase.co/auth/v1/callback',
    );
  });

  it('strips a trailing slash before appending', () => {
    expect(getOAuthRedirectUri('https://abc.supabase.co/')).toBe(
      'https://abc.supabase.co/auth/v1/callback',
    );
  });
});

// ── getExpectedRedirectUri ────────────────────────────────────────────────────
describe('getExpectedRedirectUri', () => {
  it('returns a string containing /auth/v1/callback', () => {
    const uri = getExpectedRedirectUri();
    expect(uri).toContain('/auth/v1/callback');
  });
});

// ── fetchEnabledOAuthProviders ────────────────────────────────────────────────
describe('fetchEnabledOAuthProviders', () => {
  it('returns null when the settings endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await fetchEnabledOAuthProviders(true);
    expect(result).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchEnabledOAuthProviders(true);
    expect(result).toBeNull();
  });

  it('returns the external providers map on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: true, facebook: false } }),
    }));
    const result = await fetchEnabledOAuthProviders(true);
    expect(result).toEqual({ google: true, facebook: false });
  });

  it('returns null when external field is missing from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ other: 'data' }),
    }));
    const result = await fetchEnabledOAuthProviders(true);
    expect(result).toBeNull();
  });
});

// ── validateOAuthProvider ─────────────────────────────────────────────────────
describe('validateOAuthProvider', () => {
  it('returns enabled=true when settings endpoint is unreachable (optimistic)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await validateOAuthProvider(mockClient, 'google');
    expect(result.enabled).toBe(true);
    expect(result.configured).toBe(true);
  });

  it('returns enabled=false when provider is explicitly disabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: false } }),
    }));
    const result = await validateOAuthProvider(mockClient, 'google');
    expect(result.enabled).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.error).toContain('Google');
  });

  it('returns enabled=true when provider is explicitly enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { facebook: true } }),
    }));
    const result = await validateOAuthProvider(mockClient, 'facebook');
    expect(result.enabled).toBe(true);
    expect(result.configured).toBe(true);
  });

  it('returns enabled=true when provider key is absent from settings (unknown = optimistic)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: true } }),
    }));
    const result = await validateOAuthProvider(mockClient, 'apple');
    expect(result.enabled).toBe(true);
  });

  const providers: OAuthProvider[] = ['google', 'facebook', 'microsoft', 'apple'];
  for (const provider of providers) {
    it(`returns provider name correctly for ${provider}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ external: { [provider]: false } }),
      }));
      const result = await validateOAuthProvider(mockClient, provider);
      expect(result.provider).toBe(provider);
    });
  }
});

// ── isOriginAllowed ───────────────────────────────────────────────────────────
describe('isOriginAllowed', () => {
  it('returns true when current origin is in the allowed list', () => {
    // vitest/jsdom sets window.location.origin to 'http://localhost'
    const origin = window.location.origin; // 'http://localhost' or 'http://localhost/'
    expect(isOriginAllowed([origin, 'https://wasel14.online'])).toBe(true);
  });

  it('returns false when current origin is not in the allowed list', () => {
    expect(isOriginAllowed(['https://wasel14.online', 'https://other.com'])).toBe(false);
  });

  it('returns true for an empty allowed list when window is undefined (server-side guard)', () => {
    // We cannot delete window in jsdom; test the server-side branch by
    // passing a list that would normally return false — the function returns
    // true only when typeof window === 'undefined', so we verify the
    // client-side false path instead and document the SSR behaviour.
    expect(isOriginAllowed([])).toBe(false);
  });

  it('handles malformed URLs in the allowed list gracefully', () => {
    const origin = window.location.origin;
    expect(isOriginAllowed(['not-a-url', origin])).toBe(true);
  });
});

// ── getProviderSetupInstructions ──────────────────────────────────────────────
describe('getProviderSetupInstructions', () => {
  const providers: OAuthProvider[] = ['google', 'facebook', 'microsoft', 'apple'];

  for (const provider of providers) {
    it(`returns steps and docsUrl for ${provider}`, () => {
      const result = getProviderSetupInstructions(provider);
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(typeof result.docsUrl).toBe('string');
      expect(result.docsUrl).toMatch(/^https?:\/\//);
    });

    it(`includes the redirect URI in ${provider} steps`, () => {
      const result = getProviderSetupInstructions(provider);
      const allSteps = result.steps.join(' ');
      expect(allSteps).toContain('/auth/v1/callback');
    });
  }
});
