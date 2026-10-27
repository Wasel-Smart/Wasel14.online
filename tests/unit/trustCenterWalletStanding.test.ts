import { describe, it, expect } from 'vitest';
import { buildFallbackTrustCenterStatus } from '@/services/trustCenterModel';

const baseUser = {
  role: 'rider' as const,
  verificationLevel: 'level_0',
  emailVerified: false,
  phoneVerified: false,
};

describe('trust center wallet standing', () => {
  it('reports a frozen wallet as frozen', () => {
    const status = buildFallbackTrustCenterStatus({ ...baseUser, walletStatus: 'frozen' });
    expect(status.steps.walletStanding.state).toBe('failed');
    expect(status.steps.walletStanding.failureReason).toMatch(/frozen/i);
    expect(status.blockedSteps).toContain('wallet_standing');
  });

  it('reports a closed wallet as closed', () => {
    const status = buildFallbackTrustCenterStatus({ ...baseUser, walletStatus: 'closed' });
    expect(status.steps.walletStanding.failureReason).toMatch(/closed/i);
  });

  it('does not call an unavailable wallet "frozen"', () => {
    const status = buildFallbackTrustCenterStatus({ ...baseUser, walletStatus: 'unavailable' });
    expect(status.steps.walletStanding.state).toBe('failed');
    expect(status.steps.walletStanding.meta.walletStatus).toBe('unavailable');
    expect(status.steps.walletStanding.failureReason).not.toMatch(/frozen/i);
    expect(status.steps.walletStanding.failureReason).toMatch(/could not be confirmed/i);
  });

  it('marks an active wallet complete and a limited wallet in progress', () => {
    expect(
      buildFallbackTrustCenterStatus({ ...baseUser, walletStatus: 'active' }).steps.walletStanding.state,
    ).toBe('completed');
    expect(
      buildFallbackTrustCenterStatus({ ...baseUser, walletStatus: 'limited' }).steps.walletStanding.state,
    ).toBe('in_progress');
  });
});
