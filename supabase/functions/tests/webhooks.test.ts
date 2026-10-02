/**
 * Edge function tests — webhooks handler
 *
 * Run with:
 *   deno test --allow-env supabase/functions/tests/webhooks.test.ts
 *
 * These tests exercise the signature-verification layer of each webhook handler
 * without making real network calls. They are the primary safety net for the
 * payment and communication webhook paths.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

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

// ── Stripe ────────────────────────────────────────────────────────────────────

Deno.test('handleStripeWebhook — 503 when secret not configured', async () => {
  Deno.env.delete('STRIPE_WEBHOOK_SECRET');
  const { handleStripeWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleStripeWebhook(makeRequest('/payments/webhooks/stripe', '{}'));
  assertEquals(res.status, 503);
});

Deno.test('handleStripeWebhook — 401 on invalid signature', async () => {
  Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder_for_testing_only');
  const { handleStripeWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', '{"type":"test"}', {
      'stripe-signature': 't=0,v1=invalidsignature',
    }),
  );
  assertEquals(res.status, 401);
});

Deno.test('handleStripeWebhook — 200 on valid signature with unknown event', async () => {
  const secret = 'whsec_placeholder_for_testing_only';
  Deno.env.set('STRIPE_WEBHOOK_SECRET', secret);
  const { handleStripeWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const payload = JSON.stringify({ type: 'unknown.event', data: { object: {} } });
  const sig = await signStripe(payload, secret.replace('whsec_', ''));
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', payload, { 'stripe-signature': sig }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.received, true);
  assertEquals(body.ignored, true);
});

// ── CliQ ──────────────────────────────────────────────────────────────────────

Deno.test('handleCliqWebhook — 503 when secret not configured', async () => {
  Deno.env.delete('CLIQ_WEBHOOK_SECRET');
  const { handleCliqWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleCliqWebhook(makeRequest('/payments/webhooks/cliq', '{}'));
  assertEquals(res.status, 503);
});

Deno.test('handleCliqWebhook — 401 on invalid signature', async () => {
  Deno.env.set('CLIQ_WEBHOOK_SECRET', 'test-cliq-secret-32-chars-minimum!');
  const { handleCliqWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleCliqWebhook(
    makeRequest('/payments/webhooks/cliq', '{"status":"paid"}', {
      'x-cliq-signature': 'invalidsig',
      'x-cliq-timestamp': String(Math.floor(Date.now() / 1000)),
    }),
  );
  assertEquals(res.status, 401);
});

// ── Sanad ─────────────────────────────────────────────────────────────────────

Deno.test('handleSanadWebhook — 503 when secret not configured', async () => {
  Deno.env.delete('SANAD_WEBHOOK_SECRET');
  const { handleSanadWebhook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleSanadWebhook(makeRequest('/trust/webhooks/sanad', '{}'));
  assertEquals(res.status, 503);
});

// ── Send-SMS hook ─────────────────────────────────────────────────────────────

Deno.test('handleSendSmsHook — 503 when secret not configured', async () => {
  Deno.env.delete('SUPABASE_AUTH_HOOK_SEND_SMS_SECRET');
  const { handleSendSmsHook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
  const res = await handleSendSmsHook(
    makeRequest('/auth/hooks/send-sms', '{"phone":"+962791234567","otp":"123456"}'),
  );
  assertEquals(res.status, 503);
});

Deno.test('handleSendSmsHook — 401 on invalid Standard Webhooks signature', async () => {
  Deno.env.set('SUPABASE_AUTH_HOOK_SEND_SMS_SECRET', 'v1,whsec_placeholder_for_testing_only');
  const { handleSendSmsHook } = await import('../make-server-0b1f4071/_handlers/webhooks.ts');
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
