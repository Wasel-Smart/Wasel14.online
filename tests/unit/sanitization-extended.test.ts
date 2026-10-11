import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeEventPayload,
  validateApiUrl,
  sanitizeHtml,
  sanitizeLogMessage,
  sanitizeURL,
  sanitizePhone,
  sanitizeEmail,
  sanitizeSearchQuery,
  sanitizeFilename,
  sanitizeNumber,
  sanitizeObject,
  escapeRegExp,
  safeJSONParse,
  stripHTML,
  sanitizeMarkdown,
  sanitizeForLog,
  sanitizeForHTML,
  sanitizeTrackingId,
  sanitizeArabicText,
  isValidPersonName,
  sanitizeNumericString,
  isValidURL,
} from '@/utils/sanitization';

// ─── sanitizeString ───────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  it('removes control characters', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
    expect(sanitizeString('line\nbreak')).toBe('linebreak');
    expect(sanitizeString('tab\there')).toBe('tabhere');
  });

  it('preserves printable ASCII', () => {
    expect(sanitizeString('Hello World 123!')).toBe('Hello World 123!');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(123 as unknown as string)).toBe('');
    expect(sanitizeString(null as unknown as string)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });
});

// ─── sanitizeEventPayload ─────────────────────────────────────────────────────

describe('sanitizeEventPayload', () => {
  it('sanitizes string values', () => {
    const result = sanitizeEventPayload({ msg: 'hello\x00world' });
    expect(result.msg).toBe('helloworld');
  });

  it('recursively sanitizes nested objects', () => {
    const result = sanitizeEventPayload({ nested: { msg: 'bad\x01char' } });
    expect((result.nested as Record<string, string>).msg).toBe('badchar');
  });

  it('preserves non-string values', () => {
    const result = sanitizeEventPayload({ count: 42, flag: true });
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
  });
});

// ─── validateApiUrl ───────────────────────────────────────────────────────────

describe('validateApiUrl', () => {
  it('accepts HTTPS URLs on allowed domains', () => {
    expect(validateApiUrl('https://api.example.com/v1', ['example.com'])).toBe(true);
  });

  it('accepts subdomains of allowed domains', () => {
    expect(validateApiUrl('https://sub.example.com', ['example.com'])).toBe(true);
  });

  it('rejects HTTP on non-localhost', () => {
    expect(validateApiUrl('http://api.example.com', ['example.com'])).toBe(false);
  });

  it('rejects private IP ranges', () => {
    expect(validateApiUrl('https://10.0.0.1/api', ['10.0.0.1'])).toBe(false);
    expect(validateApiUrl('https://192.168.1.1/api', ['192.168.1.1'])).toBe(false);
    expect(validateApiUrl('https://172.16.0.1/api', ['172.16.0.1'])).toBe(false);
  });

  it('rejects domains not in allowlist', () => {
    expect(validateApiUrl('https://evil.com', ['example.com'])).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(validateApiUrl('not-a-url', ['example.com'])).toBe(false);
  });

  it('allows localhost with HTTP', () => {
    expect(validateApiUrl('http://localhost:3000', ['localhost'])).toBe(true);
  });
});

// ─── sanitizeHtml ─────────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  it('encodes all dangerous characters', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('encodes ampersand', () => {
    expect(sanitizeHtml('a&b')).toBe('a&amp;b');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles non-string input', () => {
    expect(sanitizeHtml(null as unknown as string)).toBe('');
  });
});

// ─── sanitizeLogMessage ───────────────────────────────────────────────────────

describe('sanitizeLogMessage', () => {
  it('removes newlines to prevent log injection', () => {
    expect(sanitizeLogMessage('line1\nline2')).not.toContain('\n');
  });

  it('removes carriage returns', () => {
    expect(sanitizeLogMessage('line1\rline2')).not.toContain('\r');
  });

  it('handles null and undefined', () => {
    expect(sanitizeLogMessage(null)).toBe('null');
    expect(sanitizeLogMessage(undefined)).toBe('undefined');
  });

  it('handles Error objects', () => {
    const result = sanitizeLogMessage(new Error('test error'));
    expect(typeof result).toBe('string');
  });

  it('handles objects', () => {
    const result = sanitizeLogMessage({ key: 'value' });
    expect(typeof result).toBe('string');
  });
});

// ─── sanitizeURL ─────────────────────────────────────────────────────────────

describe('sanitizeURL', () => {
  it('blocks javascript: protocol', () => {
    expect(sanitizeURL('javascript:alert(1)')).toBe('');
  });

  it('blocks data: protocol', () => {
    expect(sanitizeURL('data:text/html,<h1>xss</h1>')).toBe('');
  });

  it('blocks vbscript: protocol', () => {
    expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
  });

  it('allows https URLs', () => {
    expect(sanitizeURL('https://example.com')).toBe('https://example.com');
  });

  it('returns empty for empty input', () => {
    expect(sanitizeURL('')).toBe('');
  });
});

// ─── sanitizePhone ────────────────────────────────────────────────────────────

describe('sanitizePhone', () => {
  it('removes non-numeric characters except leading +', () => {
    expect(sanitizePhone('+962 79 123 4567')).toBe('+962791234567');
    expect(sanitizePhone('(962) 79-123-4567')).toBe('962791234567');
  });

  it('handles empty string', () => {
    expect(sanitizePhone('')).toBe('');
  });

  it('removes extra + signs', () => {
    expect(sanitizePhone('+962+79')).toBe('+96279');
  });
});

// ─── sanitizeEmail ────────────────────────────────────────────────────────────

describe('sanitizeEmail', () => {
  it('trims and lowercases', () => {
    expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('handles empty string', () => {
    expect(sanitizeEmail('')).toBe('');
  });
});

// ─── sanitizeSearchQuery ──────────────────────────────────────────────────────

describe('sanitizeSearchQuery', () => {
  it('removes angle brackets', () => {
    expect(sanitizeSearchQuery('<script>')).not.toContain('<');
    expect(sanitizeSearchQuery('<script>')).not.toContain('>');
  });

  it('normalizes whitespace', () => {
    expect(sanitizeSearchQuery('  hello   world  ')).toBe('hello world');
  });

  it('limits to 200 characters', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeSearchQuery(long).length).toBeLessThanOrEqual(200);
  });

  it('handles empty string', () => {
    expect(sanitizeSearchQuery('')).toBe('');
  });
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('removes path traversal characters', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('..');
  });

  it('limits to 255 characters', () => {
    const long = 'a'.repeat(300) + '.txt';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });

  it('preserves safe filenames', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
  });

  it('prefixes dot-files to prevent hidden files', () => {
    expect(sanitizeFilename('.hidden')).toMatch(/^_/);
  });
});

// ─── sanitizeNumber ───────────────────────────────────────────────────────────

describe('sanitizeNumber', () => {
  it('removes non-numeric characters', () => {
    expect(sanitizeNumber('$1,234.56')).toBe('1234.56');
  });

  it('preserves decimal point', () => {
    expect(sanitizeNumber('3.14')).toBe('3.14');
  });

  it('handles empty string', () => {
    expect(sanitizeNumber('')).toBe('');
  });
});

// ─── sanitizeObject ───────────────────────────────────────────────────────────

describe('sanitizeObject', () => {
  it('sanitizes string values', () => {
    const result = sanitizeObject({ name: '<script>alert(1)</script>' });
    expect(result.name).not.toContain('<script>');
  });

  it('handles nested objects', () => {
    const result = sanitizeObject({ user: { name: '<b>bold</b>' } });
    expect((result.user as Record<string, string>).name).not.toContain('<b>');
  });

  it('preserves non-string values', () => {
    const result = sanitizeObject({ count: 42, active: true });
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });
});

// ─── escapeRegExp ─────────────────────────────────────────────────────────────

describe('escapeRegExp', () => {
  it('escapes special regex characters', () => {
    const escaped = escapeRegExp('a.b*c+d?e(f)g[h]i{j}k^l$m|n\\o');
    expect(() => new RegExp(escaped)).not.toThrow();
  });

  it('handles empty string', () => {
    expect(escapeRegExp('')).toBe('');
  });

  it('leaves alphanumeric unchanged', () => {
    expect(escapeRegExp('abc123')).toBe('abc123');
  });
});

// ─── safeJSONParse ────────────────────────────────────────────────────────────

describe('safeJSONParse', () => {
  it('parses valid JSON', () => {
    expect(safeJSONParse('{"key":"value"}', null)).toEqual({ key: 'value' });
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJSONParse('not json', 'fallback')).toBe('fallback');
  });

  it('returns fallback for empty string', () => {
    expect(safeJSONParse('', null)).toBeNull();
  });
});

// ─── stripHTML ────────────────────────────────────────────────────────────────

describe('stripHTML', () => {
  it('removes HTML tags', () => {
    expect(stripHTML('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('decodes HTML entities', () => {
    expect(stripHTML('&amp; &lt; &gt;')).toBe('& < >');
  });

  it('handles empty string', () => {
    expect(stripHTML('')).toBe('');
  });
});

// ─── sanitizeMarkdown ─────────────────────────────────────────────────────────

describe('sanitizeMarkdown', () => {
  it('removes javascript: links', () => {
    const result = sanitizeMarkdown('[click](javascript:alert(1))');
    expect(result).not.toContain('javascript:');
  });

  it('removes data: links', () => {
    const result = sanitizeMarkdown('[img](data:text/html,xss)');
    expect(result).not.toContain('data:');
  });

  it('preserves safe markdown', () => {
    const md = '# Hello\n\nThis is **bold** text.';
    expect(sanitizeMarkdown(md)).toContain('Hello');
  });
});

// ─── sanitizeForLog ───────────────────────────────────────────────────────────

describe('sanitizeForLog', () => {
  it('removes control characters', () => {
    expect(sanitizeForLog('line\nbreak')).not.toContain('\n');
  });

  it('handles null and undefined', () => {
    expect(sanitizeForLog(null)).toBe('');
    expect(sanitizeForLog(undefined)).toBe('');
  });
});

// ─── sanitizeForHTML ──────────────────────────────────────────────────────────

describe('sanitizeForHTML', () => {
  it('encodes all dangerous characters', () => {
    const result = sanitizeForHTML('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('handles null and undefined', () => {
    expect(sanitizeForHTML(null)).toBe('');
    expect(sanitizeForHTML(undefined)).toBe('');
  });
});

// ─── sanitizeTrackingId ───────────────────────────────────────────────────────

describe('sanitizeTrackingId', () => {
  it('allows alphanumeric, hyphens, underscores', () => {
    expect(sanitizeTrackingId('PKG-123_ABC')).toBe('PKG-123_ABC');
  });

  it('removes special characters', () => {
    expect(sanitizeTrackingId('PKG<123>!@#')).toBe('PKG123');
  });
});

// ─── sanitizeArabicText ───────────────────────────────────────────────────────

describe('sanitizeArabicText', () => {
  it('preserves Arabic text', () => {
    const arabic = 'مرحبا بالعالم';
    expect(sanitizeArabicText(arabic)).toContain('مرحبا');
  });

  it('removes dangerous HTML characters', () => {
    expect(sanitizeArabicText('<script>')).not.toContain('<');
  });

  it('limits to 500 characters', () => {
    const long = 'أ'.repeat(600);
    expect(sanitizeArabicText(long).length).toBeLessThanOrEqual(500);
  });

  it('handles null and undefined', () => {
    expect(sanitizeArabicText(null)).toBe('');
    expect(sanitizeArabicText(undefined)).toBe('');
  });
});

// ─── isValidPersonName ────────────────────────────────────────────────────────

describe('isValidPersonName', () => {
  it('accepts Latin names', () => {
    expect(isValidPersonName('John Doe')).toBe(true);
    expect(isValidPersonName('Mary-Jane Watson')).toBe(true);
  });

  it('accepts Arabic names', () => {
    expect(isValidPersonName('محمد علي')).toBe(true);
  });

  it('rejects names that are too short', () => {
    expect(isValidPersonName('A')).toBe(false);
  });

  it('rejects names with numbers', () => {
    expect(isValidPersonName('John123')).toBe(false);
  });
});

// ─── sanitizeNumericString ────────────────────────────────────────────────────

describe('sanitizeNumericString', () => {
  it('allows digits, decimal, and minus', () => {
    expect(sanitizeNumericString('-3.14')).toBe('-3.14');
    expect(sanitizeNumericString('1234')).toBe('1234');
  });

  it('removes non-numeric characters', () => {
    expect(sanitizeNumericString('$1,234.56')).toBe('1234.56');
  });
});

// ─── isValidURL ───────────────────────────────────────────────────────────────

describe('isValidURL', () => {
  it('accepts HTTPS URLs on allowed domains', () => {
    expect(isValidURL('https://api.example.com', ['example.com'])).toBe(true);
  });

  it('rejects private IP ranges', () => {
    expect(isValidURL('https://10.0.0.1', ['10.0.0.1'])).toBe(false);
    expect(isValidURL('https://192.168.1.1', ['192.168.1.1'])).toBe(false);
  });

  it('rejects localhost', () => {
    expect(isValidURL('https://localhost', ['localhost'])).toBe(false);
  });

  it('rejects domains not in allowlist', () => {
    expect(isValidURL('https://evil.com', ['example.com'])).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isValidURL('not-a-url', ['example.com'])).toBe(false);
  });
});
