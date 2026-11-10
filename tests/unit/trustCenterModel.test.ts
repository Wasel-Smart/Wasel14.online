import { describe, expect, it } from 'vitest';
import { buildFallbackTrustCenterStatus } from '@/services/trustCenterModel';

type FallbackUser = Parameters<typeof buildFallbackTrustCenterStatus>[0];

function user(overrides: Partial<FallbackUser> = {}): FallbackUser {
  return {
    role: 'rider',
    verificationLevel: 'level_0',
    emailVerified: false,
    phoneVerified: false,
    walletStatus: 'active',
    ...overrides,
  };
}

describe('trustCenterModel: buildFallbackTrustCenterStatus', () => {
  it('starts a bare rider at the email step', () => {
    const status = buildFallbackTrustCenterStatus(user());
    expect(status.steps.email.state).toBe('not_started');
    expect(status.steps.phone.state).toBe('not_started');
    expect(status.steps.driverDocuments.state).toBe('not_started');
    expect(status.steps.driverDocuments.detail).toContain('Driver mode');
    expect(status.steps.walletStanding.state).toBe('completed');
    expect(status.completedSteps).toBe(1);
    expect(status.totalSteps).toBe(4);
    expect(status.nextStepId).toBe('email');
    expect(status.blockedSteps).toEqual([]);
  });

  it('marks an unverified email as in progress', () => {
    const status = buildFallbackTrustCenterStatus(user({ email: 'a@example.com' }));
    expect(status.steps.email.state).toBe('in_progress');
    expect(status.steps.email.meta.email).toBe('a@example.com');
  });

  it('marks an unverified phone as in progress and carries the number', () => {
    const status = buildFallbackTrustCenterStatus(
      user({ emailVerified: true, email: 'a@example.com', phone: '+962790000000' }),
    );
    expect(status.steps.phone.state).toBe('in_progress');
    expect(status.steps.phone.meta.phone).toBe('+962790000000');
    expect(status.nextStepId).toBe('phone');
  });

  it('treats a driver at level_2 as waiting for review', () => {
    const status = buildFallbackTrustCenterStatus(
      user({ role: 'driver', verificationLevel: 'level_2' }),
    );
    expect(status.steps.driverDocuments.state).toBe('in_progress');
  });

  it('treats an approved driver as complete', () => {
    const status = buildFallbackTrustCenterStatus(
      user({ role: 'both', driverStatus: 'approved' }),
    );
    expect(status.steps.driverDocuments.state).toBe('completed');
  });

  it('asks a driver with no review to submit documents', () => {
    const status = buildFallbackTrustCenterStatus(user({ role: 'driver' }));
    expect(status.steps.driverDocuments.state).toBe('not_started');
    expect(status.steps.driverDocuments.detail).toContain('Submit');
  });

  it('completes every step for a fully verified, approved driver', () => {
    const status = buildFallbackTrustCenterStatus(
      user({
        role: 'driver',
        verificationLevel: 'level_3',
        email: 'a@example.com',
        emailVerified: true,
        phone: '+962790000000',
        phoneVerified: true,
      }),
    );
    expect(status.completedSteps).toBe(4);
    expect(status.nextStepId).toBeNull();
    expect(status.blockedSteps).toEqual([]);
  });

  it('marks a limited wallet as in progress', () => {
    const status = buildFallbackTrustCenterStatus(user({ walletStatus: 'limited' }));
    expect(status.steps.walletStanding.state).toBe('in_progress');
    expect(status.steps.walletStanding.meta.walletStatus).toBe('limited');
  });

  it.each([
    ['frozen', 'frozen'],
    ['closed', 'closed'],
  ] as const)('blocks a %s wallet with a specific reason', (walletStatus, word) => {
    const status = buildFallbackTrustCenterStatus(user({ walletStatus }));
    expect(status.steps.walletStanding.state).toBe('failed');
    expect(status.steps.walletStanding.failureReason).toContain(word);
    expect(status.steps.walletStanding.meta.walletStatus).toBe(walletStatus);
    expect(status.blockedSteps).toContain('wallet_standing');
  });

  it('reports an unavailable wallet as failed with a retry message', () => {
    const status = buildFallbackTrustCenterStatus(user({ walletStatus: 'unavailable' }));
    expect(status.steps.walletStanding.state).toBe('failed');
    expect(status.steps.walletStanding.failureReason).toContain('try again');
    expect(status.steps.walletStanding.meta.walletStatus).toBe('unavailable');
  });

  it('defaults a missing verification level to level_0', () => {
    const status = buildFallbackTrustCenterStatus(
      user({ verificationLevel: undefined as unknown as string }),
    );
    expect(status.verificationLevel).toBe('level_0');
  });

  it('returns an empty review history and an ISO timestamp', () => {
    const status = buildFallbackTrustCenterStatus(user());
    expect(status.reviewHistory).toEqual([]);
    expect(Number.isNaN(Date.parse(status.fetchedAt))).toBe(false);
  });
});
