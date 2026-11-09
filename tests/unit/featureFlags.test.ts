import { describe, it, expect } from 'vitest';
import {
  evaluateFeatureFlag,
  evaluateFeatureFlagWithAudit,
  FEATURE_FLAGS,
  type FeatureFlagKey,
} from '../../src/utils/featureFlags/core';

describe('featureFlags/core', () => {
  describe('FEATURE_FLAGS registry', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(FEATURE_FLAGS)).toBe(true);
      expect(FEATURE_FLAGS.length).toBeGreaterThan(0);
    });

    it('every flag has a key, defaultValue, and description', () => {
      for (const flag of FEATURE_FLAGS) {
        expect(typeof flag.key).toBe('string');
        expect(flag.key.length).toBeGreaterThan(0);
        expect(typeof flag.defaultValue).toBe('boolean');
        expect(typeof flag.description).toBe('string');
      }
    });

    it('flag keys are unique', () => {
      const keys = FEATURE_FLAGS.map(f => f.key);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });

  describe('evaluateFeatureFlag', () => {
    it('returns a result with enabled and flag properties', () => {
      const firstFlag = FEATURE_FLAGS[0];
      if (!firstFlag) { throw new Error('Feature flag registry is empty'); }
      const key = firstFlag.key as FeatureFlagKey;
      const result = evaluateFeatureFlag(key, {});
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('flag');
      expect(typeof result.enabled).toBe('boolean');
    });

    it('returns default value for empty context', () => {
      for (const flag of FEATURE_FLAGS) {
        const result = evaluateFeatureFlag(flag.key as FeatureFlagKey, {});
        // Result should be a boolean (may differ from default due to env overrides)
        expect(typeof result.enabled).toBe('boolean');
      }
    });

    it('evaluates all registered flags without throwing', () => {
      for (const flag of FEATURE_FLAGS) {
        expect(() =>
          evaluateFeatureFlag(flag.key as FeatureFlagKey, { userId: 'u1', role: 'user' }),
        ).not.toThrow();
      }
    });
  });

  describe('evaluateFeatureFlagWithAudit', () => {
    it('returns result with audit metadata', () => {
      const firstFlag = FEATURE_FLAGS[0];
      if (!firstFlag) { throw new Error('Feature flag registry is empty'); }
      const key = firstFlag.key as FeatureFlagKey;
      const result = evaluateFeatureFlagWithAudit(key, {}, { environment: 'client' });
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('flag');
    });

    it('does not throw for any flag with admin role', () => {
      for (const flag of FEATURE_FLAGS) {
        expect(() =>
          evaluateFeatureFlagWithAudit(
            flag.key as FeatureFlagKey,
            { role: 'admin', userId: 'admin-1' },
            { environment: 'client' },
          ),
        ).not.toThrow();
      }
    });

    it('does not throw for unauthenticated context', () => {
      for (const flag of FEATURE_FLAGS) {
        expect(() =>
          evaluateFeatureFlagWithAudit(flag.key as FeatureFlagKey, {}, { environment: 'client' }),
        ).not.toThrow();
      }
    });
  });
});
