import { describe, expect, it } from 'vitest';
import { resolveWalletRuntimeMode } from '@/features/wallet/walletRuntime';

describe('walletRuntime: resolveWalletRuntimeMode', () => {
  it('redirects signed-out visitors regardless of backend state', () => {
    expect(resolveWalletRuntimeMode({ hasUser: false, backendReady: true })).toBe('redirect');
    expect(
      resolveWalletRuntimeMode({ hasUser: false, backendReady: false, localFallbackReady: true }),
    ).toBe('redirect');
  });

  it('is live for a signed-in user with a ready backend', () => {
    expect(resolveWalletRuntimeMode({ hasUser: true, backendReady: true })).toBe('live');
  });

  it('is unavailable when neither backend nor local fallback is ready', () => {
    expect(resolveWalletRuntimeMode({ hasUser: true, backendReady: false })).toBe('unavailable');
    expect(
      resolveWalletRuntimeMode({ hasUser: true, backendReady: false, localFallbackReady: false }),
    ).toBe('unavailable');
  });

  it('is live when only the local fallback is ready', () => {
    expect(
      resolveWalletRuntimeMode({ hasUser: true, backendReady: false, localFallbackReady: true }),
    ).toBe('live');
  });
});
