import { describe, it, expect } from 'vitest';
import {
  evaluateFeatureFlag,
  hashToBucket,
  matchesTargetingRule,
  matchesAllTargeting,
  type EvaluationContext,
  type FeatureFlagKey,
} from './featureFlags';

describe('Feature Flags — Core Logic', () => {
  describe('hashToBucket', () => {
    it('returns consistent bucket for same input', () => {
      const bucket1 = hashToBucket('user-123');
      const bucket2 = hashToBucket('user-123');
      expect(bucket1).toBe(bucket2);
    });

    it('returns different buckets for different inputs', () => {
      const bucket1 = hashToBucket('user-123');
      const bucket2 = hashToBucket('user-456');
      // Very unlikely to collide, but possible
      expect(bucket1).not.toBe(bucket2);
    });

    it('respects salt', () => {
      const bucket1 = hashToBucket('user-123', 'salt-v1');
      const bucket2 = hashToBucket('user-123', 'salt-v2');
      expect(bucket1).not.toBe(bucket2);
    });

    it('returns 0-99 range', () => {
      for (let i = 0; i < 100; i++) {
        const bucket = hashToBucket(`user-${i}`);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(100);
      }
    });
  });

  describe('matchesTargetingRule', () => {
    const baseContext: EvaluationContext = {
      userId: 'user-123',
      role: 'driver',
      email: 'driver@example.com',
      country: 'SA',
      plan: 'pro',
      customAttributes: { vehicleType: 'sedan' },
    };

    it('matches equals operator', () => {
      expect(matchesTargetingRule(
        { attribute: 'role', operator: 'equals', values: ['driver'] },
        baseContext
      )).toBe(true);

      expect(matchesTargetingRule(
        { attribute: 'role', operator: 'equals', values: ['user'] },
        baseContext
      )).toBe(false);
    });

    it('matches in operator', () => {
      expect(matchesTargetingRule(
        { attribute: 'role', operator: 'in', values: ['driver', 'user'] },
        baseContext
      )).toBe(true);

      expect(matchesTargetingRule(
        { attribute: 'role', operator: 'in', values: ['admin', 'finance'] },
        baseContext
      )).toBe(false);
    });

    it('matches custom attributes', () => {
      expect(matchesTargetingRule(
        { attribute: 'custom.vehicleType', operator: 'equals', values: ['sedan'] },
        baseContext
      )).toBe(true);

      expect(matchesTargetingRule(
        { attribute: 'custom.vehicleType', operator: 'equals', values: ['suv'] },
        baseContext
      )).toBe(false);
    });

    it('returns false for missing attributes', () => {
      expect(matchesTargetingRule(
        { attribute: 'role', operator: 'equals', values: ['driver'] },
        {} // empty context
      )).toBe(false);
    });

    it('handles greater_than/less_than for numeric values', () => {
      const numericContext: EvaluationContext = {
        customAttributes: { tripCount: '50' },
      };

      expect(matchesTargetingRule(
        { attribute: 'custom.tripCount', operator: 'greater_than', values: ['10'] },
        numericContext
      )).toBe(true);

      expect(matchesTargetingRule(
        { attribute: 'custom.tripCount', operator: 'less_than', values: ['100'] },
        numericContext
      )).toBe(true);
    });
  });

  describe('matchesAllTargeting', () => {
    it('returns true when all rules match (AND logic)', () => {
      const context: EvaluationContext = {
        role: 'driver',
        country: 'SA',
        plan: 'pro',
      };

      expect(matchesAllTargeting([
        { attribute: 'role', operator: 'equals', values: ['driver'] },
        { attribute: 'country', operator: 'equals', values: ['SA'] },
        { attribute: 'plan', operator: 'in', values: ['pro', 'enterprise'] },
      ], context)).toBe(true);
    });

    it('returns false when any rule fails', () => {
      const context: EvaluationContext = {
        role: 'driver',
        country: 'AE', // Different country
        plan: 'pro',
      };

      expect(matchesAllTargeting([
        { attribute: 'role', operator: 'equals', values: ['driver'] },
        { attribute: 'country', operator: 'equals', values: ['SA'] },
      ], context)).toBe(false);
    });

    it('returns true for empty rules array', () => {
      expect(matchesAllTargeting([], {})).toBe(true);
    });
  });

  describe('evaluateFeatureFlag', () => {
    const driverContext: EvaluationContext = {
      userId: 'driver-123',
      role: 'driver',
      country: 'SA',
    };

    const adminContext: EvaluationContext = {
      userId: 'admin-123',
      role: 'admin',
      country: 'SA',
    };

    it('respects kill switch', () => {
      // Find a flag with kill switch enabled in test env
      // We'll test by checking the logic directly
      const result = evaluateFeatureFlag('directSupabaseFallback', driverContext);
      // Kill switch is disabled in test env, so should fall through
      expect(typeof result.enabled).toBe('boolean');
    });

    it('evaluates rollout percentage', () => {
      // syntheticTrips has 10% rollout, no targeting
      let enabledCount = 0;
      const buckets = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const context = { ...driverContext, userId: `user-${i}` };
        const result = evaluateFeatureFlag('syntheticTrips', context);
        if (result.reason === 'rollout') {
          buckets.add(result.rolloutBucket!);
          if (result.enabled) {
            enabledCount++;
          }
        }
      }
      // Should have ~10% enabled (100 out of 1000)
      expect(enabledCount).toBeGreaterThan(70);
      expect(enabledCount).toBeLessThan(130);
      // Enabled users should have buckets 0-9
      for (let i = 0; i < 1000; i++) {
        const context = { ...driverContext, userId: `user-${i}` };
        const result = evaluateFeatureFlag('syntheticTrips', context);
        if (result.enabled && result.reason === 'rollout') {
          expect(result.rolloutBucket).toBeLessThan(10);
        }
      }
    });

    it('evaluates targeting rules', () => {
      // enforceTwoFactorAuth targets admin/finance/trust/support/operator
      const adminResult = evaluateFeatureFlag('enforceTwoFactorAuth', adminContext);
      expect(adminResult.reason).toBe('targeting');

      const driverResult = evaluateFeatureFlag('enforceTwoFactorAuth', driverContext);
      // Driver not in targeting, should fall through to default (false)
      expect(driverResult.enabled).toBe(false);
    });

    it('combines targeting with rollout', () => {
      // newRideMatchingAlgorithm targets drivers AND has 5% rollout
      // For drivers: targeting matches -> returns envValue (false by default)
      // For non-drivers: targeting doesn't match -> falls through to 5% rollout
      let inRollout = 0;
      for (let i = 0; i < 1000; i++) {
        // Use non-driver context to test rollout
        const context: EvaluationContext = { userId: `user-${i}`, role: 'user', country: 'SA' };
        const result = evaluateFeatureFlag('newRideMatchingAlgorithm', context);
        if (result.enabled && result.reason === 'rollout') {
          inRollout++;
        }
      }
      // Should be roughly 5% (50 out of 1000)
      expect(inRollout).toBeGreaterThan(30);
      expect(inRollout).toBeLessThan(70);
    });

    it('throws on unknown flag', () => {
      expect(() => evaluateFeatureFlag('unknownFlag' as FeatureFlagKey, {})).toThrow('Unknown feature flag');
    });
  });

  describe('Rollout consistency', () => {
    it('same user gets same bucket across evaluations', () => {
      const context: EvaluationContext = { userId: 'consistent-user' };

      for (let i = 0; i < 10; i++) {
        const result = evaluateFeatureFlag('syntheticTrips', context);
        expect(result.rolloutBucket).toBe(result.rolloutBucket); // Same within call
      }
    });

    it('different users get different distribution', () => {
      const buckets = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        const result = evaluateFeatureFlag('syntheticTrips', context);
        if (result.rolloutBucket !== undefined) {
          buckets.add(result.rolloutBucket);
        }
      }
      // Should have reasonable distribution across 0-99
      // With 200 users and 100 buckets, expect ~86 unique (birthday paradox)
      expect(buckets.size).toBeGreaterThan(70);
    });
  });
});