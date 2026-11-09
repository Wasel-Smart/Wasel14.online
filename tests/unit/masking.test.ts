import { describe, it, expect } from 'vitest';
import { maskPhoneNumber, maskCustomerName } from '../../src/shared/privacy/masking';

describe('shared/privacy/masking', () => {
  describe('maskPhoneNumber', () => {
    it('masks middle digits of a Jordanian number', () => {
      const masked = maskPhoneNumber('0791234567');
      expect(masked).toBe('079***4567');
    });

    it('masks international format', () => {
      const masked = maskPhoneNumber('+962791234567');
      expect(masked).toContain('***');
      expect(masked).not.toBe('+962791234567');
    });

    it('returns *** for empty string', () => {
      expect(maskPhoneNumber('')).toBe('***');
    });

    it('returns *** for null/undefined', () => {
      expect(maskPhoneNumber(null as unknown as string)).toBe('***');
      expect(maskPhoneNumber(undefined as unknown as string)).toBe('***');
    });

    it('returns *** for short numbers (<=6 chars)', () => {
      expect(maskPhoneNumber('12345')).toBe('***');
    });

    it('preserves first 3 and last 4 characters', () => {
      const masked = maskPhoneNumber('0791234567');
      expect(masked.startsWith('079')).toBe(true);
      expect(masked.endsWith('4567')).toBe(true);
    });
  });

  describe('maskCustomerName', () => {
    it('abbreviates last name', () => {
      expect(maskCustomerName('Ahmad Al-Khalil')).toBe('Ahmad A.');
    });

    it('returns single name unchanged', () => {
      expect(maskCustomerName('Ahmad')).toBe('Ahmad');
    });

    it('handles multiple spaces', () => {
      const result = maskCustomerName('John   Doe');
      expect(result).toBe('John D.');
    });

    it('returns Customer for empty string', () => {
      expect(maskCustomerName('')).toBe('Customer');
    });

    it('returns Customer for null/undefined', () => {
      expect(maskCustomerName(null as unknown as string)).toBe('Customer');
    });

    it('uppercases the initial of last name', () => {
      const result = maskCustomerName('sara smith');
      expect(result).toContain('S.');
    });
  });
});
