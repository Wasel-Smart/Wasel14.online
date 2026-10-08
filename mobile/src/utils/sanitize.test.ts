import { isValidApiUrl, sanitizeHtml, sanitizeLogValue } from './sanitize';

describe('sanitizeLogValue', () => {
  it('stringifies null and undefined without throwing', () => {
    expect(sanitizeLogValue(null)).toBe('null');
    expect(sanitizeLogValue(undefined)).toBe('undefined');
  });

  it('replaces newlines and carriage returns to prevent log injection', () => {
    expect(sanitizeLogValue('line1\r\nFAKE LOG ENTRY')).toBe('line1  FAKE LOG ENTRY');
  });

  it('strips tabs and other control characters', () => {
    expect(sanitizeLogValue('a\tb\u0000c\u007fd')).toBe('a b c d');
  });

  it('trims surrounding whitespace and handles non-strings', () => {
    expect(sanitizeLogValue('  hello  ')).toBe('hello');
    expect(sanitizeLogValue(42)).toBe('42');
  });
});

describe('sanitizeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(sanitizeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;&#x2F;script&gt;',
    );
  });

  it('escapes ampersands, single quotes and slashes', () => {
    expect(sanitizeHtml(`Tom & Jerry's /path`)).toBe('Tom &amp; Jerry&#x27;s &#x2F;path');
  });

  it('returns an empty string for non-string input', () => {
    expect(sanitizeHtml(123 as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });
});

describe('isValidApiUrl', () => {
  it('accepts HTTPS URLs on allowed domains and their subdomains', () => {
    expect(isValidApiUrl('https://wasel14.online/v1/health')).toBe(true);
    expect(isValidApiUrl('https://api.wasel14.online/v1/trips')).toBe(true);
    expect(isValidApiUrl('https://xyz.supabase.co/functions/v1/make-server')).toBe(true);
  });

  it('accepts localhost for development, including cleartext HTTP', () => {
    expect(isValidApiUrl('http://localhost:3000/api')).toBe(true);
    expect(isValidApiUrl('https://localhost/api')).toBe(true);
  });

  it('rejects look-alike hosts that merely end with an allowed domain', () => {
    expect(isValidApiUrl('https://evilwasel14.online')).toBe(false);
    expect(isValidApiUrl('https://notsupabase.co')).toBe(false);
    expect(isValidApiUrl('https://wasel14.online.evil.com')).toBe(false);
  });

  it('rejects cleartext HTTP for non-localhost hosts', () => {
    expect(isValidApiUrl('http://wasel14.online/v1/health')).toBe(false);
  });

  it('rejects private and link-local IP ranges', () => {
    expect(isValidApiUrl('https://127.0.0.1/admin')).toBe(false);
    expect(isValidApiUrl('https://10.0.0.5/')).toBe(false);
    expect(isValidApiUrl('https://172.16.0.1/')).toBe(false);
    expect(isValidApiUrl('https://192.168.1.10/')).toBe(false);
    expect(isValidApiUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('rejects unknown domains, non-http protocols and malformed input', () => {
    expect(isValidApiUrl('https://example.com')).toBe(false);
    expect(isValidApiUrl('ftp://wasel14.online')).toBe(false);
    expect(isValidApiUrl('javascript:alert(1)')).toBe(false);
    expect(isValidApiUrl('not a url')).toBe(false);
    expect(isValidApiUrl('')).toBe(false);
  });
});
