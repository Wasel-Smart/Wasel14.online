/**
 * Edge function tests — `POST /events` service-role boundary
 *
 * Run with:
 *   npm run test:edge
 *
 * Regression cover for the async event pipeline defect.
 *
 * `outbox-worker` drains `event_outbox` and forwards each row to
 * `<function>/events`. No target function implemented that path, so every
 * drained event was answered 404, retried five times and dead-lettered. The
 * sink added to `make-server-0b1f4071` is the one that receives
 * `notifications.dispatch`, so it is also the endpoint where a missing
 * authorization check would become a cross-account notification write.
 *
 * These tests pin the authentication and validation contract before any handler
 * runs: a request without the service-role key must be rejected even when the
 * payload is well formed, and a service-role request for an unsupported topic
 * must be refused rather than silently acknowledged.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const { handleEventRequest } = await import('../make-server-0b1f4071/_handlers/events.ts');
const { SUPABASE_SERVICE_ROLE_KEY } = await import('../make-server-0b1f4071/_handlers/shared.ts');

function makeEventRequest(body: unknown, bearer?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (bearer !== undefined) {headers.set('authorization', `Bearer ${bearer}`);}
  return new Request('https://example.supabase.co/functions/v1/make-server-0b1f4071/events', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const validDispatch = {
  id: 'ntf_test_1',
  topic: 'notifications.dispatch',
  payload: {
    userId: 'user-1',
    title: 'Driver assigned',
    message: 'A driver has been assigned to your ride.',
    type: 'booking',
    priority: 'high',
  },
};

Deno.test('/events rejects a request with no Authorization header', async () => {
  const response = await handleEventRequest(makeEventRequest(validDispatch));

  assertEquals(response.status, 401);
  assertEquals((await response.json() as { error: string }).error, 'Unauthorized');
});

Deno.test('/events rejects an ordinary user JWT instead of trusting its shape', async () => {
  const response = await handleEventRequest(
    makeEventRequest(validDispatch, 'a-user-access-token'),
  );

  assertEquals(response.status, 401);
});

Deno.test('/events rejects a service-role key with a trailing character appended', async () => {
  const response = await handleEventRequest(
    makeEventRequest(validDispatch, `${SUPABASE_SERVICE_ROLE_KEY}x`),
  );

  assertEquals(response.status, 401);
});

Deno.test('/events rejects a service-role key sent without the Bearer scheme', async () => {
  const request = new Request(
    'https://example.supabase.co/functions/v1/make-server-0b1f4071/events',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify(validDispatch),
    },
  );

  const response = await handleEventRequest(request);

  assertEquals(response.status, 401);
});

Deno.test('/events refuses an unsupported topic even for a service-role caller', async () => {
  const response = await handleEventRequest(
    makeEventRequest({ ...validDispatch, topic: 'admin.purge-everything' }, SUPABASE_SERVICE_ROLE_KEY),
  );

  assertEquals(response.status, 400);
  assert(
    ((await response.json() as { error: string }).error).includes('Unsupported topic'),
    'an unknown topic must be rejected, not routed to a default handler',
  );
});

Deno.test('/events rejects a malformed body before touching the database', async () => {
  const cases: Array<{ label: string; body: unknown }> = [
    { label: 'missing id', body: { topic: 'notifications.dispatch', payload: {} } },
    { label: 'missing topic', body: { id: 'ntf_test_2', payload: {} } },
    { label: 'missing payload', body: { id: 'ntf_test_2', topic: 'notifications.dispatch' } },
    { label: 'array payload', body: { id: 'ntf_test_2', topic: 'notifications.dispatch', payload: [] } },
  ];

  for (const { label, body } of cases) {
    const response = await handleEventRequest(makeEventRequest(body, SUPABASE_SERVICE_ROLE_KEY));
    assertEquals(response.status, 400, `expected 400 for ${label}`);
  }
});