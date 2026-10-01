import { describe, expect, it } from 'vitest';
import {
  TRUST_SCORE_MAX,
  deriveAccountTrustScore,
  deriveAccountTrustScoreFactors,
} from '../../src/domain/trust/score';

/**
 * The Trust Center breakdown used to render six hardcoded factors (45+10+10+15+
 * 20+10 = 110) at 100% for every user, under a "Max: 100" header. These
 * assertions pin the breakdown to the score it explains, so a fabricated
 * breakdown cannot come back.
 */
describe('deriveAccountTrustScoreFactors', () => {
  it('adds up to exactly the score the mapper returns', () => {
    const inputs = [
      {},
      { emailVerified: true },
      { emailVerified: true, phoneVerified: true },
      { emailVerified: true, phoneVerified: true, trips: 7, rating: 4.2 },
      { trips: 500, rating: 5 },
    ];

    for (const input of inputs) {
      const total = deriveAccountTrustScoreFactors(input).reduce(
        (sum, factor) => sum + factor.value,
        0,
      );
      const uncapped = Math.min(TRUST_SCORE_MAX, Math.round(total));

      expect(deriveAccountTrustScore(input)).toBe(uncapped);
    }
  });

  it('reports zero for verification factors the account has not earned', () => {
    const byKey = Object.fromEntries(
      deriveAccountTrustScoreFactors({ emailVerified: false, phoneVerified: false }).map(
        factor => [factor.key, factor],
      ),
    );

    expect(byKey.email?.value).toBe(0);
    expect(byKey.phone?.value).toBe(0);
    expect(byKey.both?.value).toBe(0);
    expect(byKey.base?.value).toBe(45);
  });

  it('caps trips and rating at their own maximums', () => {
    const byKey = Object.fromEntries(
      deriveAccountTrustScoreFactors({ trips: 500, rating: 5 }).map(factor => [
        factor.key,
        factor,
      ]),
    );

    expect(byKey.trips?.value).toBe(20);
    expect(byKey.rating?.value).toBe(10);
  });

  it('never lets a factor exceed its declared maximum', () => {
    for (const factor of deriveAccountTrustScoreFactors({
      emailVerified: true,
      phoneVerified: true,
      trips: 50,
      rating: 5,
    })) {
      expect(factor.value).toBeLessThanOrEqual(factor.max);
      expect(factor.max).toBeGreaterThan(0);
    }
  });

  it('keeps the score capped at the documented maximum', () => {
    expect(deriveAccountTrustScore({ emailVerified: true, phoneVerified: true, trips: 50, rating: 5 })).toBe(
      TRUST_SCORE_MAX,
    );
  });
});