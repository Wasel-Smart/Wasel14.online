import { describe, expect, it, vi } from 'vitest';

// retry.ts only needs `logger.warning`; mocking it keeps the test free of the
// Sentry / App Insights wiring that monitoring.ts pulls in.
vi.mock('../../src/utils/monitoring', () => ({
  logger: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  batchRetry,
  RetryPresets,
  withRetry,
  withRetryAndTimeout,
} from '../../src/utils/retry';

// Tiny real delays keep these tests fast without needing fake timers.
const FAST = { initialDelayMs: 1, maxDelayMs: 2, jitterFactor: 0 };

describe('withRetry', () => {
  it('returns the value of a first-attempt success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, FAST)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure (TypeError) and then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('recovered');
    await expect(withRetry(fn, { ...FAST, maxAttempts: 3 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable error', async () => {
    const boom = new Error('validation failed');
    const fn = vi.fn().mockRejectedValue(boom);
    await expect(withRetry(fn, { ...FAST, maxAttempts: 5 })).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error once every attempt is used', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(withRetry(fn, { ...FAST, maxAttempts: 3 })).rejects.toEqual({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it.each([
    [500, true],
    [503, true],
    [429, true],
    [408, true],
    [400, false],
    [401, false],
    [404, false],
  ])('HTTP status %i retryable=%s', async (status, retryable) => {
    const fn = vi.fn().mockRejectedValue({ status });
    await expect(withRetry(fn, { ...FAST, maxAttempts: 2 })).rejects.toEqual({ status });
    expect(fn).toHaveBeenCalledTimes(retryable ? 2 : 1);
  });

  it('treats an Error whose message says the network request failed as retryable', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { ...FAST, maxAttempts: 2 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honours a custom retryableErrors predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom'));
    await expect(
      withRetry(fn, { ...FAST, maxAttempts: 3, retryableErrors: () => true }),
    ).rejects.toThrow('custom');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry with the attempt number before each wait, but not after the last attempt', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(withRetry(fn, { ...FAST, maxAttempts: 3, onRetry })).rejects.toBeInstanceOf(TypeError);
    expect(onRetry.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2]);
  });
});

describe('withRetryAndTimeout', () => {
  it('resolves when the operation finishes in time', async () => {
    await expect(withRetryAndTimeout(() => Promise.resolve(42), 1000, FAST)).resolves.toBe(42);
  });

  it('rejects with a timeout when the operation never settles', async () => {
    await expect(
      withRetryAndTimeout(() => new Promise<never>(() => undefined), 20, FAST),
    ).rejects.toThrow('Operation timed out');
  });
});

describe('batchRetry', () => {
  it('returns results in input order and retries each operation independently', async () => {
    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('b');
    const results = await batchRetry(
      [() => Promise.resolve('a'), flaky, () => Promise.resolve('c')],
      { ...FAST, maxAttempts: 2 },
    );
    expect(results).toEqual(['a', 'b', 'c']);
    expect(flaky).toHaveBeenCalledTimes(2);
  });
});

describe('RetryPresets', () => {
  it('every preset backs off and never waits longer than its own ceiling', () => {
    for (const preset of Object.values(RetryPresets)) {
      expect(preset.maxAttempts).toBeGreaterThan(1);
      expect(preset.backoffMultiplier).toBeGreaterThan(1);
      expect(preset.maxDelayMs).toBeGreaterThanOrEqual(preset.initialDelayMs as number);
    }
  });
});
