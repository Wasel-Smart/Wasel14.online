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

  it('detects client roles and protects server-owned booking fields', () => {
    expect(sql).toContain('guard_booking_pricing');
    expect(sql).toContain('a_bookings_pricing_guard');
    expect(sql).toContain("current_user IN ('anon', 'authenticated')");
    expect(sql).toContain("current_user LIKE 'anon%'");
    expect(sql).toContain("current_user LIKE 'authenticated%'");
    for (const column of ['price_per_seat', 'total_price', 'payment_status', 'stripe_payment_intent_id']) {
      expect(sql).toContain(`NEW.${column} IS DISTINCT FROM OLD.${column}`);
    }
  });

  it('derives the booking price from the trip, never the client', () => {
    expect(sql).toContain('SELECT t.price_per_seat');
    expect(sql).toContain('NEW.price_per_seat := trip_unit_price');
    expect(sql).toContain('NEW.total_price := trip_unit_price * NEW.seats_requested');
    expect(sql).toContain("NEW.payment_status := 'pending'");
    expect(sql).toContain('NEW.stripe_payment_intent_id := NULL');
    expect(sql).toContain("RAISE EXCEPTION 'Trip has no valid server-owned price'");
  });

  it('keeps the guard trigger function out of reach of client roles', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated');
  });

  it('removes client access to shared KV instead of trusting caller-controlled key prefixes', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "System can access shared KV data"');
    expect(sql).toContain('REVOKE ALL ON TABLE public.shared_kv FROM PUBLIC, anon, authenticated');
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*ON public\.shared_kv/);
  });

  it('filters per-user views to the caller and revokes anonymous access', () => {
    expect(sql).toContain('WHERE b.passenger_id = auth.uid()');
    expect(sql).toContain('WHERE p.id = auth.uid()');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon');
    expect(sql).toContain('REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon');
  });

  it('ships a rollback', () => {
    const rollback = fs.readFileSync(rollbackPath, 'utf8');
    expect(rollback).toContain('DROP TRIGGER IF EXISTS a_bookings_pricing_guard');
    expect(rollback).toContain('DROP FUNCTION IF EXISTS public.guard_booking_pricing()');
  });
});
