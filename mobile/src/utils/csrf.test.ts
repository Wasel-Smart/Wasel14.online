import { CSRF_HEADER, getCsrfToken, resetCsrfTokenForTests } from './csrf';

describe('mobile csrf header helper', () => {
  beforeEach(() => resetCsrfTokenForTests());

  it('uses the header name the edge function requires', () => {
    expect(CSRF_HEADER).toBe('x-csrf-token');
  });

  it('returns a non-empty token that is stable within a session', () => {
    const first = getCsrfToken();
    expect(first.length).toBeGreaterThan(8);
    expect(getCsrfToken()).toBe(first);
  });

  it('issues a fresh token after a reset', () => {
    const first = getCsrfToken();
    resetCsrfTokenForTests();
    expect(getCsrfToken()).not.toBe(first);
  });
});
