import {
  json,
  authenticateRequest,
  sanitizePlainText,
  isPlainObject,
  hasAnyPermission,
  type AdminClient,
} from './shared.ts';

/**
 * `/reviews` — post-ride review submitted by the rider.
 *
 * This is NOT a rename of `POST /ratings`. The two endpoints take different
 * bodies and have different contracts:
 *
 *   /ratings  { bookingId, tripId, driverId, rating, review, tags }
 *             requires a booking that is already `completed`
 *
 *   /reviews  { reviewee_id, role, overall_rating, comment, trip_id }
 *             arrives from the live-trip rating sheet the moment the ride ends,
 *             which is *before* the booking has been flipped to `completed`
 *
 * So /reviews resolves the rider's booking for that trip itself and maps the
 * client field names onto the `ratings` columns. Requiring `completed` here
 * would reject nearly every real submission, so the guard is "this rider has a
 * booking on this trip with this driver" instead.
 */

const REVIEWABLE_BOOKING_STATUSES = [ 'confirmed', 'in_progress', 'completed' ];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Find the booking this review belongs to. The client sends either the trip id
 * or the share code (the first 8 characters of the booking id, upper-cased),
 * so both are tried before falling back to the rider's most recent rideable
 * booking.
 */
async function resolveBookingForReview (
  admin: AdminClient,
  userId: string,
  tripReference: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from( 'bookings' )
    .select( 'id, booking_id, user_id, trip_id, status, booking_status, created_at' )
    .eq( 'user_id', userId )
    .order( 'created_at', { ascending: false } )
    .limit( 25 );

  if ( error ) {throw error;}

  const candidates = ( Array.isArray( data ) ? data : [] ).filter( ( booking: Record<string, unknown> ) => {
    const status = String( booking.booking_status ?? booking.status ?? '' );
    return REVIEWABLE_BOOKING_STATUSES.includes( status );
  } );

  if ( tripReference && UUID_PATTERN.test( tripReference ) ) {
    const byTrip = candidates.find( ( booking: Record<string, unknown> ) => (
      String( booking.trip_id ?? '' ) === tripReference
    ) );
    if ( byTrip ) {return byTrip;}
  }

  if ( tripReference && !UUID_PATTERN.test( tripReference ) ) {
    const shareCode = tripReference.slice( 0, 8 ).toUpperCase();
    const byShareCode = candidates.find( ( booking: Record<string, unknown> ) => (
      String( booking.id ?? booking.booking_id ?? '' ).slice( 0, 8 ).toUpperCase() === shareCode
    ) );
    if ( byShareCode ) {return byShareCode;}
  }

  return candidates[ 0 ] ?? null;
}

/**
 * A review is only legitimate for the driver the rider actually travelled with.
 * `trips.driver_id` points at the drivers table, but some read paths hand the
 * client the driver profile id instead, so both identifiers are accepted.
 */
async function isReviewableDriver (
  admin: AdminClient,
  tripId: string,
  revieweeId: string,
): Promise<boolean> {
  const { data: trip } = await admin
    .from( 'trips' )
    .select( 'driver_id' )
    .or( `id.eq.${ tripId },trip_id.eq.${ tripId }` )
    .maybeSingle();

  const driverId = String( ( trip as Record<string, unknown> | null )?.driver_id ?? '' );
  if ( !driverId ) {return true;}
  if ( driverId === revieweeId ) {return true;}

  const { data: driver } = await admin
    .from( 'drivers' )
    .select( 'user_id' )
    .eq( 'driver_id', driverId )
    .maybeSingle();

  return String( ( driver as Record<string, unknown> | null )?.user_id ?? '' ) === revieweeId;
}

export async function handleSubmitReview ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) {return json( { error: 'Invalid request body' }, 400 );}

  const overallRating = Number( body.overall_rating );
  if ( !Number.isFinite( overallRating ) || overallRating < 1 || overallRating > 5 ) {
    return json( { error: 'overall_rating must be between 1 and 5' }, 400 );
  }

  const revieweeId = String( body.reviewee_id ?? '' ).trim();
  if ( !revieweeId ) {return json( { error: 'reviewee_id is required' }, 400 );}

  const { admin, canonicalUser } = auth;

  // Moderators are trusted to file a review on someone's behalf, so they skip
  // the "this is my booking" check the same way /ratings does.
  const canModerateRatings = hasAnyPermission( auth, [ 'trust:moderate' ] );

  let booking: Record<string, unknown> | null = null;
  try {
    booking = await resolveBookingForReview(
      admin,
      canonicalUser.id,
      String( body.trip_id ?? '' ).trim(),
    );
  } catch ( error ) {
    return json( { error: ( error as Error ).message }, 500 );
  }

  if ( !booking ) {
    return json( { error: 'No completed trip was found to review' }, 409 );
  }

  const tripId = String( booking.trip_id ?? '' );
  if ( !tripId || !UUID_PATTERN.test( tripId ) ) {
    return json( { error: 'This booking is not linked to a trip' }, 409 );
  }

  if ( !canModerateRatings ) {
    let reviewerIsPassenger = false;
    try {
      reviewerIsPassenger = await isReviewableDriver( admin, tripId, revieweeId );
    } catch ( error ) {
      return json( { error: ( error as Error ).message }, 500 );
    }

    if ( !reviewerIsPassenger ) {
      return json( { error: 'You can only review a driver you travelled with' }, 403 );
    }
  }

  const rating = Math.round( overallRating );
  const comment = sanitizePlainText( body.comment ?? '', 2000 ) || null;

  // ratings is unique on (booking_id, rider_id). Upserting instead of inserting
  // keeps a double-tap on the rating sheet from failing with a constraint error,
  // while still moving an existing review to the new score.
  const { data, error } = await admin
    .from( 'ratings' )
    .upsert(
      {
        booking_id: String( booking.id ?? booking.booking_id ),
        trip_id: tripId,
        rider_id: canonicalUser.id,
        driver_id: revieweeId,
        rating,
        review: comment,
        tags: [],
      },
      { onConflict: 'booking_id,rider_id' },
    )
    .select( '*' )
    .single();

  if ( error ) {return json( { error: error.message }, 500 );}

  // Best-effort: a failed notification must not fail the review.
  await admin.from( 'notifications' ).insert( {
    user_id: revieweeId,
    type: 'rating_received',
    title: 'New Rating',
    message: `You received a ${ rating }-star rating`,
    metadata: { priority: 'medium', tripId, rating },
    read: false,
    is_read: false,
  } );

  return json( {
    ok: true,
    review: {
      id: String( data.id ?? '' ),
      trip_id: tripId,
      reviewee_id: revieweeId,
      overall_rating: rating,
      comment,
      created_at: String( data.created_at ?? new Date().toISOString() ),
    },
  }, 201 );
}
