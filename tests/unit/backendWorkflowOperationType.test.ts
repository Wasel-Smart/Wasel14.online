import { describe, it, expect, vi } from 'vitest';
import { BackendRequestError, runBackendWorkflow } from '@/services/backendWorkflow';

// Development with direct fallback NOT enabled => fallback mode 'reads-only':
// direct reads may fall back, direct writes may not.
vi.mock('@/utils/env', () => ({
  getConfig: () => ({
    allowDirectSupabaseFallback: false,
    isProd: false,
    isDev: true,
  }),
}));

const recoverableEdgeError = () =>
  new BackendRequestError('edge down', { status: 503, recoverable: true });

describe('runBackendWorkflow operationType', () => {
  it('gates an explicitly-declared write as a write even with the "always" policy', async () => {
    const fallback = vi.fn(async () => ({ saved: true }));

    await expect(
      runBackendWorkflow({
        operation: 'Save profile',
        fallbackPolicy: 'always',
        operationType: 'write',
        edgeAvailable: true,
        edge: async () => {
          throw recoverableEdgeError();
        },
        fallback,
      }),
    ).rejects.toThrow('edge down');

    expect(fallback).not.toHaveBeenCalled();
  });

  it('keeps the legacy default: "always" without operationType is treated as a read', async () => {
    const fallback = vi.fn(async () => ({ rows: [] }));

    await expect(
      runBackendWorkflow({
        operation: 'List rides',
        fallbackPolicy: 'always',
        edgeAvailable: true,
        edge: async () => {
          throw recoverableEdgeError();
        },
        fallback,
      }),
    ).resolves.toEqual({ rows: [] });

    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('treats the "writes-if-enabled" policy as a write by default', async () => {
    const fallback = vi.fn(async () => ({ saved: true }));

    await expect(
      runBackendWorkflow({
        operation: 'Start phone verification',
        fallbackPolicy: 'writes-if-enabled',
        edgeAvailable: true,
        edge: async () => {
          throw recoverableEdgeError();
        },
        fallback,
      }),
    ).rejects.toThrow('edge down');

    expect(fallback).not.toHaveBeenCalled();
  });
});
