import {
  validateEmail,
  validatePhone,
  validateJordanPhone,
  validateIraqPhone,
  sanitizeInput,
  sanitizeHtml,
} from '../utils/security';

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  it('rejects missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
  it('rejects null-like', () => {
    expect(validateEmail(null as unknown as string)).toBe(false);
  });
  it('rejects email over 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(validateEmail(long)).toBe(false);
  });
  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.uk')).toBe(true);
  });
});

describe('validateJordanPhone', () => {
  it('accepts Jordan mobile +962 7x', () => {
    expect(validateJordanPhone('+962791234567')).toBe(true);
  });
  it('accepts Jordan landline', () => {
    expect(validateJordanPhone('+96262123456')).toBe(true);
  });
  it('rejects non-Jordan number', () => {
    expect(validateJordanPhone('+12025551234')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateJordanPhone('')).toBe(false);
  });
  it('rejects null', () => {
    expect(validateJordanPhone(null as unknown as string)).toBe(false);
  });
});

describe('validateIraqPhone', () => {
  it('accepts Iraq mobile', () => {
    expect(validateIraqPhone('+9647901234567')).toBe(true);
  });
  it('rejects non-Iraq number', () => {
    expect(validateIraqPhone('+96279123456789')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateIraqPhone('')).toBe(false);
  });
  it('rejects null', () => {
    expect(validateIraqPhone(null as unknown as string)).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts Jordan phone', () => {
    expect(validatePhone('+962791234567')).toBe(true);
  });
  it('accepts Iraq phone', () => {
    expect(validatePhone('+9647901234567')).toBe(true);
  });
  it('rejects random number', () => {
    expect(validatePhone('+12025551234')).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });
  it('truncates to maxLength', () => {
    expect(sanitizeInput('a'.repeat(600))).toHaveLength(500);
  });
  it('respects custom maxLength', () => {
    expect(sanitizeInput('hello world', 5)).toBe('hello');
  });
  it('returns empty string for null-like', () => {
    expect(sanitizeInput(null as unknown as string)).toBe('');
  });
  it('returns empty string for empty input', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('sanitizeHtml', () => {
  it('escapes &', () => {
    expect(sanitizeHtml('a & b')).toContain('&amp;');
  });
  it('escapes <', () => {
    expect(sanitizeHtml('<script>')).toContain('&lt;');
  });
  it('escapes >', () => {
    expect(sanitizeHtml('<div>')).toContain('&gt;');
  });
  it('escapes "', () => {
    expect(sanitizeHtml('"hello"')).toContain('&quot;');
  });
  it("escapes '", () => {
    expect(sanitizeHtml("it's")).toContain('&#x27;');
  });
  it('handles clean string', () => {
    expect(sanitizeHtml('hello world')).toBe('hello world');
  });
});
