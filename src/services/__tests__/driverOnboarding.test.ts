import { describe, expect, it } from 'vitest';
import type { WaselUser } from '../../contexts/LocalAuth';
import { getDriverReadinessSummary } from '../driverOnboarding';

function buildUser(overrides: Partial<WaselUser> = {}): WaselUser {
  return {
    id: 'driver-1',
    name: 'Driver',
    email: 'driver@example.test',
    phone: '+962700000000',
    role: 'driver',
    balance: 0,
    rating: 5,
    trips: 0,
    verified: true,
    verificationLevel: 'level_2',
    walletStatus: 'active',
    joinedAt: '2026-01-01T00:00:00.000Z',
    emailVerified: true,
    phoneVerified: true,
    twoFactorEnabled: false,
    trustScore: 80,
    driverStatus: 'pending_approval',
    backendMode: 'supabase',
    ...overrides,
  };
}

describe('driver ride readiness', () => {
  it('explains that a route can be prepared during review but publishing waits for approval', () => {
    const readiness = getDriverReadinessSummary(buildUser());

    expect(readiness.status).toBe('pending_review');
    expect(readiness.canOfferRide).toBe(false);
    expect(readiness.detail).toContain('Plan your route now');
    expect(readiness.detail).toContain('publishing unlocks after approval');
    expect(readiness.steps.find(step => step.id === 'driver_clearance')?.complete).toBe(false);
  });

  it('unlocks ride publishing after driver approval', () => {
    const readiness = getDriverReadinessSummary(buildUser({
      verificationLevel: 'level_3',
      driverStatus: 'approved',
    }));

    expect(readiness.status).toBe('ready');
    expect(readiness.canOfferRide).toBe(true);
    expect(readiness.steps.every(step => step.complete)).toBe(true);
  });
});
