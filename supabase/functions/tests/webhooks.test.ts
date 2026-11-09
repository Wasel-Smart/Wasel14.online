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
const RESEND_SECRET = `whsec_${btoa('test-resend-signing-key-32-bytes-long')}`;
const AUTH_HOOK_OLD_SECRET = `v1,whsec_${btoa('old-auth-hook-signing-key-32-bytes')}`;
const AUTH_HOOK_NEW_SECRET = `v1,whsec_${btoa('new-auth-hook-signing-key-32-bytes')}`;

Deno.env.set('STRIPE_WEBHOOK_SECRET', STRIPE_SECRET);
Deno.env.set('CLIQ_WEBHOOK_SECRET', 'test-cliq-secret-32-chars-minimum!');
const TWILIO_TEST_SECRET = 'test-twilio-signing-secret-32-chars!';
Deno.env.set('TWILIO_WEBHOOK_SIGNING_SECRET', TWILIO_TEST_SECRET);
Deno.env.set('COMMUNICATION_WEBHOOK_TOKEN', 'test-communication-webhook-token-32chars!');
Deno.env.set('SUPABASE_AUTH_HOOK_SEND_SMS_SECRET', `${AUTH_HOOK_OLD_SECRET}|${AUTH_HOOK_NEW_SECRET}`);
Deno.env.set('RESEND_WEBHOOK_SIGNING_SECRET', RESEND_SECRET);

// `handleStripeWebhook` builds the admin client before it branches on the event
// type, so even an unrecognised event needs these present. No request is made for
// an unknown event, so no network access and no real credentials are required.
Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('STRIPE_SECRET_KEY', 'sk_test_local_only');

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

const { handleStripeWebhook, handleCliqWebhook, handleSendSmsHook, handleTwilioWebhook, handleResendWebhook } = await import(
  '../make-server-0b1f4071/_handlers/webhooks.ts'
);
const { STRIPE_API_VERSION, stripeApiRequest, toStripeMinorUnits, verifyResendWebhookSignature } = await import(
  '../make-server-0b1f4071/_handlers/shared.ts'
);

Deno.test('stripeApiRequest — uses the SDK-supported API version', async () => {
  const originalFetch = globalThis.fetch;
  let observedVersion: string | null = null;
  globalThis.fetch = async (_input, init) => {
    observedVersion = new Headers(init?.headers).get('Stripe-Version');
    return Response.json({ id: 'sub_test' });
  };
  try {
    await stripeApiRequest('/v1/subscriptions/sub_test');
    assertEquals(observedVersion, STRIPE_API_VERSION);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function signResend(payload: string, secret: string, id = 'msg_test_123', timestamp = Math.floor(Date.now() / 1000)) {
  const keyBytes = Uint8Array.from(atob(secret.slice('whsec_'.length)), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return new Headers({
    'svix-id': id,
    'svix-timestamp': String(timestamp),
    'svix-signature': `v1,${signature}`,
  });
}

async function signAuthHook(payload: string, secret: string, id = 'msg_test_123', timestamp = Math.floor(Date.now() / 1000)) {
  const encodedSecret = secret.slice(secret.indexOf('whsec_') + 'whsec_'.length);
  const keyBytes = Uint8Array.from(atob(encodedSecret), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return {
    id,
    timestamp,
    signature,
  };
}

Deno.test('verifyResendWebhookSignature — accepts current Svix signature format', async () => {
  const payload = '{"type":"email.delivered","data":{"email_id":"email_123"}}';
  const headers = await signResend(payload, RESEND_SECRET);
  assertEquals(await verifyResendWebhookSignature(payload, headers), true);
});

Deno.test('verifyResendWebhookSignature — rejects a changed raw payload', async () => {
  const payload = '{"type":"email.delivered"}';
  const headers = await signResend(payload, RESEND_SECRET);
  assertEquals(await verifyResendWebhookSignature(`${payload} `, headers), false);
});

Deno.test('verifyResendWebhookSignature — rejects stale signatures and legacy header format', async () => {
  const payload = '{"type":"email.delivered"}';
  const staleHeaders = await signResend(payload, RESEND_SECRET, 'msg_stale', Math.floor(Date.now() / 1000) - 301);
  const legacyHeaders = new Headers({ 'resend-signature': `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` });
  assertEquals(await verifyResendWebhookSignature(payload, staleHeaders), false);
  assertEquals(await verifyResendWebhookSignature(payload, legacyHeaders), false);
});

Deno.test('handleResendWebhook — rejects unsupported signature headers before database access', async () => {
  const response = await handleResendWebhook(
    new Request('https://example.supabase.co/functions/v1/webhooks/communications/webhooks/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'resend-signature': 'legacy-format' },
      body: '{"type":"email.delivered"}',
    }),
  );
  assertEquals(response.status, 401);
});

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

Deno.test('handleStripeWebhook — 400 (not a retryable 500) when a correctly signed body is not JSON', async () => {
  const payload = '{not json';
  const sig = await signStripe(payload, STRIPE_SECRET);
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', payload, { 'stripe-signature': sig }),
  );
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test('handleStripeWebhook — 400 when a correctly signed body is JSON but not an object', async () => {
  const payload = 'null';
  const sig = await signStripe(payload, STRIPE_SECRET);
  const res = await handleStripeWebhook(
    makeRequest('/payments/webhooks/stripe', payload, { 'stripe-signature': sig }),
  );
  assertEquals(res.status, 400);
  await res.body?.cancel();
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

Deno.test('handleSendSmsHook — accepts either key in an overlapping rotation set', async () => {
  const rawBody = JSON.stringify({ unrelated: true });
  for (const secret of [AUTH_HOOK_OLD_SECRET, AUTH_HOOK_NEW_SECRET]) {
    const signed = await signAuthHook(rawBody, secret);
    const req = new Request('https://example.supabase.co/functions/v1/webhooks/auth/hooks/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': signed.id,
        'webhook-timestamp': String(signed.timestamp),
        'webhook-signature': `v1,${signed.signature}`,
      },
      body: rawBody,
    });
    const res = await handleSendSmsHook(req);
    // Signature validation succeeds; the intentionally incomplete payload then
    // fails validation before any SMS provider request can be made.
    assertEquals(res.status, 400);
  }
});

// ── Twilio ────────────────────────────────────────────────────────────────────

const TWILIO_URL = 'https://example.supabase.co/functions/v1/webhooks/communications/webhooks/twilio';

// Twilio signs the full URL followed by every POST parameter, sorted by name and
// concatenated as name+value, with HMAC-SHA1 (base64).
async function signTwilio(url: string, params: Record<string, string>, secret: string): Promise<string> {
  const data = Object.keys(params).sort().reduce((acc, name) => acc + name + params[name], url);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

function makeTwilioRequest(params: Record<string, string>, signature?: string): Request {
  return new Request(TWILIO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(signature ? { 'x-twilio-signature': signature } : {}),
    },
    body: new URLSearchParams(params).toString(),
  });
}

Deno.test('handleTwilioWebhook — 200 on a valid X-Twilio-Signature (no MessageSid is acknowledged and ignored)', async () => {
  const params = { MessageStatus: 'delivered', AccountSid: 'ACtest' };
  const sig = await signTwilio(TWILIO_URL, params, TWILIO_TEST_SECRET);
  const res = await handleTwilioWebhook(makeTwilioRequest(params, sig));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ignored, true);
});

Deno.test('handleTwilioWebhook — 401 when a signed parameter is tampered with', async () => {
  const signed = { MessageStatus: 'delivered', AccountSid: 'ACtest' };
  const sig = await signTwilio(TWILIO_URL, signed, TWILIO_TEST_SECRET);
  const res = await handleTwilioWebhook(makeTwilioRequest({ ...signed, MessageStatus: 'failed' }, sig));
  assertEquals(res.status, 401);
});

Deno.test('handleTwilioWebhook — 401 with no signature and no URL token', async () => {
  const res = await handleTwilioWebhook(makeTwilioRequest({ MessageStatus: 'delivered' }));
  assertEquals(res.status, 401);
});

Deno.test('handleTwilioWebhook — rejects the legacy query-token fallback', async () => {
  const request = new Request(`${TWILIO_URL}?token=test-communication-webhook-token-32chars!`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MessageStatus: 'delivered' }),
  });
  const response = await handleTwilioWebhook(request);
  assertEquals(response.status, 401);
});

// ── Stripe minor units ────────────────────────────────────────────────────────

Deno.test('toStripeMinorUnits — three-decimal currencies use fils, rounded to a multiple of 10', () => {
  assertEquals(toStripeMinorUnits(12.5, 'JOD'), 12500);
  assertEquals(toStripeMinorUnits(5, 'kwd'), 5000);
  assertEquals(toStripeMinorUnits(5, 'BHD'), 5000);
});

Deno.test('toStripeMinorUnits — two-decimal currencies use x100', () => {
  assertEquals(toStripeMinorUnits(12.34, 'usd'), 1234);
  assertEquals(toStripeMinorUnits(0.5, 'eur'), 50);
  assertEquals(toStripeMinorUnits(100, 'aed'), 10000);
});

Deno.test('toStripeMinorUnits — fails closed for unknown currencies and invalid amounts', () => {
  assertEquals(toStripeMinorUnits(10, 'iqd'), null);
  assertEquals(toStripeMinorUnits(0, 'jod'), null);
  assertEquals(toStripeMinorUnits(-1, 'usd'), null);
  assertEquals(toStripeMinorUnits(Number.NaN, 'jod'), null);
});
