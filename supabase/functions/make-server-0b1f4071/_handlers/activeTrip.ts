import {
  json,
  authenticateRequest,
  sanitizePlainText,
  isPlainObject,
} from './shared.ts';

/**
 * `/active-trip` — the ride currently in progress for the signed-in user.
 *
 * GET     read the current record (`{ activeTrip: null }` when there is none)
 * POST    upsert the record after a ride is confirmed
 * PATCH   partial update of status / eta without replacing the whole blob
 * DELETE  clear it once the ride completes or is cancelled
 *
 * A user only ever has one ride in flight, so the row is keyed by user_id and
 * POST overwrites. The client stores driver/vehicle/from/to as one opaque blob
 * (`payload`); status and share_code are promoted into columns so PATCH stays a
 * partial update and the state is queryable.
 */

const ACTIVE_TRIP_STATUSES = [
  'en_route_to_pickup',
  'driver_arrived',
  'en_route',
  'arriving',
  'completed',
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toOptionalUuid ( value: unknown ): string | null {
  const candidate = String( value ?? '' ).trim();
  return UUID_PATTERN.test( candidate ) ? candidate : null;
}

function toNullableNumber ( value: unknown ): number | null {
  const parsed = Number( value );
  return Number.isFinite( parsed ) ? parsed : null;
}

/**
 * Rebuild the client-facing ActiveTrip from the stored row. Columns win over the
 * payload for anything the server owns (status, timestamps, identity) so a stale
 * blob cannot resurrect a superseded value.
 */
function mapActiveTripRow ( row: Record<string, unknown> ): Record<string, unknown> {
  const payload = isPlainObject( row.payload ) ? row.payload : {};

  return {
    ...payload,
    id: String( payload.id ?? row.trip_id ?? '' ),
    from: sanitizePlainText( payload.from ?? '', 120 ),
    to: sanitizePlainText( payload.to ?? '', 120 ),
    status: String( row.status ?? payload.status ?? 'en_route_to_pickup' ),
    eta: String( row.eta ?? payload.eta ?? '' ),
    shareCode: String( row.share_code ?? payload.shareCode ?? '' ),
    price: Number( row.price ?? payload.price ?? 0 ),
    passengers: Number( row.passengers ?? payload.passengers ?? 1 ),
    tier: String( row.tier ?? payload.tier ?? 'economy' ),
    duration: String( payload.duration ?? '' ),
    driver: isPlainObject( payload.driver ) ? payload.driver : {},
    vehicle: isPlainObject( payload.vehicle ) ? payload.vehicle : {},
    startedAt: String( row.started_at ?? payload.startedAt ?? row.created_at ?? '' ),
    updatedAt: String( row.updated_at ?? payload.updatedAt ?? '' ),
    userId: String( row.user_id ?? '' ),
  };
}

export async function handleGetActiveTrip ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const { data, error } = await auth.admin
    .from( 'active_trips' )
    .select( '*' )
    .eq( 'user_id', auth.canonicalUser.id )
    .maybeSingle();

  if ( error ) {return json( { error: error.message }, 500 );}

  return json( { activeTrip: data ? mapActiveTripRow( data ) : null } );
}

export async function handleSetActiveTrip ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) {return json( { error: 'Invalid request body' }, 400 );}

  const status = String( body.status ?? 'en_route_to_pickup' );
  if ( !( ACTIVE_TRIP_STATUSES as readonly string[] ).includes( status ) ) {
    return json( { error: 'Unsupported active trip status' }, 400 );
  }

  // Free-text fields are client supplied, so they are cleaned before storage.
  // driver/vehicle are nested blobs that are re-read verbatim by the client, so
  // only their display strings are sanitized.
  const payload = {
    ...body,
    id: sanitizePlainText( body.id ?? '', 64 ),
    from: sanitizePlainText( body.from ?? '', 120 ),
    to: sanitizePlainText( body.to ?? '', 120 ),
    fromAr: body.fromAr ? sanitizePlainText( body.fromAr, 120 ) : undefined,
    toAr: body.toAr ? sanitizePlainText( body.toAr, 120 ) : undefined,
    shareCode: sanitizePlainText( body.shareCode ?? '', 32 ),
    duration: sanitizePlainText( body.duration ?? '', 32 ),
    driver: isPlainObject( body.driver )
      ? {
        ...body.driver,
        name: sanitizePlainText( body.driver.name ?? '', 120 ),
        nameAr: body.driver.nameAr ? sanitizePlainText( body.driver.nameAr, 120 ) : '',
        phone: sanitizePlainText( body.driver.phone ?? '', 32 ),
        initials: sanitizePlainText( body.driver.initials ?? '', 4 ),
        img: sanitizePlainText( body.driver.img ?? '', 512 ),
      }
      : {},
    vehicle: isPlainObject( body.vehicle )
      ? {
        ...body.vehicle,
        model: sanitizePlainText( body.vehicle.model ?? '', 120 ),
        color: sanitizePlainText( body.vehicle.color ?? '', 60 ),
        plate: sanitizePlainText( body.vehicle.plate ?? '', 32 ),
      }
      : {},
  };

  const now = new Date().toISOString();

  const { data, error } = await auth.admin
    .from( 'active_trips' )
    .upsert(
      {
        user_id: auth.canonicalUser.id,
        trip_id: toOptionalUuid( body.id ),
        booking_id: toOptionalUuid( body.bookingId ),
        share_code: payload.shareCode || null,
        status,
        eta: sanitizePlainText( body.eta ?? '', 32 ),
        price: toNullableNumber( body.price ),
        passengers: Number( body.passengers ?? 1 ),
        tier: String( body.tier ?? 'economy' ),
        payload,
        started_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select( '*' )
    .single();

  if ( error ) {return json( { error: error.message }, 500 );}

  return json( { activeTrip: mapActiveTripRow( data ) }, 200 );
}

export async function handlePatchActiveTrip ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) {return json( { error: 'Invalid request body' }, 400 );}

  const { data: current, error: readError } = await auth.admin
    .from( 'active_trips' )
    .select( '*' )
    .eq( 'user_id', auth.canonicalUser.id )
    .maybeSingle();

  if ( readError ) {return json( { error: readError.message }, 500 );}
  if ( !current ) {return json( { activeTrip: null } );}

  const patch: Record<string, unknown> = {};
  const payloadPatch: Record<string, unknown> = {};

  if ( body.status !== undefined ) {
    const status = String( body.status );
    if ( !( ACTIVE_TRIP_STATUSES as readonly string[] ).includes( status ) ) {
      return json( { error: 'Unsupported active trip status' }, 400 );
    }
    patch.status = status;
    payloadPatch.status = status;
  }

  if ( body.eta !== undefined ) {
    const eta = sanitizePlainText( body.eta ?? '', 32 );
    patch.eta = eta;
    payloadPatch.eta = eta;
  }

  if ( body.updatedAt !== undefined ) {
    patch.updated_at = sanitizePlainText( body.updatedAt ?? '', 64 );
  }

  const existingPayload = isPlainObject( current.payload ) ? current.payload : {};

  const { data, error } = await auth.admin
    .from( 'active_trips' )
    .update( {
      ...patch,
      payload: { ...existingPayload, ...payloadPatch },
      updated_at: new Date().toISOString(),
    } )
    .eq( 'user_id', auth.canonicalUser.id )
    .select( '*' )
    .single();

  if ( error ) {return json( { error: error.message }, 500 );}

  return json( { activeTrip: mapActiveTripRow( data ) } );
}

export async function handleClearActiveTrip ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const { error } = await auth.admin
    .from( 'active_trips' )
    .delete()
    .eq( 'user_id', auth.canonicalUser.id );

  if ( error ) {return json( { error: error.message }, 500 );}

  return json( { ok: true, activeTrip: null } );
}
