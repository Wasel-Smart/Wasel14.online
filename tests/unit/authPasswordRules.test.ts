import { describe, expect, it } from 'vitest';
import { friendlyAuthError, getPasswordRuleIssue, pwStrength } from '@/utils/authHelpers';

describe('getPasswordRuleIssue', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(getPasswordRuleIssue('')).toBe('min_length');
    expect(getPasswordRuleIssue('Ab1!xyz')).toBe('min_length');
  });

  it.each([
    ['no lowercase', 'ABCDEFG1!'],
    ['no uppercase', 'abcdefg1!'],
    ['no digit', 'Abcdefgh!'],
    ['no symbol', 'Abcdefg12'],
  ])('flags %s as a requirements failure', (_label, password) => {
    expect(getPasswordRuleIssue(password)).toBe('requirements');
  });

  it('accepts a password that meets every rule', () => {
    expect(getPasswordRuleIssue('Abcdef1!')).toBeNull();
    expect(getPasswordRuleIssue('correct-Horse-battery-9')).toBeNull();
  });
});

describe('pwStrength', () => {
  it('returns an empty score for an empty password', () => {
    expect(pwStrength('')).toMatchObject({ score: 0, label: '' });
  });

  it('caps passwords under 8 characters at "Weak"', () => {
    const result = pwStrength('Ab1!');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.label).toBe('Weak');
  });

  it('never rates a password the form would reject above "Fair"', () => {
    // Long, with three character classes, but no lowercase letter.
    const rejected = 'ABCDEFGHIJKL1!';
    expect(getPasswordRuleIssue(rejected)).toBe('requirements');
    expect(pwStrength(rejected).score).toBeLessThanOrEqual(2);
  });

  it('rates a minimal valid password "Strong" and a 12+ character one "Excellent"', () => {
    expect(getPasswordRuleIssue('Abcdef1!')).toBeNull();
    expect(pwStrength('Abcdef1!').label).toBe('Strong');
    expect(pwStrength('Abcdefghij1!').label).toBe('Excellent');
  });

  it('scores anything that passes the rules at least "Strong"', () => {
    for (const password of ['Abcdef1!', 'Zx9$kLmn', 'Passw0rd!x']) {
      expect(getPasswordRuleIssue(password)).toBeNull();
      expect(pwStrength(password).score).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('friendlyAuthError', () => {
  it('maps Supabase invalid-credentials messages to a friendly string', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'), 'fallback')).toBe(
      'Incorrect email or password.',
    );
  });

  it('maps by error code when the message text is unfamiliar', () => {
    expect(friendlyAuthError({ code: 'email_exists', message: 'boom' }, 'fallback')).toBe(
      'This email is already registered.',
    );
  });

  it('maps weak_password by code', () => {
    expect(friendlyAuthError(new Error('nope'), 'fallback', 'weak_password')).toBe(
      'Password is too weak. Please choose a stronger password.',
    );
  });

  it('passes unknown messages through and uses the fallback when there is none', () => {
    expect(friendlyAuthError(new Error('Something exotic'), 'fallback')).toBe('Something exotic');
    expect(friendlyAuthError(undefined, 'fallback')).toBe('fallback');
  });
});
