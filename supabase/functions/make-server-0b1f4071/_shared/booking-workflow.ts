const TERMINAL_BOOKING_STATUSES = new Set( [ 'completed', 'cancelled', 'rejected', 'refunded' ] );

export function isTerminalBookingStatus ( status: string ): boolean {
  return TERMINAL_BOOKING_STATUSES.has( status.trim().toLowerCase() );
}

/**
 * Validates canonical booking status transitions. Passenger callers may only
 * cancel; the caller must separately prove passenger ownership. Drivers and
 * staff may advance an active booking through the supported ride lifecycle.
 */
export function canTransitionBookingStatus (
  currentStatus: string,
  nextStatus: string,
  canManageRide: boolean,
): boolean {
  const current = currentStatus.trim().toLowerCase();
  const next = nextStatus.trim().toLowerCase();

  if ( isTerminalBookingStatus( current ) || !next ) { return false; }
  if ( next === 'cancelled' ) { return true; }
  if ( !canManageRide ) { return false; }

  if ( current === 'pending_driver' || current === 'pending_payment' ) {
    return next === 'confirmed';
  }
  if ( current === 'confirmed' ) {
    return next === 'checked_in' || next === 'completed';
  }
  if ( current === 'checked_in' ) {
    return next === 'completed';
  }
  return false;
}
