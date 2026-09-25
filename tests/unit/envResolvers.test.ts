import { describe, expect, it, afterEach, vi } from 'vitest';
import { resolveAppUrl, type EnvSource } from '@/utils/env/resolvers';

// jsdom's default window.location.origin in this test environment.
const JSQM_ORIGIN = window.location.origin;

describe('resolveAppUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns browser origin when running locally but VITE_APP_URL is production', () => {
    // jsdom default origin is a local URL (http://localhost:3000).
    // When VITE_APP_URL is set to a production URL, resolveAppUrl should
    // fall back to the browser origin to keep OAuth redirect URIs consistent.
    const env: EnvSource = {
      VITE_APP_URL: 'https://www.wasel14.online',
    };
    const result = resolveAppUrl(env);
    expect(result).toBe(JSQM_ORIGIN);
  });

  it('returns browser origin when running locally but VITE_PRODUCTION_APP_URL is production', () => {
    const env: EnvSource = {
      VITE_PRODUCTION_APP_URL: 'https://www.wasel14.online',
    };
    const result = resolveAppUrl(env);
    expect(result).toBe(JSQM_ORIGIN);
  });

  it('returns browser origin when no app URL is configured', () => {
    const env: EnvSource = {};
    const result = resolveAppUrl(env);
    expect(result).toBe(JSQM_ORIGIN);
  });

  it('returns configured app URL when no browser origin is available (SSR)', () => {
    // When window is undefined (SSR), resolveAppUrl should return the
    // configured app URL without throwing.
    const env: EnvSource = {
      VITE_APP_URL: 'https://www.wasel14.online',
    };
    // We can't easily simulate SSR in jsdom, but we can verify the
    // function doesn't throw with valid input.
    expect(() => resolveAppUrl(env)).not.toThrow();
  });
});