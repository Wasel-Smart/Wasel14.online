/**
 * Edge function tests — webhooks handler
 *
 * Run with:
 *   npm run test:edge -- webhooks
 *
 * These tests exercise the signature-verification layer of each webhook handler
 * without making real network calls. They are the primary safety net for the
 * payment and communication webhook paths.
 *
 * IMPORTANT: `_handlers/shared.ts` reads every secret at module scope
 * (`export const STRIPE_WEBHOOK_SECRET = Deno.env.get(...)`), so the module graph
 * freezes the environment on first import. Every secret this file needs must
 * therefore be set BEFORE the first `import`, and the "secret not configured"
 * cases live in `webhooks-unconfigured.test.ts`, which Deno runs in its own
 * worker under `--parallel` and therefore gets its own module graph.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const STRIPE_SECRET = 'whsec_placeholder_for_testing_only';

Deno.env.set('STRIPE_WEBHOOK_SECRET', STRIPE_SECRET);
Deno.env.set('CLIQ_WEBHOOK_SECRET', 'test-cliq-secret-32-chars-minimum!');
Deno.env.set('SANAD_WEBHOOK_SECRET', 'test-sanad-secret-32-chars-minimum!!');
Deno.env.set('SUPABASE_AUTH_HOOK_SEND_SMS_SECRET', STRIPE_SECRET);

// `handleStripeWebhook` builds the admin client before it branches on the event
// type, so even an unrecognised event needs these present. No request is made for
// an unknown event, so no network access and no real credentials are required.
Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

function makeRequest(path: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://example.supabase.co/functions/v1/webhooks${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

async function signStripe(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

const { handleStripeWebhook, handleCliqWebhook, handleSendSmsHook } = await import(
  '../make-server-0b1f4071/_handlers/webhooks.ts'
);

// ── Stripe ────────────────────────────────────────────────────────────────────

Deno.test('handleStripeWebhook — 401 on invalid signature', async () => {
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', '{"type":"test"}', {
      'stripe-signature': 't=0,v1=invalidsignature',
    }),
  );
  assertEquals(res.status, 401);
});

Deno.test('handleStripeWebhook — 401 on missing signature header', async () => {
  const res = await handleStripeWebhook(makeRequest('/payments/webhooks/stripe', '{"type":"test"}'));
  assertEquals(res.status, 401);
});

Deno.test('handleStripeWebhook — 200 on valid signature with unknown event', async () => {
  const payload = JSON.stringify({ type: 'unknown.event', data: { object: {} } });
  const sig = await signStripe(payload, STRIPE_SECRET);
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', payload, { 'stripe-signature': sig }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.received, true);
  assertEquals(body.ignored, true);
});

// ── CliQ ──────────────────────────────────────────────────────────────────────

Deno.test('handleCliqWebhook — 401 on invalid signature', async () => {
  const res = await handleCliqWebhook(
    makeRequest('/payments/webhooks/cliq', '{"status":"paid"}', {
      'x-cliq-signature': 'invalidsig',
      'x-cliq-timestamp': String(Math.floor(Date.now() / 1000)),
    }),
  );
  assertEquals(res.status, 401);
});

// ── Send-SMS hook ─────────────────────────────────────────────────────────────

Deno.test('handleSendSmsHook — 401 on invalid Standard Webhooks signature', async () => {
  const req = new Request(
    'https://example.supabase.co/functions/v1/webhooks/auth/hooks/send-sms',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': 'msg_test_123',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'webhook-signature': 'v1,invalidsignature==',
      },
      body: JSON.stringify({ phone: '+962791234567', otp: '123456' }),
    },
  );
  const res = await handleSendSmsHook(req);
  assertEquals(res.status, 401);
});
