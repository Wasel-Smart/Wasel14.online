import {
    json,
    ensureRuntimeAdminAccess,
    authenticateRequest,
    assertTripParticipant,
    executeSqlStatements,
    CONTENT_MODERATION_SQL,
} from './shared.ts';


export async function handleApplyModerationMigrations ( request: Request ) {
  const accessError = ensureRuntimeAdminAccess( request );
  if ( accessError ) {return accessError;}

  await executeSqlStatements( CONTENT_MODERATION_SQL );

  return json( {
    applied: [
      '20260503010000_content_moderation_runtime.sql',
    ],
  } );
}

export async function handleSubmitReport ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => null );
  if ( !body || typeof body !== 'object' ) {return json( { error: 'Invalid request body' }, 400 );}
  const bookingId = String( body.bookingId ?? '' ).trim();
  const issueType = String( body.issueType ?? '' ).trim().slice( 0, 100 );
  const description = typeof body.description === 'string' ? body.description.trim().slice( 0, 2000 ) : '';

  if ( !issueType ) {return json( { error: 'issueType is required' }, 400 );}

  const { admin, canonicalUser } = auth;

  // A report may only reference a booking the reporter actually took part in.
  // Before this check any signed-in user could attach a report to an arbitrary
  // booking id; a non-UUID id is simply not linked, as before.
  let bookingIdResolved: string | null = null;
  if ( /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test( bookingId ) ) {
    const { data: booking, error: bookingError } = await admin
      .from( 'bookings' )
      .select( '*' )
      .eq( 'id', bookingId )
      .maybeSingle();
    if ( bookingError ) {
      console.error( '[reports] booking lookup failed', bookingError.message );
      return json( { error: 'Unable to submit the report. Please try again.' }, 500 );
    }
    if ( booking ) {
      // bookings carries the passenger as `passenger_id` on newer schemas and
      // `user_id` on older ones, so accept either; the trip's driver may also report.
      let isParticipant =
        booking.passenger_id === canonicalUser.id || booking.user_id === canonicalUser.id;
      if ( !isParticipant && booking.trip_id ) {
        isParticipant = await assertTripParticipant( admin, String( booking.trip_id ), canonicalUser.id )
          .catch( ( error: unknown ) => {
            console.error( '[reports] participant check failed', error instanceof Error ? error.message : String( error ) );
            return false;
          } );
      }
      if ( !isParticipant ) {
        return json( { error: 'You can only report a booking you took part in.' }, 403 );
      }
    }
    bookingIdResolved = booking?.id ?? null;
  }

  const { error: insertError } = await admin.from( 'reports' ).insert( {
    reporter_id: canonicalUser.id,
    booking_id: bookingIdResolved,
    issue_type: issueType,
    description: description || null,
    status: 'open',
  } );

  if ( insertError ) {
    console.error( '[reports] insert failed', insertError.message );
    return json( { error: 'Unable to submit the report. Please try again.' }, 500 );
  }

  return json( { ok: true }, 201 );
}
