/**
 * tests/unit/fetchClientCircuitBreaker.test.ts
 *
 * Regression coverage for the api-calls breaker inside fetchWithRetry.
 *
 * fetchWithRetry used to reset the breaker on every call whenever it was OPEN,
 * so with failureThreshold 5 it could never reach OPEN — the breaker was dead
 * code that looked like a safety net. It must now open after the configured
 * number of consecutive failures, short-circuit subsequent calls until the
 * reset window elapses, and reset on success.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { circuitBreakers, CircuitState } from '@/utils/circuitBreaker';
import { fetchWithRetry } from '@/services/core/fetch-client';

const BACKEND_URL = 'https://project.supabase.co/functions/v1/make-server-0b1f4071/health';

const fetchMock = vi.fn();

function okResponse() {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({ ok: true }),
    text: () => Promise.resolve(JSON.stringify({ ok: true })),
  };
}

describe('fetchWithRetry circuit breaker', () => {
  beforeEach(() => {
    circuitBreakers.reset('api-calls');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    circuitBreakers.reset('api-calls');
  });

  it('opens after the configured number of consecutive failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    for (let i = 0; i < 5; i += 1) {
      await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow();
    }

    expect(circuitBreakers.get('api-calls').getState()).toBe(CircuitState.OPEN);
  });

  it('short-circuits further calls while OPEN without hitting the network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    for (let i = 0; i < 5; i += 1) {
      await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow();
    }
    const callsAfterOpening = fetchMock.mock.calls.length;

    await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow(/is OPEN/);

    expect(fetchMock.mock.calls.length).toBe(callsAfterOpening);
  });

  it('does not open before the threshold is reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow();
    await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow();

    expect(circuitBreakers.get('api-calls').getState()).toBe(CircuitState.CLOSED);
  });

  it('counts a retried request as a single breaker outcome', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    // retries=1 means two network attempts per call, but one breaker failure.
    for (let i = 0; i < 4; i += 1) {
      await expect(fetchWithRetry(BACKEND_URL, {}, 1, 1)).rejects.toThrow();
    }

    expect(circuitBreakers.get('api-calls').getState()).toBe(CircuitState.CLOSED);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('resets on a successful call', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    for (let i = 0; i < 4; i += 1) {
      await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).rejects.toThrow();
    }
    expect(circuitBreakers.get('api-calls').getStats().failures).toBe(4);

    fetchMock.mockResolvedValue(okResponse());
    await expect(fetchWithRetry(BACKEND_URL, {}, 0, 1)).resolves.toBeDefined();

    expect(circuitBreakers.get('api-calls').getStats().failures).toBe(0);
    expect(circuitBreakers.get('api-calls').getState()).toBe(CircuitState.CLOSED);
  });
});
