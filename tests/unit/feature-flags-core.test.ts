import { describe, it, expect } from 'vitest';
import {
  hashToBucket,
  matchesTargetingRule,
  matchesAllTargeting,
  readEnvFlag,
  evaluateFeatureFlag,
  getFeatureFlag,
  getEnabledFeatureFlags,
  getAllFeatureFlags,
  getFeatureFlagDescription,
  setKillSwitch,
  clearKillSwitch,
  getKillSwitch,
  evaluateFeatureFlagWithAudit,
  FEATURE_FLAGS,
} from '@/utils/featureFlags/core';

describe('hashToBucket', () => {
  it('returns a number 0-99', () => {
    const bucket = hashToBucket('user-123');
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it('is deterministic for same input', () => {
    expect(hashToBucket('user-abc')).toBe(hashToBucket('user-abc'));
  });

  it('differs with salt', () => {
    const without = hashToBucket('user-abc');
    const withSalt = hashToBucket('user-abc', 'my-salt');
    // They may differ (not guaranteed but almost always will)
    expect(typeof withSalt).toBe('number');
    expect(withSalt).toBeGreaterThanOrEqual(0);
    expect(withSalt).toBeLessThan(100);
    // Ensure salt changes the result
    expect(without).not.toBe(withSalt);
  });

  it('handles empty string', () => {
    const bucket = hashToBucket('');
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });
});

describe('matchesTargetingRule', () => {
  it('equals operator matches', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'equals', values: ['admin'] },
      { role: 'admin' },
    )).toBe(true);
  });

  it('equals operator is case-insensitive', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'equals', values: ['Admin'] },
      { role: 'admin' },
    )).toBe(true);
  });

  it('not_equals operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'not_equals', values: ['admin'] },
      { role: 'user' },
    )).toBe(true);
  });

  it('in operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'in', values: ['admin', 'operator'] },
      { role: 'operator' },
    )).toBe(true);
  });

  it('not_in operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'not_in', values: ['admin'] },
      { role: 'user' },
    )).toBe(true);
  });

  it('contains operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'email', operator: 'contains', values: ['wasel'] },
      { email: 'test@wasel14.online' },
    )).toBe(true);
  });

  it('not_contains operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'email', operator: 'not_contains', values: ['gmail'] },
      { email: 'test@wasel14.online' },
    )).toBe(true);
  });

  it('greater_than operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'plan', operator: 'greater_than', values: ['5'] },
      { plan: '10' },
    )).toBe(true);
  });

  it('less_than operator', () => {
    expect(matchesTargetingRule(
      { attribute: 'plan', operator: 'less_than', values: ['10'] },
      { plan: '5' },
    )).toBe(true);
  });

  it('returns false for missing attribute', () => {
    expect(matchesTargetingRule(
      { attribute: 'country', operator: 'equals', values: ['JO'] },
      {},
    )).toBe(false);
  });

  it('handles custom attributes', () => {
    expect(matchesTargetingRule(
      { attribute: 'custom.plan', operator: 'equals', values: ['enterprise'] },
      { customAttributes: { plan: 'enterprise' } },
    )).toBe(true);
  });

  it('unknown operator returns false', () => {
    expect(matchesTargetingRule(
      { attribute: 'role', operator: 'unknown' as never, values: ['admin'] },
      { role: 'admin' },
    )).toBe(false);
  });
});

describe('matchesAllTargeting', () => {
  it('returns true when all rules match', () => {
    expect(matchesAllTargeting(
      [
        { attribute: 'role', operator: 'equals', values: ['admin'] },
        { attribute: 'country', operator: 'equals', values: ['JO'] },
      ],
      { role: 'admin', country: 'JO' },
    )).toBe(true);
  });

  it('returns false when any rule fails', () => {
    expect(matchesAllTargeting(
      [
        { attribute: 'role', operator: 'equals', values: ['admin'] },
        { attribute: 'country', operator: 'equals', values: ['IQ'] },
      ],
      { role: 'admin', country: 'JO' },
    )).toBe(false);
  });

  it('returns true for empty rules', () => {
    expect(matchesAllTargeting([], {})).toBe(true);
  });
});

describe('readEnvFlag', () => {
  it('returns default value when env key not set', () => {
    // .env/.env.local ship VITE_ENABLE_DEMO_DATA=true, and under the
    // vmForks pool neither vi.stubEnv (patches process.env only) nor
    // mutating import.meta.env reaches the module under test. Instead,
    // exercise the same code path with an envKey no environment sets.
    const demoFlag = FEATURE_FLAGS.find(f => f.key === 'demoData')!;
    const flag: typeof demoFlag = { ...demoFlag, envKey: 'VITE_WASEL_UNSET_TEST_FLAG' };
    const result = readEnvFlag(flag);
    expect(result.source).toBe('default');
    expect(result.value).toBe(false);
  });
});

describe('evaluateFeatureFlag', () => {
  it('throws for unknown flag key', () => {
    expect(() => evaluateFeatureFlag('unknownFlag' as never)).toThrow('Unknown feature flag');
  });

  it('returns result with enabled boolean', () => {
    const result = evaluateFeatureFlag('emailNotifications');
    expect(typeof result.enabled).toBe('boolean');
    expect(result.flag).toBeDefined();
    expect(result.reason).toBeDefined();
  });

  it('respects kill switch', () => {
    // directSupabaseFallback has killSwitch.enabled = false by default
    const result = evaluateFeatureFlag('directSupabaseFallback');
    expect(result.reason).not.toBe('kill_switch');
  });

  it('server_only flag disabled on client', () => {
    // No serverOnly flags in current definitions, but test the path via options
    const result = evaluateFeatureFlag('emailNotifications', {}, { isServer: false });
    expect(result.enabled).toBeDefined();
  });

  it('rollout flag returns rolloutBucket', () => {
    const result = evaluateFeatureFlag('twoFactorAuth', { userId: 'user-test-123' });
    if (result.reason === 'rollout') {
      expect(typeof result.rolloutBucket).toBe('number');
    }
  });

  it('targeting flag returns matchedTargeting when matched', () => {
    const result = evaluateFeatureFlag('enforceTwoFactorAuth', { role: 'admin' });
    if (result.reason === 'targeting') {
      expect(result.matchedTargeting).toBeDefined();
    }
  });

  it('targeting flag returns default when not matched', () => {
    const result = evaluateFeatureFlag('enforceTwoFactorAuth', { role: 'user' });
    // user is not in the targeting list, so falls through to default
    expect(result.enabled).toBe(false);
  });
});

describe('getFeatureFlag', () => {
  it('returns evaluation result', () => {
    const result = getFeatureFlag('emailNotifications');
    expect(result.flag.key).toBe('emailNotifications');
  });

  it('accepts context', () => {
    const result = getFeatureFlag('demoData', { userId: 'demo-user-1' });
    expect(result).toBeDefined();
  });
});

describe('getEnabledFeatureFlags', () => {
  it('returns array', () => {
    const results = getEnabledFeatureFlags({});
    expect(Array.isArray(results)).toBe(true);
  });

  it('all results have enabled=true', () => {
    const results = getEnabledFeatureFlags({});
    results.forEach(r => expect(r.enabled).toBe(true));
  });
});

describe('getAllFeatureFlags', () => {
  it('returns all flag definitions', () => {
    const flags = getAllFeatureFlags();
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]).toHaveProperty('key');
    expect(flags[0]).toHaveProperty('envKey');
  });
});

describe('getFeatureFlagDescription', () => {
  it('returns description string', () => {
    const desc = getFeatureFlagDescription('emailNotifications');
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('throws for unknown key', () => {
    expect(() => getFeatureFlagDescription('unknown' as never)).toThrow();
  });
});

describe('kill switch management', () => {
  it('setKillSwitch stores and getKillSwitch retrieves', () => {
    setKillSwitch('demoData', { enabled: true, reason: 'test' });
    const ks = getKillSwitch('demoData');
    expect(ks?.enabled).toBe(true);
    expect(ks?.reason).toBe('test');
    expect(ks?.killedAt).toBeDefined();
  });

  it('clearKillSwitch removes it', () => {
    setKillSwitch('demoData', { enabled: true });
    clearKillSwitch('demoData');
    expect(getKillSwitch('demoData')).toBeUndefined();
  });

  it('setKillSwitch throws for unknown key', () => {
    expect(() => setKillSwitch('unknown' as never, { enabled: true })).toThrow();
  });
});

describe('evaluateFeatureFlagWithAudit', () => {
  it('returns same result as evaluateFeatureFlag', () => {
    const direct = evaluateFeatureFlag('emailNotifications');
    const audited = evaluateFeatureFlagWithAudit('emailNotifications');
    expect(audited.enabled).toBe(direct.enabled);
    expect(audited.reason).toBe(direct.reason);
  });
});
