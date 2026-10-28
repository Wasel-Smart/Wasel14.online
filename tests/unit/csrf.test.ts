import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCSRFHeader,
  clearCSRFToken,
  generateCSRFToken,
  getCSRFHeaderName,
  getCSRFToken,
  refreshCSRFToken,
  validateCSRFToken,
} from '../../src/utils/csrf';

describe('csrf token lifecycle', () => {
  beforeEach(() => {
    clearCSRFToken();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCSRFToken();
  });

  it('creates a token on first use and keeps returning the same one', () => {
    const first = getCSRFToken();
    expect(first).toEqual(expect.any(String));
    expect(first.length).toBeGreaterThan(0);
    expect(getCSRFToken()).toBe(first);
  });

  it('generateCSRFToken / refreshCSRFToken replace the current token', () => {
    const first = getCSRFToken();
    const second = generateCSRFToken();
    expect(second).not.toBe(first);
    expect(getCSRFToken()).toBe(second);

    const third = refreshCSRFToken();
    expect(third).not.toBe(second);
    expect(getCSRFToken()).toBe(third);
  });

  it('validates only the current token', () => {
    const token = getCSRFToken();
    expect(validateCSRFToken(token)).toBe(true);
    expect(validateCSRFToken('not-the-token')).toBe(false);
    expect(validateCSRFToken('')).toBe(false);
    // Same length, one character different: must still be rejected.
    const flipped = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    expect(validateCSRFToken(flipped)).toBe(false);
  });

  it('rejects everything once the token has been cleared (logout)', () => {
    const token = getCSRFToken();
    clearCSRFToken();
    expect(validateCSRFToken(token)).toBe(false);
  });

  it('expires after one hour: the old token stops validating and a new one is issued', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = getCSRFToken();
    expect(validateCSRFToken(token)).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T00:59:59Z'));
    expect(validateCSRFToken(token)).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T01:00:01Z'));
    expect(validateCSRFToken(token)).toBe(false);
    const renewed = getCSRFToken();
    expect(renewed).not.toBe(token);
    expect(validateCSRFToken(renewed)).toBe(true);
  });
});

describe('addCSRFHeader', () => {
  beforeEach(() => {
    clearCSRFToken();
  });

  it('exposes the header name', () => {
    expect(getCSRFHeaderName()).toBe('X-CSRF-Token');
  });

  it('adds the token to a plain header object without dropping existing headers', () => {
    const result = addCSRFHeader({ Authorization: 'Bearer x' }) as Record<string, string>;
    expect(result.Authorization).toBe('Bearer x');
    expect(result['X-CSRF-Token']).toBe(getCSRFToken());
  });

  it('adds the token to a Headers instance without mutating the original', () => {
    const original = new Headers({ 'Content-Type': 'application/json' });
    const result = addCSRFHeader(original) as Headers;
    expect(result).not.toBe(original);
    expect(result.get('X-CSRF-Token')).toBe(getCSRFToken());
    expect(result.get('Content-Type')).toBe('application/json');
    expect(original.has('X-CSRF-Token')).toBe(false);
  });

  it('adds the token to a header tuple array', () => {
    const result = addCSRFHeader([['Accept', 'application/json']]) as string[][];
    expect(result).toContainEqual(['Accept', 'application/json']);
    expect(result).toContainEqual(['X-CSRF-Token', getCSRFToken()]);
  });

  it('works with no headers at all', () => {
    const result = addCSRFHeader() as Record<string, string>;
    expect(result['X-CSRF-Token']).toBe(getCSRFToken());
  });
});
