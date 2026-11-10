import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getConfig: vi.fn() }));

vi.mock('@/utils/env', () => ({
  getConfig: () => mocks.getConfig(),
}));

import {
  getFallbackConfig,
  getFallbackDeniedError,
  isFallbackAllowed,
  validateFallbackConfig,
} from '@/utils/fallbackStrategy';

function setEnv(isProd: boolean, allowDirectSupabaseFallback: boolean) {
  mocks.getConfig.mockReturnValue({ isProd, allowDirectSupabaseFallback });
}

describe('fallbackStrategy: getFallbackConfig', () => {
  beforeEach(() => {
    mocks.getConfig.mockReset();
  });

  it('disables fallback in production when the flag is off', () => {
    setEnv(true, false);
    expect(getFallbackConfig()).toEqual({
      mode: 'disabled',
      allowDirectSupabase: false,
      requireEdgeForWrites: true,
      requireEdgeForReads: true,
    });
  });

  it('only allows writes-if-enabled in production when the flag is on', () => {
    setEnv(true, true);
    const config = getFallbackConfig();
    expect(config.mode).toBe('writes-if-enabled');
    expect(config.requireEdgeForWrites).toBe(false);
    expect(config.requireEdgeForReads).toBe(true);
  });

  it('uses "always" outside production when the flag is on', () => {
    setEnv(false, true);
    expect(getFallbackConfig().mode).toBe('always');
  });

  it('uses reads-only outside production when the flag is off', () => {
    setEnv(false, false);
    const config = getFallbackConfig();
    expect(config.mode).toBe('reads-only');
    expect(config.allowDirectSupabase).toBe(true);
  });
});

describe('fallbackStrategy: isFallbackAllowed', () => {
  beforeEach(() => {
    mocks.getConfig.mockReset();
  });

  it('denies reads and writes when disabled', () => {
    setEnv(true, false);
    expect(isFallbackAllowed('read')).toBe(false);
    expect(isFallbackAllowed('write')).toBe(false);
  });

  it('allows writes but still requires the edge for reads in production', () => {
    setEnv(true, true);
    expect(isFallbackAllowed('write')).toBe(true);
    expect(isFallbackAllowed('read')).toBe(false);
  });

  it('allows everything in "always" mode', () => {
    setEnv(false, true);
    expect(isFallbackAllowed('read')).toBe(true);
    expect(isFallbackAllowed('write')).toBe(true);
  });

  it('allows reads but never writes in reads-only mode', () => {
    setEnv(false, false);
    expect(isFallbackAllowed('read')).toBe(true);
    expect(isFallbackAllowed('write')).toBe(false);
  });
});

describe('fallbackStrategy: getFallbackDeniedError', () => {
  beforeEach(() => {
    mocks.getConfig.mockReset();
  });

  it('explains that direct database access is disabled in production', () => {
    setEnv(true, false);
    const error = getFallbackDeniedError('createBooking');
    expect(error.message).toContain('createBooking');
    expect(error.message).toContain('disabled in production');
  });

  it('points developers at the env flag outside production', () => {
    setEnv(false, false);
    expect(getFallbackDeniedError('createBooking').message).toContain(
      'VITE_ALLOW_DIRECT_SUPABASE_FALLBACK',
    );
  });
});

describe('fallbackStrategy: validateFallbackConfig', () => {
  beforeEach(() => {
    mocks.getConfig.mockReset();
  });

  it('flags direct Supabase fallback in production as critical', () => {
    setEnv(true, true);
    const result = validateFallbackConfig();
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('CRITICAL');
  });

  it('is valid in production with fallback off', () => {
    setEnv(true, false);
    expect(validateFallbackConfig()).toEqual({ valid: true, warnings: [] });
  });

  it('is valid outside production even with fallback on', () => {
    setEnv(false, true);
    expect(validateFallbackConfig().valid).toBe(true);
  });
});
