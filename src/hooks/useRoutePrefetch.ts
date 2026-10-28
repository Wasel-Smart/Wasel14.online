import { useEffect } from 'react';

const PREFETCHED_ROUTES = new Set<string>();

const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  '/app/find-ride':    () => import('../features/rides/FindRidePage'),
  '/app/offer-ride':  () => import('../features/rides/OfferRidePage'),
  '/app/my-trips':    () => import('../features/trips/MyTripsPage'),
  '/app/wallet':      () => import('../features/wallet'),
  '/app/profile':     () => import('../features/profile/ProfilePage'),
  '/app/settings':    () => import('../features/preferences/SettingsPage'),
  '/app/notifications': () => import('../features/notifications/NotificationsPage'),
  '/app/trust':       () => import('../features/trust/TrustCenterPage'),
  '/app/bus':         () => import('../features/bus/BusPage'),
  '/app/packages':    () => import('../features/packages/PackagesPage'),
  '/app/raje3':       () => import('../features/raje3/ReturnMatching'),
  '/app/plus':        () => import('../features/plus/WaselPlusPage'),
};

function prefetchFromTarget(target: EventTarget | null) {
  const link = (target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
  if (!link?.href) {return;}
  try {
    const pathname = new URL(link.href).pathname;
    if (PREFETCHED_ROUTES.has(pathname)) {return;}
    PREFETCHED_ROUTES.add(pathname);
    void PREFETCH_MAP[pathname]?.();
  } catch {
    // ignore invalid URLs
  }
}

export function useRoutePrefetch() {
  useEffect(() => {
    // pointerover fires on both mouse hover and touch — covers desktop + mobile.
    const handler = (e: PointerEvent) => prefetchFromTarget(e.target);
    document.addEventListener('pointerover', handler, { passive: true });
    return () => document.removeEventListener('pointerover', handler);
  }, []);
}
