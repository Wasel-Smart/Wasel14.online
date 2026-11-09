import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/monitoring', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/utils/errors', () => ({
  handleError: vi.fn((err: unknown) => ({
    message: err instanceof Error ? err.message : String(err),
    code: 'UNKNOWN_ERROR',
    context: {},
    retryable: false,
  })),
  getUserMessage: vi.fn(() => 'Something went wrong'),
  isRetryableError: vi.fn(() => false),
}));

vi.mock('@/utils/retry', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  RetryPresets: {
    STANDARD: { maxAttempts: 3, baseDelayMs: 100 },
  },
}));

import { withErrorHandling, createErrorHandler } from '@/services/errorHandler';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withErrorHandling', () => {
  it('returns result on success', async () => {
    const result = await withErrorHandling(() => Promise.resolve(42), {
      operation: 'test-op',
    });
    expect(result).toBe(42);
  });

  it('returns fallback when operation throws', async () => {
    const result = await withErrorHandling(
      () => Promise.reject(new Error('fail')),
      { operation: 'test-op', fallback: 'default' },
    );
    expect(result).toBe('default');
  });

  it('throws when no fallback and operation fails', async () => {
    await expect(
      withErrorHandling(() => Promise.reject(new Error('fail')), {
        operation: 'test-op',
      }),
    ).rejects.toBeTruthy();
  });

  it('does not log when silent=true', async () => {
    const { logger } = await import('@/utils/monitoring');
    await withErrorHandling(
      () => Promise.reject(new Error('fail')),
      { operation: 'test-op', fallback: null, silent: true },
    ).catch(() => {});
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error when silent=false (default)', async () => {
    const { logger } = await import('@/utils/monitoring');
    await withErrorHandling(
      () => Promise.reject(new Error('fail')),
      { operation: 'test-op', fallback: null },
    ).catch(() => {});
    expect(logger.error).toHaveBeenCalled();
  });

  it('uses withRetry when retry=true', async () => {
    const { withRetry } = await import('@/utils/retry');
    await withErrorHandling(() => Promise.resolve('ok'), {
      operation: 'test-op',
      retry: true,
    });
    expect(withRetry).toHaveBeenCalled();
  });

  it('does not use withRetry when retry=false', async () => {
    const { withRetry } = await import('@/utils/retry');
    await withErrorHandling(() => Promise.resolve('ok'), {
      operation: 'test-op',
      retry: false,
    });
    expect(withRetry).not.toHaveBeenCalled();
  });
});

describe('createErrorHandler', () => {
  it('creates a handler that uses default options', async () => {
    const handler = createErrorHandler<string>({ operation: 'default-op', fallback: 'fb' });
    const result = await handler(() => Promise.reject(new Error('fail')));
    expect(result).toBe('fb');
  });

  it('allows overriding options per call', async () => {
    const handler = createErrorHandler<number>({ operation: 'default-op' });
    const result = await handler(() => Promise.resolve(7), { operation: 'override-op' });
    expect(result).toBe(7);
  });
});
