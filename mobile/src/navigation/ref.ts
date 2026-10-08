import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/** Screens a push notification / external event is allowed to open. */
const ALLOWED_TARGETS = new Set([
  'Notifications',
  'LiveTracking',
  'Chat',
  'RateRide',
  'Trips',
  'Receipt',
  'Safety',
  'Wallet',
  'Packages',
  'TrustCenter',
]);

const TAB_TARGETS = new Set(['Wallet', 'Packages']);

/**
 * Navigates from outside React (push taps). Returns false when the target is
 * not allowed or the navigator is not ready, so callers can fall back.
 */
export function navigateFromOutside(screen: string, params?: Record<string, unknown>): boolean {
  if (!ALLOWED_TARGETS.has(screen) || !navigationRef.isReady()) return false;
  const safeParams = params
    ? (Object.fromEntries(
        Object.entries(params).filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
      ) as Record<string, object | undefined>)
    : undefined;
  if (TAB_TARGETS.has(screen)) {
    navigationRef.navigate('Tabs', { screen, params: safeParams } as never);
  } else {
    navigationRef.navigate(screen, safeParams as never);
  }
  return true;
}
