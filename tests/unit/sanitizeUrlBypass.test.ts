import { describe, expect, it } from 'vitest';
import { sanitizeURL } from '../../src/utils/sanitization';

describe('sanitizeURL scheme filtering', () => {
  it('blocks plain dangerous schemes', () => {
    expect(sanitizeURL('javascript:alert(1)')).toBe('');
    expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
  });

  it('blocks schemes hidden with case, whitespace or control characters', () => {
    expect(sanitizeURL('  JaVaScRiPt:alert(1)')).toBe('');
    expect(sanitizeURL('java\tscript:alert(1)')).toBe('');
    expect(sanitizeURL('java\nscript:alert(1)')).toBe('');
    expect(sanitizeURL('\u0001javascript:alert(1)')).toBe('');
    expect(sanitizeURL('jav\u200bascript:alert(1)')).toBe('');
  });

  it('keeps ordinary http(s), relative and mailto links untouched', () => {
    expect(sanitizeURL('https://wasel14.online/app')).toBe('https://wasel14.online/app');
    expect(sanitizeURL('/app/find-ride?from=amman')).toBe('/app/find-ride?from=amman');
    expect(sanitizeURL('mailto:support@wasel14.online')).toBe('mailto:support@wasel14.online');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeURL('')).toBe('');
  });
});
