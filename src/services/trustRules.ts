import type { WaselUser } from '../contexts/LocalAuth';

export type TrustCapability =
  'offer_ride' | 'carry_packages' | 'receive_payouts' | 'priority_support';

export interface TrustGateResult {
  allowed: boolean;
  reason: string | null;
  recommendation: string | null;
}

function verificationRank ( level?: string ): number {
  switch ( level ) {
    case 'level_3':
      return 3;
    case 'level_2':
      return 2;
    case 'level_1':
      return 1;
    default:
      return 0;
  }
}

// Driver statuses that allow trip creation. `pending_approval` means the driver
// has submitted documents and is awaiting review — the backend also allows trip
// creation at this stage so routes are live the moment approval comes through.
const CLEARED_DRIVER_STATUSES = new Set(['approved', 'online', 'offline', 'busy', 'pending_approval']);

/**
 * A driver is cleared once an operator has approved the submitted driver
 * documents. The backend driver status is the source of truth (it is what
 * `POST /trips` enforces), so a known status always wins: a `pending_approval`
 * or `rejected` driver is NOT cleared even if a stale level_3 is cached.
 * level_3 is only trusted as an equivalent when the status is unknown, so a
 * profile that has no status field never locks out an approved driver.
 */
export function isDriverCleared(
  user: Pick<WaselUser, 'verificationLevel' | 'driverStatus'>,
): boolean {
  const status = typeof user.driverStatus === 'string' ? user.driverStatus.trim() : '';
  if (status) {
    return CLEARED_DRIVER_STATUSES.has(status);
  }
  return verificationRank(user.verificationLevel) >= 3;
}

/** True once the driver has sent documents that are waiting for (or past) review. */
export function hasSubmittedDriverDocuments(
  user: Pick<WaselUser, 'verificationLevel' | 'driverStatus'>,
): boolean {
  return (
    isDriverCleared(user) ||
    user.driverStatus === 'pending_approval' ||
    verificationRank(user.verificationLevel) >= 2
  );
}

function evaluateOfferRide(user: Pick<WaselUser, 'role' | 'phoneVerified' | 'emailVerified' | 'verificationLevel' | 'driverStatus'>): TrustGateResult {
  if (user.role !== 'driver' && user.role !== 'both') {
    return { allowed: false, reason: 'Turn on Driver mode first.', recommendation: 'Open Driver to start.' };
  }
  if (!user.phoneVerified || !user.emailVerified) {
    return { allowed: false, reason: 'Verify phone and email.', recommendation: 'Finish checks in Trust Center.' };
  }
  if (!hasSubmittedDriverDocuments(user)) {
    return {
      allowed: false,
      reason: 'Submit your driver documents first.',
      recommendation: 'Add your license in Trust Center to start the review.',
    };
  }
  return { allowed: true, reason: null, recommendation: null };
}

function evaluateCarryPackages(user: Pick<WaselUser, 'role' | 'trustScore' | 'verificationLevel' | 'driverStatus'>): TrustGateResult {
  if (user.role !== 'driver' && user.role !== 'both') {
    return { allowed: false, reason: 'Turn on Driver mode first.', recommendation: 'Complete driver setup.' };
  }
  if (!isDriverCleared(user) || user.trustScore < 70) {
    return { allowed: false, reason: 'Packages need full trust approval.', recommendation: 'Reach full driver verification first.' };
  }
  return { allowed: true, reason: null, recommendation: null };
}

function evaluateReceivePayouts(user: Pick<WaselUser, 'emailVerified'>): TrustGateResult {
  if (!user.emailVerified) {
    return { allowed: false, reason: 'Payouts need a verified email.', recommendation: 'Confirm your email address.' };
  }
  return { allowed: true, reason: null, recommendation: null };
}

export function evaluateTrustCapability(
  user:
    | Pick<
      WaselUser,
      | 'role'
      | 'verificationLevel'
      | 'walletStatus'
      | 'trustScore'
      | 'phoneVerified'
      | 'emailVerified'
      | 'driverStatus'
    >
    | null
    | undefined,
  capability: TrustCapability,
): TrustGateResult {
  if (!user) {
    return { allowed: false, reason: 'Sign in to continue.', recommendation: 'Open your account first.' };
  }

  const walletBlocked =
    user.walletStatus === 'frozen' ||
    user.walletStatus === 'closed' ||
    user.walletStatus === 'unavailable';

  if (walletBlocked && capability !== 'priority_support') {
    return { allowed: false, reason: 'Wallet needs review.', recommendation: 'Fix wallet status in Wallet or Settings.' };
  }

  if (capability === 'offer_ride') {
    return evaluateOfferRide(user);
  }

  if (capability === 'carry_packages') {
    return evaluateCarryPackages(user);
  }

  if (capability === 'receive_payouts') {
    return evaluateReceivePayouts(user);
  }

  if (user.trustScore < 70) {
    return { allowed: false, reason: 'Priority support needs stronger trust.', recommendation: 'Complete checks and keep a good trip record.' };
  }

  return { allowed: true, reason: null, recommendation: null };
}

export function getTrustReadinessSummary (
  user:
    | Pick<
      WaselUser,
      | 'role'
      | 'verificationLevel'
      | 'walletStatus'
      | 'trustScore'
      | 'phoneVerified'
      | 'emailVerified'
      | 'driverStatus'
    >
    | null
    | undefined,
) {
  return {
    canOfferRide: evaluateTrustCapability( user, 'offer_ride' ).allowed,
    canCarryPackages: evaluateTrustCapability( user, 'carry_packages' ).allowed,
    canReceivePayouts: evaluateTrustCapability( user, 'receive_payouts' ).allowed,
    canUsePrioritySupport: evaluateTrustCapability( user, 'priority_support' ).allowed,
  };
}
