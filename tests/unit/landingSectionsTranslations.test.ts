import { describe, it, expect, beforeEach } from 'vitest';
import { setCurrentLang, tx } from '../../src/locales/tx';

// Every key the landing sections render. tx() returns the requested key itself
// when a lookup misses, so a value equal to the key is a raw leak into the UI
// rather than a translation. LandingSections previously addressed these as
// 'landing.features.title' etc., which the flat-by-tail resolver silently
// mis-resolved (landing was the only nested chunk in src/locales/chunks).
const KEYS = [
  'featuresTitle',
  'featuresVerified',
  'featuresVerifiedDesc',
  'featuresAffordable',
  'featuresAffordableDesc',
  'featuresFlexible',
  'featuresFlexibleDesc',
  'featuresSupport',
  'featuresSupportDesc',
  'featuresSecure',
  'featuresSecureDesc',
  'featuresTracking',
  'featuresTrackingDesc',
  'servicesTitle',
  'servicesSubtitle',
  'servicesRidesharing',
  'servicesRidesharingDesc',
  'servicesDelivery',
  'servicesDeliveryDesc',
  'servicesCarpool',
  'servicesCarpoolDesc',
  'statsServices',
  'statsCorridors',
  'statsCities',
  'statsRoutes',
  'statsUsers',
  'statsTrips',
  'statsDrivers',
  'ctaTitle',
  'ctaSubtitle',
  'ctaSignUpNow',
  'ctaDownloadApp',
  'heroTitle',
  'heroSubtitle',
  'heroGetStarted',
  'homeSections.statsTitle',
  'homeSections.quickActionsCTA',
  'homeSections.bentoRidersTitle',
  'homeSections.bentoRidersDesc',
  'homeSections.bentoRidersPoint1',
  'homeSections.bentoRidersPoint2',
  'homeSections.bentoRidersPoint3',
  'homeSections.bentoDriversTitle',
  'homeSections.bentoDriversDesc',
  'homeSections.bentoDriversPoint1',
  'homeSections.bentoDriversPoint2',
  'homeSections.bentoDriversPoint3',
  'homeSections.bentoParcelsTitle',
  'homeSections.bentoParcelsDesc',
  'homeSections.bentoParcelsPoint1',
  'homeSections.bentoParcelsPoint2',
  'homeSections.bentoParcelsPoint3',
  'homeSections.bentoBusTitle',
  'homeSections.bentoBusDesc',
  'homeSections.bentoBusPoint1',
  'homeSections.bentoBusPoint2',
  'homeSections.bentoBusPoint3',
  'homeSections.coverageKicker',
  'homeSections.coverageTitle',
  'homeSections.coverageSubtitle',
  'homeSections.coverageJordanLive',
  'homeSections.coverageJordanStatus',
  'homeSections.coverageLevant',
  'homeSections.coverageLevantStatus',
  'homeSections.coverageGCC',
  'homeSections.coverageGCCStatus',
  'homeSections.coverageNorthAfrica',
  'homeSections.coverageNorthAfricaStatus',
  'homeSections.coverageEastAfrica',
  'homeSections.coverageEastAfricaStatus',
  'homeSections.coverageNote',
  'homeSections.coverageDestinationsTitle',
  'homeSections.coverageCta',
  'homeHeroSection.first_only_badge',
  'homeHeroSection.ticker_live_label',
];

describe('landing page translation keys resolve', () => {
  for (const lang of ['en', 'ar'] as const) {
    describe(lang, () => {
      beforeEach(() => {
        setCurrentLang(lang);
      });

      for (const key of KEYS) {
        it(`resolves ${key}`, () => {
          const value = tx(key);
          expect(value, `${lang}:${key}`).not.toBe(key);
          expect(value.trim().length, `${lang}:${key} resolved empty`).toBeGreaterThan(0);
        });
      }
    });
  }
});
