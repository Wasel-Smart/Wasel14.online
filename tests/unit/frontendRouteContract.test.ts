import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The edge function is Deno-only and cannot be imported into Vitest, so this
 * suite asserts its contract statically — the same approach as
 * adminConsole.test.ts.
 *
 * These five paths used to be called by the frontend with no matching route, so
 * every one of them was a silent 404 that no type error and no unit test could
 * see. `npm run check:routes` catches that class of drift, but it only compares
 * path strings; it cannot tell you that /reviews answers a body the ratings
 * table cannot store, or that /notifications/send-push would let any
 * authenticated user post into someone else's feed. Those are asserted here.
 */
const ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const EDGE_INDEX = readSource('supabase/functions/make-server-0b1f4071/index.ts');
const ACTIVE_TRIP = readSource(
  'supabase/functions/make-server-0b1f4071/_handlers/activeTrip.ts',
);
const NOTIFICATIONS = readSource(
  'supabase/functions/make-server-0b1f4071/_handlers/notifications.ts',
);
const REVIEWS = readSource(
  'supabase/functions/make-server-0b1f4071/_handlers/reviews.ts',
);
const SHARED = readSource('supabase/functions/make-server-0b1f4071/_handlers/shared.ts');

const ACTIVE_TRIP_API = readSource('src/services/activeTrip.ts');
const NOTIFICATIONS_API = readSource('src/services/notifications.ts');
const PUSH_HOOK = readSource('src/hooks/usePushNotifications.ts');
const LIVE_TRACKING = readSource('src/components/LiveTripTracking.tsx');

describe('previously-unwired frontend paths are routed', () => {
  const requiredRoutes = [
    { id: 'active-trip-get', path: "path === '/active-trip'" },
    { id: 'notifications-list', path: "path === '/notifications'" },
    { id: 'notifications-send-push', path: "path === '/notifications/send-push'" },
    { id: 'notifications-push-pref', path: "path === '/notifications/push-pref'" },
    {
      id: 'notifications-mark-read',
      path: '/^\\/notifications\\/[^/]+\\/read$/',
    },
    { id: 'reviews-submit', path: "path === '/reviews'" },
  ];

  for (const route of requiredRoutes) {
    it(`registers the ${route.id} route`, () => {
      expect(EDGE_INDEX).toContain(`id: '${route.id}'`);
      expect(EDGE_INDEX).toContain(route.path);
    });
  }
});

describe('/active-trip covers every verb the client uses', () => {
  const verbs = [...new Set(
    [...ACTIVE_TRIP_API.matchAll(/method:\s*'([A-Z]+)'/g)].map((m) => m[1]),
  )];

  it('the client only uses verbs the router registers', () => {
    // Guard against the client growing a verb (e.g. PUT) that no route accepts,
    // which would 404 exactly like the original missing-route bug.
    for (const verb of verbs) {
      expect(EDGE_INDEX).toMatch(
        new RegExp(`id: 'active-trip-\\w+',\\s*\\n\\s*methods: \\[ '${verb}' \\]`),
      );
    }
  });

  it('serves GET, which the client sends without an explicit method key', () => {
    // getActiveTrip relies on fetch defaulting to GET, so it is invisible to the
    // scan above — assert it separately or the read path could regress unnoticed.
    expect(EDGE_INDEX).toMatch(/id: 'active-trip-get',\s*\n\s*methods: \[ 'GET' \]/);
  });

  it('scopes every read and write to the authenticated user', () => {
    expect(ACTIVE_TRIP).toContain("eq( 'user_id', auth.canonicalUser.id )");
    expect(ACTIVE_TRIP).not.toMatch(/\.eq\(\s*'user_id',\s*body\./);
  });
});

describe('/reviews honours the client contract, not the /ratings contract', () => {
  it('reads the field names LiveTripTracking actually sends', () => {
    for (const field of ['reviewee_id', 'role', 'overall_rating', 'comment', 'trip_id']) {
      expect(LIVE_TRACKING).toContain(field);
      expect(REVIEWS).toContain(field);
    }
  });

  it('maps them onto the ratings columns instead of aliasing to /ratings', () => {
    expect(REVIEWS).toContain("from( 'ratings' )");
    expect(REVIEWS).toContain('rider_id: canonicalUser.id');
    expect(REVIEWS).toContain('driver_id: revieweeId');
    expect(REVIEWS).toContain('review: comment');
  });

  it('rejects out-of-range scores and empty reviewees', () => {
    expect(REVIEWS).toContain("overall_rating must be between 1 and 5");
    expect(REVIEWS).toContain('reviewee_id is required');
  });

  it('does not require a completed booking, which the client cannot satisfy', () => {
    // The rating sheet fires the moment the ride ends, before the booking is
    // flipped to `completed`. Requiring that status would 409 every real
    // submission and silently drop the review.
    expect(REVIEWS).toContain("'confirmed'");
    expect(REVIEWS).not.toContain("status !== 'completed'");
  });

  it('only lets a rider review a driver they actually travelled with', () => {
    expect(REVIEWS).toContain('You can only review a driver you travelled with');
  });
});

describe('/notifications authorization', () => {
  it('scopes the feed and the read receipt to the caller', () => {
    expect(NOTIFICATIONS).toContain("eq( 'user_id', auth.canonicalUser.id )");
    expect(NOTIFICATIONS_API).toContain('${API_URL}/notifications');
  });

  it('forbids sending a notification to another user without permission', () => {
    // send-push takes a target userId. Without this guard any signed-in user
    // could write into an arbitrary user's feed.
    expect(NOTIFICATIONS).toContain('notifications:send');
    expect(NOTIFICATIONS).toContain('Cannot send notifications to another user');
    expect(NOTIFICATIONS).toContain("recipientId === auth.canonicalUser.id");
  });

  it('persists the browser push opt-in the hook sends', () => {
    expect(PUSH_HOOK).toContain('${ API_URL }/notifications/push-pref');
    expect(PUSH_HOOK).toContain('enabled: perm === \'granted\'');
    expect(NOTIFICATIONS).toContain('push_enabled: enabled');
  });
});

describe('shared input sanitizing used by the new routes', () => {
  it('is exported from the edge shared module', () => {
    expect(SHARED).toContain('export function sanitizePlainText');
    expect(SHARED).toContain('export function isPlainObject');
  });

  it('strips markup and control characters, and clamps length', () => {
    expect(SHARED).toContain('sanitizePlainText');
    const body = SHARED.slice(SHARED.indexOf('export function sanitizePlainText'));
    expect(body.slice(0, 900)).toContain('maxLength');
  });
});

describe('notifications column-pair coalescing', () => {
  it('reads message and body as interchangeable', () => {
    // The edge's own insert sites (trips.ts, bookings.ts x2) still write `body`
    // + `data`, while the client reads `message` + `metadata`. A mapper that
    // only reads the contract pair renders those notifications with blank text,
    // and nothing in the type system catches it.
    expect(NOTIFICATIONS).toContain('row.message ?? row.body');
    expect(NOTIFICATIONS).toContain('row.metadata');
    expect(NOTIFICATIONS).toContain('row.data');
  });

  it('still writes the contract columns for new rows', () => {
    expect(NOTIFICATIONS).toContain('message,');
    expect(NOTIFICATIONS).toContain('metadata: {');
  });
});