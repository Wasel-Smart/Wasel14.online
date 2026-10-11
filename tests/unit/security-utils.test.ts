import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCSPHeader,
  CSP_DIRECTIVES,
  checkRateLimit,
  resetRateLimit,
  checkPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  sanitizeInput,
  validateEmail,
  validatePhone,
  validateIraqPhone,
  validateJordanPhone,
  validateURL,
  isMFAEnforced,
  requireMFAForOperation,
} from '@/utils/security';

vi.mock('@/services/core', () => ({
  API_URL: 'https://api.wasel14.online',
  fetchWithRetry: vi.fn(),
  getAuthDetails: vi.fn().mockResolvedValue({ token: 'test-token' }),
}));
vi.mock('@/utils/monitoring', () => ({
  logger: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('@/utils/env', () => ({
  getConfig: vi.fn(() => ({ enableTwoFactorAuth: false, enforceTwoFactorAuth: false })),
}));

describe('CSP', () => {
  it('getCSPHeader returns a non-empty string', () => {
    const header = getCSPHeader();
    expect(typeof header).toBe('string');
    expect(header.length).toBeGreaterThan(0);
  });

  it('includes default-src self', () => {
    expect(getCSPHeader()).toContain("default-src 'self'");
  });

  it('includes object-src none', () => {
    expect(getCSPHeader()).toContain("object-src 'none'");
  });

  it('CSP_DIRECTIVES has frame-ancestors none', () => {
    expect(CSP_DIRECTIVES['frame-ancestors']).toContain("'none'");
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit('test-key');
  });

  it('allows first request', () => {
    expect(checkRateLimit('test-key')).toBe(true);
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('rl-within', { maxRequests: 10, windowMs: 60_000 })).toBe(true);
    }
  });

  it('blocks requests over limit', () => {
    for (let i = 0; i < 101; i++) {
      checkRateLimit('rl-over', { maxRequests: 100, windowMs: 60_000 });
    }
    expect(checkRateLimit('rl-over', { maxRequests: 100, windowMs: 60_000 })).toBe(false);
  });

  it('resets after resetRateLimit', () => {
    for (let i = 0; i < 101; i++) {
      checkRateLimit('rl-reset', { maxRequests: 100, windowMs: 60_000 });
    }
    resetRateLimit('rl-reset');
    expect(checkRateLimit('rl-reset', { maxRequests: 100, windowMs: 60_000 })).toBe(true);
  });

  it('different keys are independent', () => {
    for (let i = 0; i < 101; i++) {
      checkRateLimit('key-a', { maxRequests: 100, windowMs: 60_000 });
    }
    expect(checkRateLimit('key-b', { maxRequests: 100, windowMs: 60_000 })).toBe(true);
  });
});

describe('checkPasswordStrength', () => {
  it('weak short password scores 0', () => {
    const result = checkPasswordStrength('abc');
    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
  });

  it('common password is penalised', () => {
    const result = checkPasswordStrength('password123');
    expect(result.isValid).toBe(false);
  });

  it('strong password scores high', () => {
    const result = checkPasswordStrength('Tr0ub4dor&3!XyZ');
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.isValid).toBe(true);
  });

  it('repeating chars are penalised', () => {
    const result = checkPasswordStrength('aaabbbccc');
    expect(result.feedback).toContain('Avoid repeating characters');
  });

  it('feedback is an array', () => {
    const result = checkPasswordStrength('short');
    expect(Array.isArray(result.feedback)).toBe(true);
  });

  it('score is clamped to 0-4', () => {
    const result = checkPasswordStrength('Tr0ub4dor&3!XyZ');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(4);
  });
});

describe('getPasswordStrengthLabel', () => {
  it.each([
    [0, 'Very Weak'],
    [1, 'Weak'],
    [2, 'Fair'],
    [3, 'Strong'],
    [4, 'Very Strong'],
  ])('score %i → %s', (score, label) => {
    expect(getPasswordStrengthLabel(score)).toBe(label);
  });

  it('unknown score falls back to Very Weak', () => {
    expect(getPasswordStrengthLabel(99)).toBe('Very Weak');
  });
});

describe('getPasswordStrengthColor', () => {
  it('returns a hex color for each score', () => {
    for (let i = 0; i <= 4; i++) {
      expect(getPasswordStrengthColor(i)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('sanitizeInput', () => {
  it('escapes HTML entities', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
    );
  });

  it('escapes ampersand', () => {
    expect(sanitizeInput('a & b')).toBe('a &amp; b');
  });

  it('escapes single quote', () => {
    expect(sanitizeInput("it's")).toBe('it&#x27;s');
  });

  it('passes through plain text unchanged', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });
});

describe('validateEmail', () => {
  it.each(['user@example.com', 'a@b.co', 'test+tag@domain.org'])('valid: %s', email => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each(['notanemail', '@nodomain', 'missing@', 'two@@at.com'])('invalid: %s', email => {
    expect(validateEmail(email)).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts E.164 format', () => {
    expect(validatePhone('+962791234567')).toBe(true);
    expect(validatePhone('+9647001234567')).toBe(true);
  });

  it('rejects non-E.164', () => {
    expect(validatePhone('0791234567')).toBe(false);
    expect(validatePhone('phone')).toBe(false);
  });
});

describe('validateIraqPhone', () => {
  it('accepts valid Iraqi numbers', () => {
    expect(validateIraqPhone('+9647001234567')).toBe(true);
    expect(validateIraqPhone('+96401234567')).toBe(true);
  });

  it('rejects non-Iraqi numbers', () => {
    expect(validateIraqPhone('+962791234567')).toBe(false);
    expect(validateIraqPhone('+1234567890')).toBe(false);
  });
});

describe('validateJordanPhone', () => {
  it('accepts valid Jordanian numbers', () => {
    expect(validateJordanPhone('+96279123456')).toBe(true);
    expect(validateJordanPhone('+962791234567')).toBe(true);
  });

  it('rejects non-Jordanian numbers', () => {
    expect(validateJordanPhone('+9647001234567')).toBe(false);
  });
});

describe('validateURL', () => {
  it('accepts https URLs', () => {
    expect(validateURL('https://wasel14.online')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(validateURL('http://wasel14.online')).toBe(false);
  });

  it('rejects non-URLs', () => {
    expect(validateURL('not-a-url')).toBe(false);
  });
});

describe('requireMFAForOperation', () => {
  it('returns not enforced when MFA is disabled', async () => {
    const result = await requireMFAForOperation('payment');
    expect(result.enforced).toBe(false);
    expect(result.passed).toBe(true);
  });
});

describe('isMFAEnforced', () => {
  it('returns false when config disables it', () => {
    expect(isMFAEnforced()).toBe(false);
  });
});
