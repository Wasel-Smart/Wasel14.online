import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveRouteIntelligence } from '../../src/services/routeDemandIntelligence';
import { areRouteRemindersEqual, type RouteReminder } from '../../src/services/movementRetention';

/**
 * Regression coverage for the unbounded render/effect loop on the ride-finding
 * and Wasel+ pages.
 *
 * Both pages refresh derived state from an effect keyed on `updatedAt`. The hook
 * used to rebuild its snapshot on every render (callers pass an inline `args`
 * literal) and stamped a new `updatedAt` each time, so the effect re-ran, set
 * state from a freshly built array, and sent the component round again until
 * React aborted it for exceeding the update depth. These tests exercise the real
 * hook rather than a mock, because mocking it is what kept the suite green while
 * the bug was live.
 */
describe( 'useLiveRouteIntelligence snapshot stability', () => {
  beforeEach( () => {
    window.localStorage.clear();
    vi.useFakeTimers();
  } );

  it( 'keeps the same snapshot identity across re-renders when data is unchanged', () => {
    const { result, rerender } = renderHook(
      // Intentionally an inline literal: this is exactly what every caller does,
      // and the identity churn is what used to defeat the internal memo.
      ( { from, to }: { from: string; to: string } ) => useLiveRouteIntelligence( { from, to } ),
      { initialProps: { from: 'Amman', to: 'Aqaba' } },
    );

    const first = result.current;
    expect( first.updatedAt ).toBeTruthy();

    rerender( { from: 'Amman', to: 'Aqaba' } );
    rerender( { from: 'Amman', to: 'Aqaba' } );
    rerender( { from: 'Amman', to: 'Aqaba' } );

    // Same object, so an effect keyed on updatedAt does not re-fire.
    expect( result.current ).toBe( first );
    expect( result.current.updatedAt ).toBe( first.updatedAt );
  } );

  it( 'does not restart the refresh interval on every render', () => {
    const setIntervalSpy = vi.spyOn( window, 'setInterval' );
    const { rerender } = renderHook(
      ( { from, to }: { from: string; to: string } ) => useLiveRouteIntelligence( { from, to } ),
      { initialProps: { from: 'Amman', to: 'Aqaba' } },
    );

    const callsAfterMount = setIntervalSpy.mock.calls.length;
    rerender( { from: 'Amman', to: 'Aqaba' } );
    rerender( { from: 'Amman', to: 'Aqaba' } );

    expect( setIntervalSpy ).toHaveBeenCalledTimes( callsAfterMount );
    setIntervalSpy.mockRestore();
  } );

  it( 'holds the snapshot across a refresh tick when the data is unchanged', () => {
    const { result } = renderHook(
      ( { from, to }: { from: string; to: string } ) => useLiveRouteIntelligence( { from, to } ),
      { initialProps: { from: 'Amman', to: 'Aqaba' } },
    );

    const first = result.current;

    // The hook self-refreshes every 30s. If that recompute re-stamps updatedAt
    // for an unchanged payload, consumer effects re-fire on a timer, and the
    // page re-enters the same unbounded cycle it hit on first render.
    act( () => { vi.advanceTimersByTime( 30_000 ); } );

    expect( result.current ).toBe( first );
    expect( result.current.updatedAt ).toBe( first.updatedAt );
  } );

  it( 'publishes a new timestamp once the corridor actually changes', () => {
    const { result, rerender } = renderHook(
      ( { from, to }: { from: string; to: string } ) => useLiveRouteIntelligence( { from, to } ),
      { initialProps: { from: 'Amman', to: 'Aqaba' } },
    );

    const first = result.current;
    act( () => { vi.advanceTimersByTime( 5 ); } );
    rerender( { from: 'Irbid', to: 'Aqaba' } );

    // Different corridor: consumers must be able to tell, and the effect refires
    // a bounded number of times rather than spinning.
    expect( result.current ).not.toBe( first );
  } );
} );

describe( 'areRouteRemindersEqual', () => {
  const base: RouteReminder = {
    id: 'reminder-1',
    corridorId: 'amman-aqaba',
    label: 'Amman to Aqaba',
    from: 'Amman',
    to: 'Aqaba',
    frequency: 'weekly',
    preferredTime: '07:30',
    nextReminderAt: '2026-01-01T08:00:00.000Z',
    enabled: true,
    createdAt: '2025-12-01T00:00:00.000Z',
  };

  it( 'treats an independently rebuilt but identical list as unchanged', () => {
    expect( areRouteRemindersEqual( [ base ], [ { ...base } ] ) ).toBe( true );
  } );

  it( 'detects a changed reminder time', () => {
    expect(
      areRouteRemindersEqual( [ base ], [ { ...base, nextReminderAt: '2026-02-02T08:00:00.000Z' } ] ),
    ).toBe( false );
  } );

  it( 'detects a changed preferred time or frequency', () => {
    expect( areRouteRemindersEqual( [ base ], [ { ...base, preferredTime: '09:15' } ] ) ).toBe( false );
    expect( areRouteRemindersEqual( [ base ], [ { ...base, frequency: 'daily' } ] ) ).toBe( false );
  } );

  it( 'detects a disabled reminder', () => {
    expect( areRouteRemindersEqual( [ base ], [ { ...base, enabled: false } ] ) ).toBe( false );
  } );

  it( 'detects added and removed reminders', () => {
    expect( areRouteRemindersEqual( [], [ base ] ) ).toBe( false );
    expect( areRouteRemindersEqual( [ base ], [] ) ).toBe( false );
  } );
} );
