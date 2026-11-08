/**
 * Edge function tests — wallet money-out PIN gate
 *
 * Run with:
 *   npm run test:edge -- wallet-pin-gate
 *
 * A wallet without a PIN has no second factor, so only small amounts may leave it
 * until the owner sets one. These tests cover the no-PIN branch, which needs no
 * database; the PIN-present branch is rate-limited in Postgres and is exercised
 * by the integration suite.
 *
 * `_handlers/shared.ts` reads its environment at module scope, so the variables it
 * needs are set before the first import (same pattern as payments.test.ts).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const { enforceWalletPin } = await import('../make-server-0b1f4071/_handlers/wallet.ts');

type Admin = Parameters<typeof enforceWalletPin>[0];

// The no-PIN branch must never touch the database, so any use of the client fails the test.
const untouchedAdmin = new Proxy({}, {
  get() {
    throw new Error('The no-PIN branch must not query the database');
  },
}) as unknown as Admin;

Deno.test('enforceWalletPin — a small amount may leave a wallet that has no PIN', async () => {
  const denied = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: null }, undefined, 10);
  assertEquals(denied, null);
});

Deno.test('enforceWalletPin — setting the first PIN (amount 0) is allowed without one', async () => {
  const denied = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: null }, undefined);
  assertEquals(denied, null);
});

Deno.test('enforceWalletPin — a large amount from a wallet with no PIN is refused with PIN_SETUP_REQUIRED', async () => {
  const denied = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: null }, undefined, 500);
  assertEquals(denied?.status, 403);
  const body = await denied?.json();
  assertEquals(body.code, 'PIN_SETUP_REQUIRED');
});

Deno.test('enforceWalletPin — the cap is inclusive at JOD 25', async () => {
  assertEquals(await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: null }, undefined, 25), null);
  const over = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: null }, undefined, 25.01);
  assertEquals(over?.status, 403);
});

Deno.test('enforceWalletPin — a wallet with a PIN refuses a missing or malformed PIN before any lookup', async () => {
  const missing = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: 'pbkdf2_sha256$x' }, undefined, 5);
  assertEquals(missing?.status, 403);
  assertEquals((await missing?.json()).code, 'PIN_REQUIRED');

  const malformed = await enforceWalletPin(untouchedAdmin, 'user-1', { pin_hash: 'pbkdf2_sha256$x' }, '12ab', 5);
  assertEquals(malformed?.status, 403);
  assertEquals((await malformed?.json()).code, 'PIN_REQUIRED');
});
