import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Module mocks (hoisted before imports) ────────────────────────────────────

vi.mock('../core', () => ({
  API_URL: 'https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071',
  publicAnonKey: 'sb_publishable_test_key',
  createEdgeHeaders: vi.fn(() => new Headers()),
  fetchWithRetry: vi.fn(),
  getAuthDetails: vi.fn(),
}));

vi.mock('../../utils/env', () => ({
  getConfig: vi.fn(() => ({ allowedApiDomain: 'wasel14.online' })),
}));

vi.mock('../../utils/sanitization', () => ({
  validateApiUrl: vi.fn(() => true),
}));

vi.mock('../../utils/fallbackStrategy', () => ({
  isFallbackAllowed: vi.fn(() => true),
  logFallbackUsage: vi.fn(),
  getFallbackDeniedError: vi.fn((op: string) => new Error(`${op} fallback denied`)),
}));

vi.mock('../../utils/circuitBreaker', () => ({
  isCircuitBreakerOpenError: vi.fn(() => false),
}));

import {
  BackendRequestError,
  hasConfiguredEdgeTransport,
  isRecoverableError,
  requestEdgeJson,
  runBackendWorkflow,
  getSecureBackendFallbackError,
} from '../backendWorkflow';
import { fetchWithRetry, getAuthDetails } from '../core';
import { isFallbackAllowed } from '../../utils/fallbackStrategy';
import { isCircuitBreakerOpenError } from '../../utils/circuitBreaker';

const mockFetch = vi.mocked(fetchWithRetry);
const mockGetAuth = vi.mocked(getAuthDetails);
const mockFallbackAllowed = vi.mocked(isFallbackAllowed);
const mockCircuitOpen = vi.mocked(isCircuitBreakerOpenError);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOkResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── BackendRequestError ───────────────────────────────────────────────────────

describe('BackendRequestError', () => {
  it('sets name, message, status, and recoverable', () => {
    const err = new BackendRequestError('test error', { status: 503, recoverable: true });
    expect(err.name).toBe('BackendRequestError');
    expect(err.message).toBe('test error');
    expect(err.status).toBe(503);
    expect(err.recoverable).toBe(true);
  });

  it('defaults recoverable to false', () => {
    const err = new BackendRequestError('oops');
    expect(err.recoverable).toBe(false);
    expect(err.status).toBeUndefined();
  });

  it('is instanceof Error', () => {
    expect(new BackendRequestError('x')).toBeInstanceOf(Error);
  });
});

// ── hasConfiguredEdgeTransport ────────────────────────────────────────────────

describe('hasConfiguredEdgeTransport', () => {
  it('returns true when API_URL is set (default mode)', () => {
    expect(hasConfiguredEdgeTransport()).toBe(true);
  });

  it('returns true for public mode when anonKey is present', () => {
    expect(hasConfiguredEdgeTransport('public')).toBe(true);
  });

  it('returns true for required mode', () => {
    expect(hasConfiguredEdgeTransport('required')).toBe(true);
  });
});

// ── getSecureBackendFallbackError ─────────────────────────────────────────────

describe('getSecureBackendFallbackError', () => {
  it('returns an Error with the operation name in the message', () => {
    const err = getSecureBackendFallbackError('processPayment');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('processPayment');
  });
});

// ── isRecoverableError ────────────────────────────────────────────────────────

describe('isRecoverableError', () => {
  it('returns true for BackendRequestError with recoverable=true', () => {
    expect(isRecoverableError(new BackendRequestError('x', { recoverable: true }))).toBe(true);
  });

  it('returns false for BackendRequestError with recoverable=false', () => {
    expect(isRecoverableError(new BackendRequestError('x', { recoverable: false }))).toBe(false);
  });

  it('returns true for 401 BackendRequestError regardless of recoverable flag', () => {
    expect(isRecoverableError(new BackendRequestError('unauth', { status: 401, recoverable: false }))).toBe(true);
  });

  it('returns true for TypeError (network failure)', () => {
    expect(isRecoverableError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns true for AbortError DOMException', () => {
    const abort = new DOMException('aborted', 'AbortError');
    expect(isRecoverableError(abort)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isRecoverableError(new Error('generic'))).toBe(false);
  });

  it('returns true when circuit breaker is open', () => {
    mockCircuitOpen.mockReturnValueOnce(true);
    expect(isRecoverableError(new Error('Circuit breaker api-calls is OPEN'))).toBe(true);
  });
});

// ── requestEdgeJson ───────────────────────────────────────────────────────────

describe('requestEdgeJson', () => {
  beforeEach(() => {
    mockGetAuth.mockResolvedValue({ token: 'tok_test', userId: 'user-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON on 200', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 'trip-1' }));
    const result = await requestEdgeJson({ path: '/trips', operation: 'getTrips' });
    expect(result).toEqual({ id: 'trip-1' });
  });

  it('returns undefined on 204', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await requestEdgeJson({ path: '/trips/1', operation: 'deleteTrip', method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws BackendRequestError on 4xx with error payload', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({ error: 'Not found' }, 404));
    await expect(requestEdgeJson({ path: '/trips/x', operation: 'getTrip' }))
      .rejects.toMatchObject({ name: 'BackendRequestError', message: 'Not found', status: 404 });
  });

  it('throws BackendRequestError on 500 with recoverable=true', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({ error: 'Internal error' }, 500));
    await expect(requestEdgeJson({ path: '/trips', operation: 'getTrips' }))
      .rejects.toMatchObject({ status: 500, recoverable: true });
  });

  it('throws BackendRequestError when authMode=required and no token', async () => {
    mockGetAuth.mockResolvedValueOnce({ token: '', userId: 'user-1' });
    await expect(
      requestEdgeJson({ path: '/profile', operation: 'getProfile', authMode: 'required' }),
    ).rejects.toMatchObject({ name: 'BackendRequestError' });
  });

  it('uses fallback error message when payload has no error field', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({}, 422));
    await expect(requestEdgeJson({ path: '/x', operation: 'doThing' }))
      .rejects.toMatchObject({ message: 'doThing failed (422)' });
  });
});

// ── runBackendWorkflow ────────────────────────────────────────────────────────

describe('runBackendWorkflow', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls edge and returns result on success', async () => {
    const edge = vi.fn().mockResolvedValue({ ok: true });
    const result = await runBackendWorkflow({ operation: 'test', edge });
    expect(result).toEqual({ ok: true });
    expect(edge).toHaveBeenCalledOnce();
  });

  it('calls fallback when edge throws a recoverable error and fallback is allowed', async () => {
    const edge = vi.fn().mockRejectedValue(new BackendRequestError('edge down', { recoverable: true }));
    const fallback = vi.fn().mockResolvedValue({ fromFallback: true });
    mockFallbackAllowed.mockReturnValue(true);

    const result = await runBackendWorkflow({ operation: 'test', edge, fallback });
    expect(result).toEqual({ fromFallback: true });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('allows only an authenticated RPC fallback when general direct writes are disabled', async () => {
    const edge = vi.fn().mockRejectedValue(new BackendRequestError('edge down', { recoverable: true }));
    const fallback = vi.fn().mockResolvedValue({ enabled: true });
    mockFallbackAllowed.mockReturnValue(false);
    mockGetAuth.mockResolvedValue({ token: 'tok_test', userId: 'user-1' });

    const result = await runBackendWorkflow({
      operation: 'enableDriverMode',
      authMode: 'required',
      fallbackPolicy: 'authenticated-rpc',
      operationType: 'write',
      edge,
      fallback,
    });

    expect(result).toEqual({ enabled: true });
    expect(fallback).toHaveBeenCalledOnce();
    expect(mockFallbackAllowed).not.toHaveBeenCalled();
  });

  it('does NOT call fallback when edge throws a non-recoverable error', async () => {
    const edge = vi.fn().mockRejectedValue(new BackendRequestError('hard fail', { recoverable: false }));
    const fallback = vi.fn().mockResolvedValue({ fromFallback: true });

    await expect(runBackendWorkflow({ operation: 'test', edge, fallback, fallbackPolicy: 'never' }))
      .rejects.toMatchObject({ message: 'hard fail' });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('calls fallback directly when edgeAvailable=false and fallback is allowed', async () => {
    const edge = vi.fn();
    const fallback = vi.fn().mockResolvedValue('direct');
    mockFallbackAllowed.mockReturnValue(true);

    const result = await runBackendWorkflow({ operation: 'test', edge, fallback, edgeAvailable: false });
    expect(result).toBe('direct');
    expect(edge).not.toHaveBeenCalled();
  });

  it('throws BackendRequestError when edgeAvailable=false and no fallback', async () => {
    const edge = vi.fn();
    await expect(runBackendWorkflow({ operation: 'myOp', edge, edgeAvailable: false }))
      .rejects.toMatchObject({ name: 'BackendRequestError', message: expect.stringContaining('myOp') });
  });

  it('throws secure fallback error when circuit breaker is open', async () => {
    mockCircuitOpen.mockReturnValue(true);
    const edge = vi.fn().mockRejectedValue(new Error('Circuit breaker api-calls is OPEN'));

    await expect(runBackendWorkflow({ operation: 'payRide', edge }))
      .rejects.toMatchObject({ message: expect.stringContaining('payRide') });
  });
});
