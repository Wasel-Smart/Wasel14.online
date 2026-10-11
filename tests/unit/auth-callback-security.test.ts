import { describe, it, expect } from 'vitest';

/**
 * Tests for the safeReturnTo open-redirect guard in api/auth/callback.ts.
 * We extract the logic directly to test it in isolation without needing
 * a full Vercel request/response environment.
 */

const ORIGIN = 'https://www.wasel14.online';
const DEFAULT_RETURN_TO = '/app/find-ride';

function hasUnsafeRedirectChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x5c || code <= 0x1f || code === 0x7f) {return true;}
  }
  return false;
}

function safeReturnTo(value: string | null, origin: string): string {
  if (!value) {return DEFAULT_RETURN_TO;}
  if (!value.startsWith('/') || value.startsWith('//') || hasUnsafeRedirectChars(value)) {
    return DEFAULT_RETURN_TO;
  }
  // Reject dot-segment traversal before URL parsing collapses it into a
  // different same-origin path.
  if (/(^|\/)\.\.(\/|$)/.test(value)) {return DEFAULT_RETURN_TO;}
  try {
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) {return DEFAULT_RETURN_TO;}
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

function friendlyAuthError(code: string | null): string {
  switch ((code ?? '').toLowerCase()) {
    case 'access_denied': return 'Sign-in was cancelled.';
    case 'server_error':
    case 'temporarily_unavailable': return 'The sign-in provider is temporarily unavailable. Please try again.';
    default: return 'Sign-in failed. Please try again.';
  }
}

// ─── safeReturnTo ─────────────────────────────────────────────────────────────

describe('safeReturnTo — open redirect guard', () => {
  it('returns default for null', () => {
    expect(safeReturnTo(null, ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('returns default for empty string', () => {
    expect(safeReturnTo('', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('allows valid same-origin paths', () => {
    expect(safeReturnTo('/app/find-ride', ORIGIN)).toBe('/app/find-ride');
    expect(safeReturnTo('/app/packages', ORIGIN)).toBe('/app/packages');
    expect(safeReturnTo('/app/wallet?tab=top-up', ORIGIN)).toBe('/app/wallet?tab=top-up');
  });

  it('blocks protocol-relative URLs starting with //', () => {
    expect(safeReturnTo('//evil.com', ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo('//www.wasel14.online', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('blocks backslash-based open redirects', () => {
    // Browsers normalise /\evil.example → //evil.example
    expect(safeReturnTo('/\\evil.example', ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo('/\\\\evil.example', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('blocks absolute URLs to other origins', () => {
    expect(safeReturnTo('https://evil.com/steal', ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo('http://evil.com', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('blocks javascript: URIs', () => {
    expect(safeReturnTo('javascript:alert(1)', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('blocks control characters in path', () => {
    expect(safeReturnTo('/app\x00/evil', ORIGIN)).toBe(DEFAULT_RETURN_TO);
    expect(safeReturnTo('/app\x0d\x0aLocation: evil.com', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('strips query/hash from cross-origin attempts embedded in path', () => {
    // A path that resolves to a different origin after URL parsing
    expect(safeReturnTo('/app/../../../evil.com', ORIGIN)).toBe(DEFAULT_RETURN_TO);
  });

  it('preserves query string and hash for valid paths', () => {
    const result = safeReturnTo('/app/rides?from=amman&to=salt#map', ORIGIN);
    expect(result).toBe('/app/rides?from=amman&to=salt#map');
  });
});

// ─── friendlyAuthError ────────────────────────────────────────────────────────

describe('friendlyAuthError — no error text reflection', () => {
  it('maps access_denied to fixed message', () => {
    expect(friendlyAuthError('access_denied')).toBe('Sign-in was cancelled.');
  });

  it('maps server_error to fixed message', () => {
    expect(friendlyAuthError('server_error')).toBe('The sign-in provider is temporarily unavailable. Please try again.');
  });

  it('maps temporarily_unavailable to fixed message', () => {
    expect(friendlyAuthError('temporarily_unavailable')).toBe('The sign-in provider is temporarily unavailable. Please try again.');
  });

  it('maps unknown codes to generic message (no reflection)', () => {
    const phishingText = 'Your account has been suspended. Call +1-800-SCAM now.';
    expect(friendlyAuthError(phishingText)).toBe('Sign-in failed. Please try again.');
  });

  it('maps null to generic message', () => {
    expect(friendlyAuthError(null)).toBe('Sign-in failed. Please try again.');
  });

  it('is case-insensitive', () => {
    expect(friendlyAuthError('ACCESS_DENIED')).toBe('Sign-in was cancelled.');
  });
});
