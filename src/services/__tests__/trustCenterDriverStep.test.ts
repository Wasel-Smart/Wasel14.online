import { describe, it, expect } from 'vitest';
import { buildFallbackTrustCenterStatus } from '../trustCenterModel';

const base = {
  verificationLevel: 'level_1',
  emailVerified: true,
  phoneVerified: true,
  walletStatus: 'active' as const,
};

describe('driver documents step (fallback status)', () => {
  it('asks a rider to enable Driver mode first', () => {
    const step = buildFallbackTrustCenterStatus({ ...base, role: 'rider' }).steps.driverDocuments;
    expect(step.state).toBe('not_started');
    expect(step.detail).toBe('Enable Driver mode before submitting driver documents.');
  });

  it('treats a driver with no documents as ready to submit', () => {
    const step = buildFallbackTrustCenterStatus({ ...base, role: 'driver' }).steps.driverDocuments;
    expect(step.state).toBe('not_started');
    expect(step.detail).toBe('Submit driver license and compliance documents.');
  });

  it('treats the both role as a driver', () => {
    const step = buildFallbackTrustCenterStatus({ ...base, role: 'both' }).steps.driverDocuments;
    expect(step.detail).toBe('Submit driver license and compliance documents.');
  });

  it('shows in_progress while documents await review', () => {
    const step = buildFallbackTrustCenterStatus({
      ...base,
      role: 'driver',
      verificationLevel: 'level_2',
      driverStatus: 'pending_approval',
    }).steps.driverDocuments;
    expect(step.state).toBe('in_progress');
  });

  it('shows completed once approved', () => {
    const step = buildFallbackTrustCenterStatus({
      ...base,
      role: 'driver',
      verificationLevel: 'level_3',
      driverStatus: 'approved',
    }).steps.driverDocuments;
    expect(step.state).toBe('completed');
  });
});
