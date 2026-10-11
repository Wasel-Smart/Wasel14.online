import { useCallback } from 'react';
import {
  useNavigate as useRouterNavigate,
  type NavigateOptions,
  type To,
} from 'react-router';

const APP_ROUTE_PREFIXES = [
  '/auth',
  '/dashboard',
  '/home',
  '/find-ride',
  '/offer-ride',
  '/post-ride',
  '/my-trips',
  '/booking-requests',
  '/live-trip',
  '/routes',
  '/bus',
  '/packages',
  '/awasel',
  '/raje3',
  '/services',
  '/innovation-hub',
  '/analytics',
  '/mobility-os',
  '/ai-intelligence',
  '/wallet',
  '/plus',
  '/payments',
  '/profile',
  '/settings',
  '/notifications',
  '/trust',
  '/driver',
  '/safety',
  '/schedule',
  '/admin',
  '/403',
  '/500',
  '/privacy',
  '/terms',
  '/legal',
  '/moderation',
  '/support',
];

export function normalizePathname(pathname: string): string {
  if (!pathname.startsWith('/') || pathname.startsWith('/app') || pathname.startsWith('//')) {
    return pathname;
  }

  // Match the prefix against the bare path only: `/find-ride?from=Amman` and
  // `/wallet#history` must be prefixed too, not just `/find-ride`.
  const bare = /^[^?#]*/.exec(pathname)?.[0] ?? pathname;
  const suffix = pathname.slice(bare.length);

  const shouldPrefix = APP_ROUTE_PREFIXES.some(
    prefix => bare === prefix || bare.startsWith(`${prefix}/`),
  );

  return shouldPrefix ? `/app${bare}${suffix}` : pathname;
}

/** Real, crawlable/middle-clickable URL for an in-app path (same rules as navigate()). */
export const toAppHref = normalizePathname;

function normalizeTo(to: To): To {
  if (typeof to === 'string') {
    return normalizePathname(to);
  }

  return {
    ...to,
    pathname: to.pathname ? normalizePathname(to.pathname) : to.pathname,
  };
}

/**
 * Normalizes legacy bare app routes like `/my-trips` to the mounted `/app/...`
 * namespace so older call sites continue to work after the route consolidation.
 */
export type SafeNavigate = (to?: To | number, options?: NavigateOptions) => void;

export function useIframeSafeNavigate(): SafeNavigate {
  const navigate = useRouterNavigate();

  // Must be memoized: callers put this in effect dependency arrays (the OAuth
  // callback page does), and a fresh closure every render would re-run those
  // effects on every render.
  return useCallback<SafeNavigate>(
    (to = '/home', options) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }

      navigate(normalizeTo(to), options);
    },
    [navigate],
  );
}

export { useIframeSafeNavigate as useNavigate };
export default useIframeSafeNavigate;
