import { describe, it, expect } from 'vitest';
import {
  RIDE_LIFECYCLE_TRANSITIONS,
  mapBookingStatusToRideLifecycleState,
  mapRideLifecycleStateToBookingStatus,
  projectRideLifecycleState,
  type RideLifecycleState,
  type LegacyRideBookingStatus,
} from '@/domain/rides/lifecycle';

describe('RIDE_LIFECYCLE_TRANSITIONS', () => {
  it('terminal states have no outgoing transitions', () => {
    expect(RIDE_LIFECYCLE_TRANSITIONS.completed).toEqual([]);
    expect(RIDE_LIFECYCLE_TRANSITIONS.cancelled).toEqual([]);
  });

  it('requested can transition to matched or cancelled', () => {
    expect(RIDE_LIFECYCLE_TRANSITIONS.requested).toContain('matched');
    expect(RIDE_LIFECYCLE_TRANSITIONS.requested).toContain('cancelled');
  });
});

describe('mapBookingStatusToRideLifecycleState', () => {
  const cases: Array<[LegacyRideBookingStatus, RideLifecycleState]> = [
    ['pending_driver', 'requested'],
    ['confirmed', 'accepted'],
    ['completed', 'completed'],
    ['cancelled', 'cancelled'],
    ['rejected', 'cancelled'],
    ['unknown', 'requested'],
  ];

  it.each(cases)('%s → %s', (input, expected) => {
    expect(mapBookingStatusToRideLifecycleState(input)).toBe(expected);
  });
});

describe('mapRideLifecycleStateToBookingStatus', () => {
  const cases: Array<[RideLifecycleState, LegacyRideBookingStatus]> = [
    ['requested', 'pending_driver'],
    ['matched', 'pending_driver'],
    ['accepted', 'confirmed'],
    ['in_progress', 'confirmed'],
    ['completed', 'completed'],
    ['cancelled', 'cancelled'],
  ];

  it.each(cases)('%s → %s', (input, expected) => {
    expect(mapRideLifecycleStateToBookingStatus(input)).toBe(expected);
  });
});

describe('projectRideLifecycleState', () => {
  it('returns current state when target equals current', () => {
    expect(projectRideLifecycleState('requested', 'requested')).toBe('requested');
  });

  it('allows forward progression', () => {
    expect(projectRideLifecycleState('requested', 'matched')).toBe('matched');
    expect(projectRideLifecycleState('matched', 'accepted')).toBe('accepted');
    expect(projectRideLifecycleState('accepted', 'in_progress')).toBe('in_progress');
    expect(projectRideLifecycleState('in_progress', 'completed')).toBe('completed');
  });

  it('allows cancellation from any non-terminal state', () => {
    const nonTerminal: RideLifecycleState[] = ['requested', 'matched', 'accepted', 'in_progress'];
    for (const state of nonTerminal) {
      expect(projectRideLifecycleState(state, 'cancelled')).toBe('cancelled');
    }
  });

  it('throws when trying to transition from a terminal state', () => {
    expect(() => projectRideLifecycleState('completed', 'requested')).toThrow();
    expect(() => projectRideLifecycleState('cancelled', 'matched')).toThrow();
  });

  it('throws on invalid backward projection', () => {
    expect(() => projectRideLifecycleState('in_progress', 'requested')).toThrow();
  });
});
