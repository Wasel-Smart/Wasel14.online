import { describe, it, expect, beforeEach } from 'vitest';
import { setCurrentLang, tx } from '../../src/locales/tx';

const KEYS_USED_BY_LANDING_SECTIONS = [
  'landing.features.title',
  'landing.features.verified',
  'landing.features.verifiedDesc',
  'landing.features.affordable',
  'landing.features.affordableDesc',
  'landing.features.flexible',
  'landing.features.flexibleDesc',
  'landing.features.support',
  'landing.features.supportDesc',
  'landing.features.secure',
  'landing.features.secureDesc',
  'landing.features.tracking',
  'landing.features.trackingDesc',
  'landing.services.title',
  'landing.services.subtitle',
  'landing.services.ridesharing',
  'landing.services.ridesharingDesc',
  'landing.services.delivery',
  'landing.services.deliveryDesc',
  'landing.services.freight',
  'landing.services.freightDesc',
  'landing.services.carpool',
  'landing.services.carpoolDesc',
  'landing.services.school',
  'landing.services.schoolDesc',
  'landing.services.luxury',
  'landing.services.luxuryDesc',
  'landing.stats.users',
  'landing.stats.trips',
  'landing.stats.cities',
  'landing.stats.drivers',
  'landing.cta.title',
  'landing.cta.signUpNow',
  'homeSections.quickActionsCTA',
];

// tx() returns the key itself when a lookup misses, so a resolved value must
// differ from the requested key. Anything equal here is a raw leak into the UI.
function assertResolved(key: string, lang: 'en' | 'ar') {
  const value = tx(key);
  expect(value, `${lang}:${key}`).not.toBe(key);
  expect(value.trim().length, `${lang}:${key} resolved empty`).toBeGreaterThan(0);
}

describe('landing page translation keys resolve', () => {
  beforeEach(() => {
    setCurrentLang('en');
  });

  for (const lang of ['en', 'ar'] as const) {
    describe(lang, () => {
      beforeEach(() => {
        setCurrentLang(lang);
      });

      for (const key of KEYS_USED_BY_LANDING_SECTIONS) {
        it(`resolves ${key}`, () => {
          assertResolved(key, lang);
        });
      }
    });
  }
});
