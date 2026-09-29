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
  'servicesFreight',
  'servicesFreightDesc',
  'servicesCarpool',
  'servicesCarpoolDesc',
  'servicesSchool',
  'servicesSchoolDesc',
  'servicesLuxury',
  'servicesLuxuryDesc',
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
