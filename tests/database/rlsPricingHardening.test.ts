/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../supabase/migrations/20261017000000_rls_price_and_view_hardening.sql',
);
const rollbackPath = path.resolve(
  __dirname,
  '../../supabase/migrations/rollback/20261017_rls_price_and_view_hardening_rollback.sql',
);

describe('RLS / pricing / view hardening migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('pins booking price and payment columns for client roles only', () => {
    expect(sql).toContain('guard_booking_pricing');
    expect(sql).toContain('a_bookings_pricing_guard');
    expect(sql).toContain("NOT IN ('authenticated', 'anon')");
    for (const column of ['price_per_seat', 'total_price', 'payment_status', 'stripe_payment_intent_id']) {
      expect(sql).toContain(`'${column}'`);
    }
  });

  it('derives the booking price from the trip, never the client', () => {
    expect(sql).toContain("trip_j ->> 'price_per_seat'");
    expect(sql).toContain('greatest(given, unit * seats)');
  });

  it('keeps the guard trigger function out of reach of client roles', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated');
  });

  it('removes the unrestricted shared KV policy and limits writes to user: keys', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "System can access shared KV data"');
    expect(sql).toMatch(/FOR SELECT TO authenticated[\s\S]*trip:%/);
    expect(sql).toMatch(/FOR ALL TO authenticated[\s\S]*WITH CHECK \(key LIKE 'user:'/);
  });

  it('filters per-user views to the caller and revokes anonymous access', () => {
    expect(sql).toContain('WHERE b.passenger_id = auth.uid()');
    expect(sql).toContain('WHERE p.id = auth.uid()');
    expect(sql).toContain('REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon');
    expect(sql).toContain('REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon');
  });

  it('ships a rollback', () => {
    const rollback = fs.readFileSync(rollbackPath, 'utf8');
    expect(rollback).toContain('DROP TRIGGER IF EXISTS a_bookings_pricing_guard');
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.guard_booking_pricing()');
  });
});
