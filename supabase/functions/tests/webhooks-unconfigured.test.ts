/**
 * Edge function tests — webhooks handler, unconfigured-secret paths
 *
 * Run with:
 *   npm run test:edge
 *
 * `_handlers/shared.ts` reads every secret at module scope, so the environment is
 * frozen on first import. These cases need the secrets *absent*, which is
 * incompatible with the signature suites in `webhooks.test.ts` sharing one module
 * graph. Deno gives each test file its own module graph under `--parallel`
 * (which `scripts/run-edge-tests.mjs` passes), so keeping them in a separate file
 * makes both suites meaningful instead of order-dependent.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

for (
  const key of [
    'STRIPE_WEBHOOK_SECRET',
    'CLIQ_WEBHOOK_SECRET',
    'JOPACC_WEBHOOK_SECRET',
    'SANAD_WEBHOOK_SECRET',
    'SUPABASE_AUTH_HOOK_SEND_SMS_SECRET',
    'SEND_SMS_HOOK_SECRET',
  ]
) {
  Deno.env.delete(key);
}

function makeRequest(path: string, body: string): Request {
  return new Request(`https://example.supabase.co/functions/v1/webhooks${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

const { handleStripeWebhook, handleCliqWebhook, handleSanadWebhook, handleSendSmsHook } = await import(
  '../make-server-0b1f4071/_handlers/webhooks.ts'
);

Deno.test('handleStripeWebhook — 503 when secret not configured', async () => {
  const res = await handleStripeWebhook(makeRequest('/payments/webhooks/stripe', '{}'));
  assertEquals(res.status, 503);
});

Deno.test('handleCliqWebhook — 503 when secret not configured', async () => {
  const res = await handleCliqWebhook(makeRequest('/payments/webhooks/cliq', '{}'));
  assertEquals(res.status, 503);
});

Deno.test('handleSanadWebhook — 503 when secret not configured', async () => {
  const res = await handleSanadWebhook(makeRequest('/trust/webhooks/sanad', '{}'));
  assertEquals(res.status, 503);
});

Deno.test('handleSendSmsHook — 503 when secret not configured', async () => {
  const res = await handleSendSmsHook(makeRequest('/auth/hooks/send-sms', '{"phone":"+962791234567","otp":"123456"}'));
  assertEquals(res.status, 503);
});