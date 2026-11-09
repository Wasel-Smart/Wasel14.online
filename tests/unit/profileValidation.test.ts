import { describe, it, expect } from 'vitest';
import {
  profileValidationSchemas,
  validateProfileField,
  normalizePhoneNumber,
} from '@/utils/profileValidation';

describe('profileValidationSchemas.name', () => {
  it('accepts valid name', () => {
    expect(profileValidationSchemas.name.safeParse('Ahmad Ali').success).toBe(true);
  });
  it('trims whitespace', () => {
    const r = profileValidationSchemas.name.safeParse('  Ahmad  ');
    expect(r.success && r.data).toBe('Ahmad');
  });
  it('accepts Arabic name', () => {
    expect(profileValidationSchemas.name.safeParse('أحمد علي').success).toBe(true);
  });
  it('rejects single char', () => {
    expect(profileValidationSchemas.name.safeParse('A').success).toBe(false);
  });
  it('rejects name with digits', () => {
    expect(profileValidationSchemas.name.safeParse('Ahmad123').success).toBe(false);
  });
  it('rejects name over 60 chars', () => {
    expect(profileValidationSchemas.name.safeParse('A'.repeat(61)).success).toBe(false);
  });
});

describe('profileValidationSchemas.phone', () => {
  it('accepts Jordan +962 format', () => {
    expect(profileValidationSchemas.phone.safeParse('+96279123456789').success).toBe(true);
  });
  it('accepts international format', () => {
    expect(profileValidationSchemas.phone.safeParse('+12025551234').success).toBe(true);
  });
  it('rejects plain digits', () => {
    expect(profileValidationSchemas.phone.safeParse('0791234567').success).toBe(false);
  });
  it('rejects letters', () => {
    expect(profileValidationSchemas.phone.safeParse('abc').success).toBe(false);
  });
});

describe('profileValidationSchemas.email', () => {
  it('accepts valid email', () => {
    expect(profileValidationSchemas.email.safeParse('user@example.com').success).toBe(true);
  });
  it('lowercases and trims', () => {
    const r = profileValidationSchemas.email.safeParse('  USER@EXAMPLE.COM  ');
    expect(r.success && r.data).toBe('user@example.com');
  });
  it('rejects invalid email', () => {
    expect(profileValidationSchemas.email.safeParse('not-email').success).toBe(false);
  });
  it('rejects email over 255 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(profileValidationSchemas.email.safeParse(long).success).toBe(false);
  });
});

describe('profileValidationSchemas.avatar', () => {
  it('accepts valid image', () => {
    expect(
      profileValidationSchemas.avatar.safeParse({ size: 1024 * 1024, type: 'image/jpeg' }).success,
    ).toBe(true);
  });
  it('rejects oversized image', () => {
    expect(
      profileValidationSchemas.avatar.safeParse({ size: 3 * 1024 * 1024, type: 'image/jpeg' }).success,
    ).toBe(false);
  });
  it('rejects invalid type', () => {
    expect(
      profileValidationSchemas.avatar.safeParse({ size: 1024, type: 'image/bmp' }).success,
    ).toBe(false);
  });
  it('accepts webp', () => {
    expect(
      profileValidationSchemas.avatar.safeParse({ size: 500, type: 'image/webp' }).success,
    ).toBe(true);
  });
  it('accepts gif', () => {
    expect(
      profileValidationSchemas.avatar.safeParse({ size: 500, type: 'image/gif' }).success,
    ).toBe(true);
  });
});

describe('validateProfileField', () => {
  it('returns success with data on valid input', () => {
    const r = validateProfileField(profileValidationSchemas.name, 'Ahmad');
    expect(r.success).toBe(true);
    if (r.success) {expect(r.data).toBe('Ahmad');}
  });
  it('returns error message on invalid input', () => {
    const r = validateProfileField(profileValidationSchemas.name, 'A');
    expect(r.success).toBe(false);
    if (!r.success) {expect(r.error).toBeTruthy();}
  });
  it('handles non-ZodError gracefully', () => {
    // Pass a schema that throws a non-ZodError
    const badSchema = {
      parse: () => { throw new Error('unexpected'); },
    } as never;
    const r = validateProfileField(badSchema, 'anything');
    expect(r.success).toBe(false);
    if (!r.success) {expect(r.error).toBe('Validation failed');}
  });
});

describe('normalizePhoneNumber', () => {
  it('normalizes Jordan 07x number', () => {
    expect(normalizePhoneNumber('0791234567')).toBe('+9620791234567');
  });
  it('normalizes Jordan 077 number', () => {
    expect(normalizePhoneNumber('0771234567')).toBe('+9620771234567');
  });
  it('normalizes Jordan 078 number', () => {
    expect(normalizePhoneNumber('0781234567')).toBe('+9620781234567');
  });
  it('returns number with + as-is', () => {
    expect(normalizePhoneNumber('+962791234567')).toBe('+962791234567');
  });
  it('adds + to plain international digits', () => {
    expect(normalizePhoneNumber('12025551234')).toBe('+12025551234');
  });
  it('strips spaces and dashes', () => {
    expect(normalizePhoneNumber('+962 79-123-4567')).toBe('+962791234567');
  });
  it('returns null for unrecognized format', () => {
    expect(normalizePhoneNumber('abc')).toBeNull();
  });
  it('returns null for short number', () => {
    expect(normalizePhoneNumber('123')).toBeNull();
  });
});
