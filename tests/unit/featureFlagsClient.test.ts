import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock useAuth so the module can be imported without a React context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null, profile: null })),
}));

import { isFeatureEnabled, FEATURE_FLAGS } from '@/utils/featureFlags';

describe('isFeatureEnabled', () => {
  afterEach(() => {
    // Clean up window.__WASEL_AUTH__ between tests
    delete (window as unknown as Record<string, unknown>).__WASEL_AUTH__;
  });

  it('returns a boolean for every registered flag', () => {
    for (const flag of FEATURE_FLAGS) {
      const result = isFeatureEnabled(flag.key);
      expect(typeof result).toBe('boolean');
    }
  });

  it('works without window.__WASEL_AUTH__', () => {
    expect(() => isFeatureEnabled(FEATURE_FLAGS[0].key)).not.toThrow();
  });

  it('reads userId and role from window.__WASEL_AUTH__ when present', () => {
    (window as unknown as Record<string, unknown>).__WASEL_AUTH__ = {
      userId: 'user-123',
      role: 'admin',
    };
    expect(() => isFeatureEnabled(FEATURE_FLAGS[0].key)).not.toThrow();
  });

  it('handles malformed window.__WASEL_AUTH__ gracefully', () => {
    // Simulate a getter that throws
    Object.defineProperty(window, '__WASEL_AUTH__', {
      get() { throw new Error('access denied'); },
      configurable: true,
    });
    expect(() => isFeatureEnabled(FEATURE_FLAGS[0].key)).not.toThrow();
    // Restore
    delete (window as unknown as Record<string, unknown>).__WASEL_AUTH__;
  });
});

describe('FEATURE_FLAGS registry', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FEATURE_FLAGS)).toBe(true);
    expect(FEATURE_FLAGS.length).toBeGreaterThan(0);
  });

  it('every flag has a key and defaultValue', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(flag).toHaveProperty('key');
      expect(flag).toHaveProperty('defaultValue');
    }
  });
});
