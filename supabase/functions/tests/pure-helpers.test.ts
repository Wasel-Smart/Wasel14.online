/**
 * Edge function tests — pure-helpers module
 *
 * Run with:
 *   npm run test:edge -- pure-helpers
 *
 * Every function tested here is side-effect-free (no Deno.env, no fetch, no DB).
 * The module is imported directly from _shared/pure-helpers.ts so these tests
 * are completely independent of the Supabase/Stripe runtime in shared.ts.
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const {
  parseWalletRoute,
  parseEntityRoute,
  formatDate,
  formatTime,
  toIsoFromUnix,
  sanitizePlainText,
  normalizeProviderStatus,
  isSuccessfulProviderStatus,
  isFailedProviderStatus,
  mapBookingRow,
  mapPackageRow,
  isWebhookRoute,
  mapSubscriptionPlan,
  buildSubscriptionRecord,
  isPlainObject,
  firstStringValue,
  isPhoneNumberUniqueViolation,
  isExpired,
  isOlderThanHours,
} = await import( '../make-server-0b1f4071/_shared/pure-helpers.ts' );

// ── parseWalletRoute ──────────────────────────────────────────────────────────

Deno.test( 'parseWalletRoute — parses /wallet/:userId', () => {
  const r = parseWalletRoute( '/wallet/user-123' );
  assertEquals( r?.userId, 'user-123' );
  assertEquals( r?.action, '' );
  assertEquals( r?.resourceId, null );
} );

Deno.test( 'parseWalletRoute — parses /wallet/:userId/transactions', () => {
  const r = parseWalletRoute( '/wallet/user-123/transactions' );
  assertEquals( r?.action, 'transactions' );
  assertEquals( r?.resourceId, null );
} );

Deno.test( 'parseWalletRoute — parses /wallet/:userId/pin/set', () => {
  const r = parseWalletRoute( '/wallet/user-123/pin/set' );
  assertEquals( r?.action, 'pin' );
  assertEquals( r?.resourceId, 'set' );
} );

Deno.test( 'parseWalletRoute — URL-decodes path segments', () => {
  const r = parseWalletRoute( '/wallet/user%2F123/top-up' );
  assertEquals( r?.userId, 'user/123' );
  assertEquals( r?.action, 'top-up' );
} );

Deno.test( 'parseWalletRoute — returns null for non-wallet paths', () => {
  assertEquals( parseWalletRoute( '/bookings/b-1' ), null );
  assertEquals( parseWalletRoute( '/wallet' ), null );
  assertEquals( parseWalletRoute( '' ), null );
} );

// ── parseEntityRoute ──────────────────────────────────────────────────────────

Deno.test( 'parseEntityRoute — parses /bookings/:id', () => {
  const r = parseEntityRoute( '/bookings/b-1', 'bookings' );
  assertEquals( r?.id, 'b-1' );
  assertEquals( r?.action, null );
} );

Deno.test( 'parseEntityRoute — parses /bookings/:id/cancel', () => {
  const r = parseEntityRoute( '/bookings/b-1/cancel', 'bookings' );
  assertEquals( r?.id, 'b-1' );
  assertEquals( r?.action, 'cancel' );
} );

Deno.test( 'parseEntityRoute — returns null for wrong prefix', () => {
  assertEquals( parseEntityRoute( '/trips/t-1', 'bookings' ), null );
} );

// ── formatDate ────────────────────────────────────────────────────────────────

Deno.test( 'formatDate — formats a valid ISO string to YYYY-MM-DD', () => {
  assertEquals( formatDate( '2026-10-15T08:00:00Z' ), '2026-10-15' );
} );

Deno.test( 'formatDate — returns fallback for invalid input', () => {
  assertEquals( formatDate( 'not-a-date', '2000-01-01' ), '2000-01-01' );
  assertEquals( formatDate( null, '2000-01-01' ), '2000-01-01' );
} );

// ── formatTime ────────────────────────────────────────────────────────────────

Deno.test( 'formatTime — extracts HH:MM from ISO string', () => {
  assertEquals( formatTime( '2026-10-15T14:30:00Z' ), '14:30' );
} );

Deno.test( 'formatTime — returns 08:00 for invalid input', () => {
  assertEquals( formatTime( 'bad' ), '08:00' );
  assertEquals( formatTime( null ), '08:00' );
} );

Deno.test( 'formatTime — preserves HH:MM strings that are not ISO dates', () => {
  // A bare "09:45" is not a valid Date, so it falls back to slicing the string.
  assertEquals( formatTime( '09:45' ), '09:45' );
} );

// ── toIsoFromUnix ─────────────────────────────────────────────────────────────

Deno.test( 'toIsoFromUnix — converts a Unix timestamp to ISO string', () => {
  assertEquals( toIsoFromUnix( 0 ), null ); // 0 is falsy
  assertEquals( toIsoFromUnix( 1_700_000_000 ), new Date( 1_700_000_000_000 ).toISOString() );
} );

Deno.test( 'toIsoFromUnix — returns null for invalid values', () => {
  assertEquals( toIsoFromUnix( null ), null );
  assertEquals( toIsoFromUnix( 'abc' ), null );
  assertEquals( toIsoFromUnix( -1 ), null );
} );

// ── sanitizePlainText ─────────────────────────────────────────────────────────

Deno.test( 'sanitizePlainText — strips HTML tags', () => {
  assertEquals( sanitizePlainText( '<b>hello</b>' ), 'hello' );
  assertEquals( sanitizePlainText( '<script>alert(1)</script>' ), 'alert(1)' );
} );

Deno.test( 'sanitizePlainText — strips javascript: and data: URIs', () => {
  assertEquals( sanitizePlainText( 'javascript:alert(1)' ), 'alert(1)' );
  assertEquals( sanitizePlainText( 'data:text/html,<h1>x</h1>' ), 'text/html,x' );
} );

Deno.test( 'sanitizePlainText — collapses whitespace', () => {
  assertEquals( sanitizePlainText( '  hello   world  ' ), 'hello world' );
} );

Deno.test( 'sanitizePlainText — truncates to maxLength', () => {
  assertEquals( sanitizePlainText( 'abcdef', 3 ), 'abc' );
} );

Deno.test( 'sanitizePlainText — handles null/undefined gracefully', () => {
  assertEquals( sanitizePlainText( null ), '' );
  assertEquals( sanitizePlainText( undefined ), '' );
} );

// ── normalizeProviderStatus ───────────────────────────────────────────────────

Deno.test( 'normalizeProviderStatus — lowercases and collapses separators', () => {
  assertEquals( normalizeProviderStatus( 'PAYMENT_SUCCEEDED' ), 'payment_succeeded' );
  assertEquals( normalizeProviderStatus( 'payment-succeeded' ), 'payment_succeeded' );
  assertEquals( normalizeProviderStatus( 'payment succeeded' ), 'payment_succeeded' );
} );

Deno.test( 'isSuccessfulProviderStatus — recognizes all success variants', () => {
  for ( const s of [ 'success', 'succeeded', 'paid', 'posted', 'completed', 'complete', 'approved', 'verified' ] ) {
    assertEquals( isSuccessfulProviderStatus( s ), true, `expected ${ s } to be successful` );
    assertEquals( isSuccessfulProviderStatus( s.toUpperCase() ), true );
  }
  assertEquals( isSuccessfulProviderStatus( 'failed' ), false );
} );

Deno.test( 'isFailedProviderStatus — recognizes all failure variants', () => {
  for ( const s of [ 'failed', 'failure', 'rejected', 'declined', 'cancelled', 'canceled', 'expired' ] ) {
    assertEquals( isFailedProviderStatus( s ), true, `expected ${ s } to be failed` );
  }
  assertEquals( isFailedProviderStatus( 'succeeded' ), false );
} );

// ── mapBookingRow ─────────────────────────────────────────────────────────────

Deno.test( 'mapBookingRow — normalizes id and booking_id from booking_id column', () => {
  const row = mapBookingRow( { booking_id: 'b-1', booking_status: 'confirmed', amount: 10 } );
  assertEquals( row.id, 'b-1' );
  assertEquals( row.booking_id, 'b-1' );
  assertEquals( row.status, 'confirmed' );
  assertEquals( row.booking_status, 'confirmed' );
} );

Deno.test( 'mapBookingRow — falls back to id column when booking_id is absent', () => {
  const row = mapBookingRow( { id: 'b-2', amount: 5 } );
  assertEquals( row.id, 'b-2' );
  assertEquals( row.booking_id, 'b-2' );
} );

Deno.test( 'mapBookingRow — computes amount from total_price when amount is absent', () => {
  const row = mapBookingRow( { booking_id: 'b-3', total_price: 7.5 } );
  assertEquals( row.amount, 7.5 );
  assertEquals( row.total_price, 7.5 );
} );

Deno.test( 'mapBookingRow — defaults seats_requested to 1', () => {
  const row = mapBookingRow( { booking_id: 'b-4' } );
  assertEquals( row.seats_requested, 1 );
} );

// ── mapPackageRow ─────────────────────────────────────────────────────────────

Deno.test( 'mapPackageRow — normalizes id and package_id', () => {
  const row = mapPackageRow( { package_id: 'p-1', status: 'in_transit', delivery_fee: 2 } );
  assertEquals( row.id, 'p-1' );
  assertEquals( row.package_id, 'p-1' );
  assertEquals( row.status, 'in_transit' );
  assertEquals( row.delivery_fee, 2 );
} );

Deno.test( 'mapPackageRow — defaults status to posted', () => {
  const row = mapPackageRow( { package_id: 'p-2' } );
  assertEquals( row.status, 'posted' );
} );

// ── isWebhookRoute ────────────────────────────────────────────────────────────

Deno.test( 'isWebhookRoute — recognizes all registered webhook prefixes', () => {
  assertEquals( isWebhookRoute( '/payments/webhooks/stripe' ), true );
  assertEquals( isWebhookRoute( '/auth/hooks/send-sms' ), true );
  assertEquals( isWebhookRoute( '/events' ), true );
  assertEquals( isWebhookRoute( '/webhooks/anything' ), true );
} );

Deno.test( 'isWebhookRoute — strips /v1 prefix before matching', () => {
  assertEquals( isWebhookRoute( '/v1/payments/webhooks/stripe' ), true );
  assertEquals( isWebhookRoute( '/v1/auth/hooks/send-sms' ), true );
} );

Deno.test( 'isWebhookRoute — returns false for non-webhook paths', () => {
  assertEquals( isWebhookRoute( '/bookings' ), false );
  assertEquals( isWebhookRoute( '/wallet/user-1/pay' ), false );
  assertEquals( isWebhookRoute( '/v1/trips' ), false );
} );

// ── mapSubscriptionPlan ───────────────────────────────────────────────────────

Deno.test( 'mapSubscriptionPlan — maps known plan names', () => {
  assertEquals( mapSubscriptionPlan( 'Wasel Plus' ), 'premium' );
  assertEquals( mapSubscriptionPlan( 'Enterprise Plan' ), 'enterprise' );
  assertEquals( mapSubscriptionPlan( 'Basic Starter' ), 'basic' );
  assertEquals( mapSubscriptionPlan( 'starter' ), 'basic' );
} );

Deno.test( 'mapSubscriptionPlan — defaults unknown names to premium', () => {
  assertEquals( mapSubscriptionPlan( 'unknown-plan' ), 'premium' );
  assertEquals( mapSubscriptionPlan( '' ), 'premium' );
} );

// ── buildSubscriptionRecord ───────────────────────────────────────────────────

Deno.test( 'buildSubscriptionRecord — maps Stripe subscription to DB record', () => {
  const sub = {
    id: 'sub_123',
    customer: 'cus_abc',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
    items: { data: [ { price: { id: 'price_xyz', product: 'prod_abc' } } ] },
    metadata: { plan: 'Wasel Plus' },
  };
  const record = buildSubscriptionRecord( 'user-1', sub );
  assertEquals( record.user_id, 'user-1' );
  assertEquals( record.stripe_subscription_id, 'sub_123' );
  assertEquals( record.stripe_customer_id, 'cus_abc' );
  assertEquals( record.stripe_price_id, 'price_xyz' );
  assertEquals( record.stripe_product_id, 'prod_abc' );
  assertEquals( record.status, 'active' );
  assertEquals( record.plan, 'premium' );
  assertEquals( record.cancel_at_period_end, false );
  assertNotEquals( record.current_period_start, null );
} );

Deno.test( 'buildSubscriptionRecord — planOverride takes precedence over metadata', () => {
  const sub = { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { plan: 'basic' } };
  const record = buildSubscriptionRecord( 'user-1', sub, 'Enterprise Plan' );
  assertEquals( record.plan, 'enterprise' );
} );

// ── isPlainObject ─────────────────────────────────────────────────────────────

Deno.test( 'isPlainObject — returns true only for plain objects', () => {
  assertEquals( isPlainObject( {} ), true );
  assertEquals( isPlainObject( { a: 1 } ), true );
  assertEquals( isPlainObject( [] ), false );
  assertEquals( isPlainObject( null ), false );
  assertEquals( isPlainObject( 'string' ), false );
  assertEquals( isPlainObject( 42 ), false );
} );

// ── firstStringValue ──────────────────────────────────────────────────────────

Deno.test( 'firstStringValue — returns first non-empty string from key list', () => {
  assertEquals( firstStringValue( { a: '', b: 'hello', c: 'world' }, [ 'a', 'b', 'c' ] ), 'hello' );
  assertEquals( firstStringValue( { a: 42 }, [ 'a' ] ), '42' );
  assertEquals( firstStringValue( {}, [ 'a', 'b' ] ), '' );
} );

// ── isPhoneNumberUniqueViolation ──────────────────────────────────────────────

Deno.test( 'isPhoneNumberUniqueViolation — detects Postgres 23505 code', () => {
  assertEquals( isPhoneNumberUniqueViolation( { code: '23505', message: 'duplicate key' } ), true );
} );

Deno.test( 'isPhoneNumberUniqueViolation — detects phone constraint name in message', () => {
  assertEquals( isPhoneNumberUniqueViolation( { message: 'duplicate key value violates unique constraint "users_phone_number_key"' } ), true );
} );

Deno.test( 'isPhoneNumberUniqueViolation — returns false for unrelated errors', () => {
  assertEquals( isPhoneNumberUniqueViolation( { code: '42703', message: 'column does not exist' } ), false );
  assertEquals( isPhoneNumberUniqueViolation( null ), false );
} );

// ── isExpired ─────────────────────────────────────────────────────────────────

Deno.test( 'isExpired — returns true for a past timestamp', () => {
  assertEquals( isExpired( new Date( Date.now() - 1000 ).toISOString() ), true );
} );

Deno.test( 'isExpired — returns false for a future timestamp', () => {
  assertEquals( isExpired( new Date( Date.now() + 60_000 ).toISOString() ), false );
} );

Deno.test( 'isExpired — returns false for null/undefined', () => {
  assertEquals( isExpired( null ), false );
  assertEquals( isExpired( undefined ), false );
} );

// ── isOlderThanHours ──────────────────────────────────────────────────────────

Deno.test( 'isOlderThanHours — returns true when timestamp is older than threshold', () => {
  const twoHoursAgo = new Date( Date.now() - 2 * 60 * 60 * 1000 ).toISOString();
  assertEquals( isOlderThanHours( twoHoursAgo, 1 ), true );
} );

Deno.test( 'isOlderThanHours — returns false when timestamp is within threshold', () => {
  const thirtyMinutesAgo = new Date( Date.now() - 30 * 60 * 1000 ).toISOString();
  assertEquals( isOlderThanHours( thirtyMinutesAgo, 1 ), false );
} );

Deno.test( 'isOlderThanHours — returns false for null', () => {
  assertEquals( isOlderThanHours( null, 1 ), false );
} );
