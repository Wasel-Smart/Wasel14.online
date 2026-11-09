import { describe, it, expect } from 'vitest';
import { toNumber, calculateDirectPrice } from '@/shared/pricing/priceCalculator';
function getBreakdown(result: ReturnType<typeof calculateDirectPrice>) {
  const { base, distance, package: packageAmount } = result.breakdown ?? {};
  if (base === undefined || distance === undefined || packageAmount === undefined) {
    throw new Error('Price calculation did not return a complete breakdown');
  }
  return { base, distance, package: packageAmount };
}

describe('toNumber', () => {
  it('converts numeric string', () => {
    expect(toNumber('5')).toBe(5);
  });
  it('converts number', () => {
    expect(toNumber(3.14)).toBe(3.14);
  });
  it('returns fallback for NaN', () => {
    expect(toNumber('abc')).toBe(0);
  });
  it('returns fallback for undefined', () => {
    expect(toNumber(undefined)).toBe(0);
  });
  it('returns custom fallback', () => {
    expect(toNumber('bad', 99)).toBe(99);
  });
  it('returns fallback for Infinity', () => {
    expect(toNumber(Infinity)).toBe(0);
  });
  it('handles zero', () => {
    expect(toNumber(0)).toBe(0);
  });
});

describe('calculateDirectPrice — passenger', () => {
  it('calculates basic passenger price', () => {
    const r = calculateDirectPrice('passenger', undefined, 10, 2.5);
    expect(r.currency).toBe('JOD');
    expect(r.price).toBeGreaterThan(0);
    expect(getBreakdown(r).base).toBe(2.5);
    expect(getBreakdown(r).package).toBe(0);
  });

  it('uses default base price when not provided', () => {
    const r = calculateDirectPrice('passenger');
    expect(getBreakdown(r).base).toBe(2.5);
  });

  it('uses minimum distance of 1km', () => {
    const r1 = calculateDirectPrice('passenger', undefined, 0);
    const r2 = calculateDirectPrice('passenger', undefined, 1);
    expect(r1.price).toBe(r2.price);
  });

  it('uses minimum base price of 1', () => {
    const r = calculateDirectPrice('passenger', undefined, 5, 0);
    expect(getBreakdown(r).base).toBe(1);
  });

  it('distance charge is distance * 0.18 for passenger', () => {
    const r = calculateDirectPrice('passenger', undefined, 10, 2.5);
    expect(getBreakdown(r).distance).toBeCloseTo(1.8, 2);
  });

  it('price equals base + distance for passenger', () => {
    const r = calculateDirectPrice('passenger', undefined, 10, 2.5);
    expect(r.price).toBeCloseTo(getBreakdown(r).base + getBreakdown(r).distance + getBreakdown(r).package, 2);
  });
});

describe('calculateDirectPrice — package', () => {
  it('calculates basic package price', () => {
    const r = calculateDirectPrice('package', 1, 10, 3.5);
    expect(r.currency).toBe('JOD');
    expect(getBreakdown(r).base).toBe(3.5);
  });

  it('uses default base price of 3.5 for package', () => {
    const r = calculateDirectPrice('package');
    expect(getBreakdown(r).base).toBe(3.5);
  });

  it('adds package surcharge for weight over 1kg', () => {
    const r = calculateDirectPrice('package', 3, 10, 3.5);
    expect(getBreakdown(r).package).toBeCloseTo(0.7, 2);
  });

  it('no surcharge for weight <= 1kg', () => {
    const r = calculateDirectPrice('package', 0.5, 10, 3.5);
    expect(getBreakdown(r).package).toBe(0);
  });

  it('distance charge is distance * 0.22 for package', () => {
    const r = calculateDirectPrice('package', 1, 10, 3.5);
    expect(getBreakdown(r).distance).toBeCloseTo(2.2, 2);
  });

  it('price equals base + distance + package surcharge', () => {
    const r = calculateDirectPrice('package', 3, 10, 3.5);
    expect(r.price).toBeCloseTo(getBreakdown(r).base + getBreakdown(r).distance + getBreakdown(r).package, 2);
  });

  it('handles undefined weight with default 0.5kg', () => {
    const r = calculateDirectPrice('package', undefined, 10, 3.5);
    expect(getBreakdown(r).package).toBe(0);
  });
});
