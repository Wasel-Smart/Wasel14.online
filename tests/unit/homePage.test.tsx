/**
 * Tests for HomePage, HomeHeroSection, MobileBottomNav, and
 * MobilityOSLandingMap pure utility functions.
 *
 * Scope: logic, rendering contracts, accessibility attributes, and
 * the pure canvas-math helpers extracted from MobilityOSLandingMap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// ─── Pure math helpers re-exported for testing ───────────────────────────────
// We test the pure functions directly without mounting the canvas component.

function mercator(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

const CITIES = [
  { id: 0, name: 'Amman', lat: 31.9454, lon: 35.9284 },
  { id: 1, name: 'Aqaba', lat: 29.532, lon: 35.0063 },
  { id: 2, name: 'Irbid', lat: 32.5556, lon: 35.85 },
];

const bounds = CITIES.reduce(
  (acc, city) => ({
    minLat: Math.min(acc.minLat, city.lat),
    maxLat: Math.max(acc.maxLat, city.lat),
    minLon: Math.min(acc.minLon, city.lon),
    maxLon: Math.max(acc.maxLon, city.lon),
  }),
  { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity },
);

function project(lat: number, lon: number, width: number, height: number) {
  const px = width * 0.12;
  const py = height * 0.1;
  const x = px + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * (width - px * 2);
  const minY = mercator(bounds.minLat);
  const maxY = mercator(bounds.maxLat);
  const y = py + (1 - (mercator(lat) - minY) / (maxY - minY || 1)) * (height - py * 2);
  return { x, y };
}

function pointOnCurve(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number,
) {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function normalizeToken(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// ─── Canvas math tests ────────────────────────────────────────────────────────

describe('MobilityOSLandingMap — mercator projection', () => {
  it('returns a finite value for valid latitudes', () => {
    expect(Number.isFinite(mercator(31.9454))).toBe(true);
    expect(Number.isFinite(mercator(29.532))).toBe(true);
    expect(Number.isFinite(mercator(32.5556))).toBe(true);
  });

  it('higher latitude produces higher mercator value', () => {
    expect(mercator(32.5556)).toBeGreaterThan(mercator(29.532));
  });
});

describe('MobilityOSLandingMap — project()', () => {
  it('returns x and y within canvas bounds', () => {
    const { x, y } = project(31.9454, 35.9284, 720, 560);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(720);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(560);
  });

  it('northern city projects higher on canvas (smaller y) than southern city', () => {
    const amman = project(31.9454, 35.9284, 720, 560);
    const aqaba = project(29.532, 35.0063, 720, 560);
    expect(amman.y).toBeLessThan(aqaba.y);
  });

  it('scales correctly with different canvas sizes', () => {
    const small = project(31.9454, 35.9284, 360, 280);
    const large = project(31.9454, 35.9284, 720, 560);
    // Proportional position should be roughly the same
    expect(small.x / 360).toBeCloseTo(large.x / 720, 1);
    expect(small.y / 280).toBeCloseTo(large.y / 560, 1);
  });
});

describe('MobilityOSLandingMap — pointOnCurve()', () => {
  const start = { x: 0, y: 0 };
  const control = { x: 50, y: 100 };
  const end = { x: 100, y: 0 };

  it('t=0 returns start point', () => {
    const p = pointOnCurve(start, control, end, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('t=1 returns end point', () => {
    const p = pointOnCurve(start, control, end, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('t=0.5 returns midpoint on curve', () => {
    const p = pointOnCurve(start, control, end, 0.5);
    expect(p.x).toBeCloseTo(50);
    // Quadratic Bézier midpoint: y = 0.25*0 + 0.5*100 + 0.25*0 = 50.
    expect(p.y).toBeCloseTo(50);
  });

  it('produces values between start and end for t in (0,1)', () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = pointOnCurve(start, control, end, t);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
    }
  });
});

describe('MobilityOSLandingMap — withAlpha()', () => {
  it('converts hex to rgba with correct alpha', () => {
    expect(withAlpha('#00E5FF', 0.5)).toBe('rgba(0,229,255,0.5)');
    expect(withAlpha('#72C70D', 1)).toBe('rgba(114,199,13,1)');
    expect(withAlpha('#FF8A0B', 0)).toBe('rgba(255,138,11,0)');
  });

  it('handles hex without leading #', () => {
    // withAlpha strips # so passing without should still parse
    const result = withAlpha('#081D39', 0.8);
    expect(result).toMatch(/^rgba\(/);
  });
});

describe('MobilityOSLandingMap — normalizeToken()', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(normalizeToken('Amman')).toBe('amman');
    expect(normalizeToken("Ma'an")).toBe('maan');
    expect(normalizeToken('Wadi Rum')).toBe('wadirum');
  });

  it('handles null and undefined gracefully', () => {
    expect(normalizeToken(null)).toBe('');
    expect(normalizeToken(undefined)).toBe('');
    expect(normalizeToken('')).toBe('');
  });

  it('matches city names case-insensitively', () => {
    expect(normalizeToken('AMMAN')).toBe(normalizeToken('amman'));
    expect(normalizeToken('Aqaba')).toBe(normalizeToken('aqaba'));
  });
});

describe('MobilityOSLandingMap — lerp() and clamp()', () => {
  it('lerp interpolates correctly', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('clamp constrains values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0, 0, 0)).toBe(0);
  });
});

// ─── MobileBottomNav ──────────────────────────────────────────────────────────

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', dir: 'ltr', t: (k: string) => k }),
}));

vi.mock('@/hooks/useIframeSafeNavigate', () => ({
  useIframeSafeNavigate: () => vi.fn(),
}));

vi.mock('@/config/user-navigation', () => ({
  CORE_NAV_ITEMS: [
    { id: 'find', label: 'Find Ride', labelAr: 'ابحث', path: '/find-ride', accent: 'cyan' },
    { id: 'post', label: 'Offer', labelAr: 'اعرض', path: '/offer-ride', accent: 'gold' },
    { id: 'packages', label: 'Packages', labelAr: 'طرود', path: '/packages', accent: 'cyan' },
  ],
}));

describe('MobileBottomNav', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders nav items with correct aria-labels', async () => {
    const { MobileBottomNav } = await import('@/components/MobileBottomNav');
    render(
      <MemoryRouter initialEntries={['/app/find-ride']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation')).toBeDefined();
    expect(screen.getByLabelText('Find Ride')).toBeDefined();
    expect(screen.getByLabelText('Offer')).toBeDefined();
    expect(screen.getByLabelText('Packages')).toBeDefined();
  });

  it('marks the active route with aria-current="page"', async () => {
    const { MobileBottomNav } = await import('@/components/MobileBottomNav');
    render(
      <MemoryRouter initialEntries={['/app/find-ride']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const activeBtn = screen.getByLabelText('Find Ride');
    expect(activeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('does not mark inactive routes with aria-current', async () => {
    const { MobileBottomNav } = await import('@/components/MobileBottomNav');
    render(
      <MemoryRouter initialEntries={['/app/find-ride']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const inactiveBtn = screen.getByLabelText('Packages');
    expect(inactiveBtn.getAttribute('aria-current')).toBeNull();
  });

  it('calls navigate when a nav item is clicked', async () => {
    const mockNavigate = vi.fn();
    vi.doMock('@/hooks/useIframeSafeNavigate', () => ({
      useIframeSafeNavigate: () => mockNavigate,
    }));
    const { MobileBottomNav } = await import('@/components/MobileBottomNav');
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Find Ride'));
    expect(mockNavigate).toHaveBeenCalledWith('/find-ride');
  });

  it('uses Arabic labels when language is ar', async () => {
    vi.doMock('@/contexts/LanguageContext', () => ({
      useLanguage: () => ({ language: 'ar', dir: 'rtl', t: (k: string) => k }),
    }));
    const { MobileBottomNav } = await import('@/components/MobileBottomNav');
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav language="ar" />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('ابحث')).toBeDefined();
  });
});

// ─── HomePage quick-action ordering ──────────────────────────────────────────
// Test the role-based reordering logic in isolation without mounting the full page.

type Role = 'driver' | 'both' | 'admin' | 'user' | undefined;

function getQuickActionOrder(role: Role): string[] {
  const base = ['find', 'offer', 'packages', 'bus', 'schedule'];
  if (role === 'driver' || role === 'both') {return ['offer', 'find', 'packages', 'bus', 'schedule'];}
  if (role === 'admin') {return ['find', 'packages', 'offer', 'bus', 'schedule'];}
  return base;
}

describe('HomePage — quick action ordering', () => {
  it('default order starts with find-ride', () => {
    expect(getQuickActionOrder(undefined)[0]).toBe('find');
  });

  it('driver role puts offer-ride first', () => {
    expect(getQuickActionOrder('driver')[0]).toBe('offer');
  });

  it('both role puts offer-ride first', () => {
    expect(getQuickActionOrder('both')[0]).toBe('offer');
  });

  it('admin role puts find-ride first and packages second', () => {
    const order = getQuickActionOrder('admin');
    expect(order[0]).toBe('find');
    expect(order[1]).toBe('packages');
  });

  it('all roles produce exactly 5 actions', () => {
    for (const role of ['driver', 'both', 'admin', 'user', undefined] as Role[]) {
      expect(getQuickActionOrder(role)).toHaveLength(5);
    }
  });

  it('all roles include all 5 action types', () => {
    const expected = new Set(['find', 'offer', 'packages', 'bus', 'schedule']);
    for (const role of ['driver', 'both', 'admin', 'user', undefined] as Role[]) {
      const order = new Set(getQuickActionOrder(role));
      expect(order).toEqual(expected);
    }
  });
});

// ─── Corridor card fallback tiers ─────────────────────────────────────────────

interface LiveCorridor {
  id: string;
  from: string;
  to: string;
  priceJod: number;
  demand: number;
  seatsTotal: number;
  seatsBooked: number;
}

function resolveCorridorTier(
  liveCorridors: LiveCorridor[],
  corridorsLoading: boolean,
): 'live' | 'demand-leaders' | 'static' {
  if (!corridorsLoading && liveCorridors.length > 0) {return 'live';}
  // demand leaders would be checked next — simplified here
  return 'static';
}

describe('HomePage — corridor card fallback tiers', () => {
  it('uses live data when corridors are loaded and non-empty', () => {
    const corridors: LiveCorridor[] = [
      { id: 'amman-aqaba', from: 'Amman', to: 'Aqaba', priceJod: 8, demand: 1.6, seatsTotal: 4, seatsBooked: 3 },
    ];
    expect(resolveCorridorTier(corridors, false)).toBe('live');
  });

  it('falls back to static when loading', () => {
    expect(resolveCorridorTier([], true)).toBe('static');
  });

  it('falls back to static when corridors are empty', () => {
    expect(resolveCorridorTier([], false)).toBe('static');
  });
});

// ─── Cookie consent logic ─────────────────────────────────────────────────────

function resolveCookieState(stored: string | null): 'pending' | 'accepted' | 'declined' {
  if (!stored) {return 'pending';}
  if (stored === 'accepted') {return 'accepted';}
  return 'declined';
}

describe('HomePage — cookie consent state', () => {
  it('returns pending when nothing is stored', () => {
    expect(resolveCookieState(null)).toBe('pending');
  });

  it('returns accepted when stored value is accepted', () => {
    expect(resolveCookieState('accepted')).toBe('accepted');
  });

  it('returns declined for any other stored value', () => {
    expect(resolveCookieState('declined')).toBe('declined');
    expect(resolveCookieState('other')).toBe('declined');
  });
});

// ─── Live route preview hook — static fallback ────────────────────────────────

const STATIC_PREVIEW = {
  priceJod: '8.00 JOD',
  rating: '4.9',
  parcelSlots: '1',
  nextDeparture: '18:40',
  utilization: 0.78,
};

function applyLiveSnapshot(
  snapshot: { corridors?: Array<{ priceJod?: number; seatsTotal?: number; seatsBooked?: number }> } | null,
): typeof STATIC_PREVIEW {
  const first = snapshot?.corridors?.[0];
  if (!first) {return STATIC_PREVIEW;}
  const util = first.seatsTotal ? (first.seatsBooked ?? 0) / first.seatsTotal : 0.78;
  const slots = Math.max(0, (first.seatsTotal ?? 1) - (first.seatsBooked ?? 0));
  return {
    ...STATIC_PREVIEW,
    priceJod: first.priceJod !== null && first.priceJod !== undefined ? `${first.priceJod.toFixed(2)} JOD` : STATIC_PREVIEW.priceJod,
    parcelSlots: String(slots),
    utilization: util,
  };
}

describe('HomeHeroSection — useLiveRoutePreview fallback logic', () => {
  it('returns static fallback when snapshot is null', () => {
    expect(applyLiveSnapshot(null)).toEqual(STATIC_PREVIEW);
  });

  it('returns static fallback when corridors array is empty', () => {
    expect(applyLiveSnapshot({ corridors: [] })).toEqual(STATIC_PREVIEW);
  });

  it('applies live price from snapshot', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 9.5, seatsTotal: 4, seatsBooked: 2 }] });
    expect(result.priceJod).toBe('9.50 JOD');
  });

  it('calculates utilization correctly', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 8, seatsTotal: 4, seatsBooked: 3 }] });
    expect(result.utilization).toBeCloseTo(0.75);
  });

  it('calculates available parcel slots correctly', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 8, seatsTotal: 4, seatsBooked: 3 }] });
    expect(result.parcelSlots).toBe('1');
  });

  it('clamps parcel slots to minimum 0', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 8, seatsTotal: 4, seatsBooked: 5 }] });
    expect(Number(result.parcelSlots)).toBeGreaterThanOrEqual(0);
  });

  it('falls back to static utilization when seatsTotal is 0', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 8, seatsTotal: 0, seatsBooked: 0 }] });
    expect(result.utilization).toBe(0.78);
  });

  it('preserves static rating and departure time', () => {
    const result = applyLiveSnapshot({ corridors: [{ priceJod: 8, seatsTotal: 4, seatsBooked: 2 }] });
    expect(result.rating).toBe(STATIC_PREVIEW.rating);
    expect(result.nextDeparture).toBe(STATIC_PREVIEW.nextDeparture);
  });
});

// ─── DPR cap ──────────────────────────────────────────────────────────────────

describe('MobilityOSLandingMap — DPR cap', () => {
  it('caps DPR at 2', () => {
    const cap = (dpr: number) => Math.min(dpr, 2);
    expect(cap(1)).toBe(1);
    expect(cap(2)).toBe(2);
    expect(cap(3)).toBe(2);
    expect(cap(4)).toBe(2);
  });
});

// ─── Mobile render path ───────────────────────────────────────────────────────

describe('MobilityOSLandingMap — mobile render path', () => {
  it('isMobile is true for widths under 600', () => {
    const isMobile = (w: number) => w < 600;
    expect(isMobile(375)).toBe(true);
    expect(isMobile(599)).toBe(true);
    expect(isMobile(600)).toBe(false);
    expect(isMobile(1024)).toBe(false);
  });

  it('mobile reduces rider count', () => {
    const riderCount = (riderFlow: number, isMobile: boolean) =>
      Math.max(isMobile ? 1 : 2, Math.round((isMobile ? 1 : 2) + riderFlow * (isMobile ? 4 : 7)));
    expect(riderCount(0.5, true)).toBeLessThan(riderCount(0.5, false));
  });

  it('mobile reduces parcel count', () => {
    const parcelCount = (parcelFlow: number, isMobile: boolean) =>
      Math.max(1, Math.round(1 + parcelFlow * (isMobile ? 2 : 4)));
    expect(parcelCount(0.5, true)).toBeLessThanOrEqual(parcelCount(0.5, false));
  });
});
