import { describe, it, expect, beforeEach } from 'vitest';
import { setCurrentLang, tx } from '../../src/locales/tx';

// Every scheduleExpanded.* key used in SchedulePage.tsx and ScheduleItemCard.tsx.
// tx() returns the requested key itself when a lookup misses, so a value equal
// to the key is a raw leak into the UI rather than a translation.
const SCHEDULE_KEYS = [
  'scheduleExpanded.ride',
  'scheduleExpanded.typeDelivery',
  'scheduleExpanded.typeReturn',
  'scheduleExpanded.schedule',
  'scheduleExpanded.planTripsAndPickupsInAdvance',
  'scheduleExpanded.newSchedule',
  'scheduleExpanded.newScheduledItem',
  'scheduleExpanded.type',
  'scheduleExpanded.rideOption',
  'scheduleExpanded.packageDelivery',
  'scheduleExpanded.packageReturn',
  'scheduleExpanded.pickupLocation',
  'scheduleExpanded.enterPickupLocation',
  'scheduleExpanded.locating',
  'scheduleExpanded.useMyLocation',
  'scheduleExpanded.locationCaptured',
  'scheduleExpanded.dropoffLocation',
  'scheduleExpanded.enterDropoffLocation',
  'scheduleExpanded.dateAndTime',
  'scheduleExpanded.recurrence',
  'scheduleExpanded.oneTime',
  'scheduleExpanded.daily',
  'scheduleExpanded.weekly',
  'scheduleExpanded.biweekly',
  'scheduleExpanded.monthly',
  'scheduleExpanded.notes',
  'scheduleExpanded.additionalNotesOptional',
  'scheduleExpanded.confirmSchedule',
  'scheduleExpanded.scheduling',
  'scheduleExpanded.loadingYourSchedule',
  'scheduleExpanded.loading',
  'scheduleExpanded.upcoming',
  'scheduleExpanded.noScheduledRidesOrDeliveries',
  'scheduleExpanded.past',
  'scheduleExpanded.showLess',
  'scheduleExpanded.showAll',
  'scheduleExpanded.cancelThisScheduledItem',
  'scheduleExpanded.yesCancel',
  'scheduleExpanded.keep',
  'scheduleExpanded.showingSavedCopy',
];

// Every safetyExpanded.* key used in SafetyPage.tsx.
const SAFETY_KEYS = [
  'safetyExpanded.verifiedIdentity',
  'safetyExpanded.identityDetail',
  'safetyExpanded.step',
  'safetyExpanded.emergencyHelp',
  'safetyExpanded.emergencyDetail',
  'safetyExpanded.seconds',
  'safetyExpanded.tripEvidence',
  'safetyExpanded.evidenceDetail',
  'safetyExpanded.percentage',
  'safetyExpanded.comfortControls',
  'safetyExpanded.comfortDetail',
  'safetyExpanded.rails',
  'safetyExpanded.beforeBooking',
  'safetyExpanded.beforeBookingDetail',
  'safetyExpanded.duringTrip',
  'safetyExpanded.duringTripDetail',
  'safetyExpanded.afterTrip',
  'safetyExpanded.afterTripDetail',
  'safetyExpanded.needHelpNow',
  'safetyExpanded.supportAvailable247',
  'safetyExpanded.getHelpNow',
  'safetyExpanded.callEmergency',
  'safetyExpanded.eyebrow',
  'safetyExpanded.title',
  'safetyExpanded.description',
  'safetyExpanded.alwaysVisible',
  'safetyExpanded.trustGates',
  'safetyExpanded.responsePath',
  'safetyExpanded.tripProof',
  'safetyExpanded.supportState',
  'safetyExpanded.protectionStackTitle',
  'safetyExpanded.protectionStackSubtitle',
  'safetyExpanded.emergencyFlowTitle',
  'safetyExpanded.emergencyFlowSubtitle',
];

describe('scheduleExpanded & safetyExpanded translation keys resolve', () => {
  for (const lang of ['en', 'ar'] as const) {
    describe(lang, () => {
      beforeEach(() => {
        setCurrentLang(lang);
      });

      for (const key of SCHEDULE_KEYS) {
        it(`resolves ${key}`, () => {
          const value = tx(key);
          expect(value, `${lang}:${key}`).not.toBe(key);
          expect(value.trim().length, `${lang}:${key} resolved empty`).toBeGreaterThan(0);
        });
      }

      for (const key of SAFETY_KEYS) {
        it(`resolves ${key}`, () => {
          const value = tx(key);
          expect(value, `${lang}:${key}`).not.toBe(key);
          expect(value.trim().length, `${lang}:${key} resolved empty`).toBeGreaterThan(0);
        });
      }
    });
  }
});