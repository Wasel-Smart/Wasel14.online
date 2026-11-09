import { describe, expect, it } from 'vitest';
import {
  fromMinorUnits,
  normalizeAmount,
  toMinorUnits,
} from '../../src/shared/currency/currency';

describe('shared currency utilities', () => {
  it('converts JOD to and from fils', () => {
    expect(toMinorUnits(5.5, 'JOD')).toBe(5500);
    expect(fromMinorUnits(5500, 'JOD')).toBe(5.5);
  });

  it('uses two decimal places for other currencies', () => {
    expect(toMinorUnits(5.5, 'USD')).toBe(550);
    expect(fromMinorUnits(550, 'USD')).toBe(5.5);
  });

  it('normalizes only finite amounts within the supported range', () => {
    expect(normalizeAmount(50)).toBe(50);
    expect(normalizeAmount(500_000)).toBe(500_000);
    expect(normalizeAmount(49)).toBeNull();
    expect(normalizeAmount(500_001)).toBeNull();
    expect(normalizeAmount(Number.NaN)).toBeNull();
  });
});
