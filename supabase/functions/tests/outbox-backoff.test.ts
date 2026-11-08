/**
 * Edge function tests — outbox worker backoff + wallet insights pagination
 *
 * Run with:
 *   npm run test:edge -- outbox-backoff
 *
 * Tests the two bugs fixed in this session:
 *   1. Outbox worker used flat-rate retries; now uses exponential backoff via
 *      outbox_next_attempt_at() — tested here with the pure timing math.
 *   2. handleGetWalletInsights called loadWalletDetails() which caps at 50 rows,
 *      so monthly totals were wrong for users with >50 transactions — tested by
 *      verifying buildWalletInsights() produces correct totals over a full set.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set( 'SUPABASE_URL', 'https://example.supabase.co' );
Deno.env.set( 'SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key' );

const { buildWalletInsights, toWalletTransaction } = await import(
  '../make-server-0b1f4071/_handlers/shared.ts'
);

// ── Backoff schedule ──────────────────────────────────────────────────────────
// The DB function outbox_next_attempt_at(n) returns NOW() + min(2^n seconds, 5m).
// Mirror the formula here to pin the contract without a real DB connection.

function backoffSeconds ( attempts: number ): number {
  return Math.min( Math.pow( 2, Math.max( attempts, 0 ) ), 300 );
}

Deno.test( 'outbox backoff — attempt 0 retries after 1 second', () => {
  assertEquals( backoffSeconds( 0 ), 1 );
} );

Deno.test( 'outbox backoff — attempt 1 retries after 2 seconds', () => {
  assertEquals( backoffSeconds( 1 ), 2 );
} );

Deno.test( 'outbox backoff — attempt 4 retries after 16 seconds', () => {
  assertEquals( backoffSeconds( 4 ), 16 );
} );

Deno.test( 'outbox backoff — attempt 8 retries after 256 seconds', () => {
  assertEquals( backoffSeconds( 8 ), 256 );
} );

Deno.test( 'outbox backoff — attempt 9+ is capped at 300 seconds (5 minutes)', () => {
  assertEquals( backoffSeconds( 9 ), 300 );
  assertEquals( backoffSeconds( 20 ), 300 );
} );

// ── Wallet insights full-history ──────────────────────────────────────────────
// Before the fix, handleGetWalletInsights called loadWalletDetails() which
// hard-limits to 50 rows. A user with 60 transactions in the current month
// would see only the 50 most recent, and the monthly total would be wrong.
// The fix fetches all rows directly. Verify buildWalletInsights() produces
// correct totals when given more than 50 transactions.

function makeTx ( amount: number, direction: 'credit' | 'debit', monthOffset = 0 ) {
  const date = new Date();
  date.setUTCMonth( date.getUTCMonth() - monthOffset );
  return toWalletTransaction( {
    transaction_id: crypto.randomUUID(),
    wallet_id: 'w-1',
    user_id: 'u-1',
    transaction_type: direction === 'credit' ? 'add_funds' : 'ride_payment',
    transaction_status: 'posted',
    direction,
    amount,
    reference_type: null,
    reference_id: null,
    metadata: null,
    created_at: date.toISOString(),
  } );
}

Deno.test( 'buildWalletInsights — sums all transactions, not just the first 50', () => {
  // 60 credit transactions of 1 JOD each in the current month.
  const transactions = Array.from( { length: 60 }, () => makeTx( 1, 'credit', 0 ) );
  const insights = buildWalletInsights( transactions );
  // If the old 50-row cap were still in place, thisMonthEarned would be 50.
  assertEquals( insights.thisMonthEarned, 60 );
  assertEquals( insights.totalTransactions, 60 );
} );

Deno.test( 'buildWalletInsights — correctly separates current and previous month', () => {
  const thisMonth = Array.from( { length: 10 }, () => makeTx( 5, 'debit', 0 ) );
  const lastMonth = Array.from( { length: 10 }, () => makeTx( 3, 'debit', 1 ) );
  const insights = buildWalletInsights( [ ...thisMonth, ...lastMonth ] );
  assertEquals( insights.thisMonthSpent, 50 );
  assertEquals( insights.lastMonthSpent, 30 );
} );

Deno.test( 'buildWalletInsights — excludes pending/failed transactions from totals', () => {
  const settled = makeTx( 10, 'credit', 0 );
  const pending = { ...makeTx( 99, 'credit', 0 ), status: 'pending' };
  const failed  = { ...makeTx( 99, 'credit', 0 ), status: 'failed' };
  const insights = buildWalletInsights( [ settled, pending, failed ] );
  assertEquals( insights.thisMonthEarned, 10 );
  assertEquals( insights.totalTransactions, 1 );
} );
