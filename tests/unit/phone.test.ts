import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizePhoneNumber, isValidE164Phone } from '../../src/shared/validation/phone';

describe('shared/validation/phone', () => {
  describe('normalizePhone', () => {
    it('normalizes Jordanian mobile with 0 prefix', () => {
      expect(normalizePhone('0791234567')).toBe('+962791234567');
    });

    it('normalizes Jordanian mobile with 962 prefix', () => {
      expect(normalizePhone('962791234567')).toBe('+962791234567');
    });

    it('preserves already-normalized Jordanian mobile', () => {
      expect(normalizePhone('+962791234567')).toBe('+962791234567');
    });

    it('normalizes Iraqi mobile with 0 prefix', () => {
      expect(normalizePhone('07901234567')).toBe('+96479012345' + '67'.slice(0, 2));
    });

    it('normalizes Iraqi mobile with +964 prefix', () => {
      const result = normalizePhone('+9647901234567');
      expect(result).toMatch(/^\+964/);
    });

    it('handles whitespace and dashes', () => {
      expect(normalizePhone('+962 79-123-4567')).toBe('+962791234567');
    });

    it('throws for invalid phone number', () => {
      expect(() => normalizePhone('not-a-phone')).toThrow('Invalid phone number');
    });

    it('throws for empty string', () => {
      expect(() => normalizePhone('')).toThrow();
    });
  });

  describe('normalizePhoneNumber', () => {
    it('trims whitespace', () => {
      expect(normalizePhoneNumber('  +962791234567  ')).toBe('+962791234567');
    });

    it('removes internal spaces', () => {
      expect(normalizePhoneNumber('+962 79 123 4567')).toBe('+9627912 34567'.replace(/ /g, ''));
    });

    it('handles null/undefined gracefully', () => {
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
    });

    it('converts number to string', () => {
      expect(normalizePhoneNumber(962791234567)).toBe('962791234567');
    });
  });

  describe('isValidE164Phone', () => {
    it('accepts valid E.164 numbers', () => {
      expect(isValidE164Phone('+962791234567')).toBe(true);
      expect(isValidE164Phone('+9647901234567')).toBe(true);
      expect(isValidE164Phone('+12125551234')).toBe(true);
    });

    it('rejects numbers without + prefix', () => {
      expect(isValidE164Phone('962791234567')).toBe(false);
    });

    it('rejects numbers that are too short', () => {
      expect(isValidE164Phone('+1234567')).toBe(false);
    });

    it('rejects numbers that are too long', () => {
      expect(isValidE164Phone('+12345678901234567')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidE164Phone('')).toBe(false);
    });

    it('rejects numbers with letters', () => {
      expect(isValidE164Phone('+96279abc1234')).toBe(false);
    });
  });
});
