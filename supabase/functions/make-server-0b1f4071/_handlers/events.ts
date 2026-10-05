import {
  json,
  constantTimeEqual,
  getAdminClient,
  isPlainObject,
  sanitizePlainText,
  SUPABASE_SERVICE_ROLE_KEY,
} from './shared.ts';

/**
 * `POST /events` — the service-role event sink for `outbox-worker`.
 *
 * `outbox-worker` drains `event_outbox` and forwards each row to
 * `<function>/events`. That path did not exist on this function, so every
 * drained event was answered with 404, retried five times and finally parked in
 * `dead_letter_messages` even though the handler logic existed only in the
 * in-browser worker pool. This module is the server-side half of that migration.
 *
 * Authentication is a constant-time comparison of the bearer token against
 * `SUPABASE_SERVICE_ROLE_KEY`. A user JWT is deliberately not accepted: these
 * events have no user session, they are system-generated, and every write below
 * runs on the service-role client with RLS bypassed.
 */

const SUPPORTED_TOPICS = new Set( [
  'rides.assigned',
  'rides.completed',
  'packages.delivered',
  'notifications.dispatch',
  'payments.authorized',
  'payments.captured',
] );

const MAX_TOPIC_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 1000;
const NOTIFICATION_PRIORITIES = [ 'low', 'medium', 'high', 'urgent' ] as const;

function isServiceRoleRequest ( request: Request ): boolean {
  if ( !SUPABASE_SERVICE_ROLE_KEY ) {return false;}
  const authorization = request.headers.get( 'authorization' ) ?? '';
  if ( !authorization.startsWith( 'Bearer ' ) ) {return false;}
  return constantTimeEqual( authorization.slice( 7 ), SUPABASE_SERVICE_ROLE_KEY );
}

function readString ( source: Record<string, unknown>, key: string ): string {
  const value = source[ key ];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The outbox row is authoritative for `user_id`; the payload only carries the
 * caller's intent. Reading the id from the row means a forged or replayed
 * payload cannot redirect a notification to another account.
 */
async function notifyUser (
  admin: ReturnType<typeof getAdminClient>,
  userId: string,
  input: { title: string; message: string; type: string; priority: string; actionUrl: string }
): Promise<void> {
  const priority = NOTIFICATION_PRIORITIES.includes( input.priority as never ) ? input.priority : 'medium';
  const { error } = await admin
    .from( 'notifications' )
    .insert( {
      user_id: userId,
      type: sanitizePlainText( input.type || 'general', 64 ),
      title: input.title,
      message: input.message,
      metadata: {
        priority,
        action_url: input.actionUrl,
        channels: [],
      },
      action_url: input.actionUrl || null,
      read: false,
      is_read: false,
    } );

  if ( error ) {
    console.error( '[events] notification insert failed', error.message );
  }
}

async function handleNotificationsDispatch (
  admin: ReturnType<typeof getAdminClient>,
  eventId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const userId = readString( payload, 'userId' ) || readString( payload, 'user_id' );
  if ( !userId ) {
    return { handled: false, reason: 'missing_user_id' };
  }

  const title = sanitizePlainText( readString( payload, 'title' ), MAX_TITLE_LENGTH );
  const message = sanitizePlainText( readString( payload, 'message' ) || readString( payload, 'body' ), MAX_MESSAGE_LENGTH );
  if ( !title || !message ) {
    return { handled: false, reason: 'missing_title_or_message' };
  }

  await notifyUser( admin, userId, {
    title,
    message,
    type: readString( payload, 'type' ) || 'general',
    priority: readString( payload, 'priority' ) || 'medium',
    actionUrl: sanitizePlainText( readString( payload, 'actionUrl' ) || readString( payload, 'action_url' ), 512 ),
  } );

  return { handled: true, eventId, recipients: 1 };
}

async function handleRidesAssigned (
  admin: ReturnType<typeof getAdminClient>,
  eventId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const bookingId = readString( payload, 'bookingId' ) || readString( payload, 'booking_id' );
  if ( !bookingId ) {
    return { handled: false, reason: 'missing_booking_id' };
  }

  // The passenger is read from the booking row rather than the payload so a
  // caller cannot pick whose notification feed receives the message.
  const { data: booking, error } = await admin
    .from( 'bookings' )
    .select( 'passenger_id' )
    .eq( 'booking_id', bookingId )
    .maybeSingle();

  if ( error ) {throw new Error( `booking lookup failed: ${ error.message }` );}
  if ( !booking?.passenger_id ) {
    return { handled: false, reason: 'booking_not_found' };
  }

  await notifyUser( admin, String( booking.passenger_id ), {
    title: 'Driver assigned',
    message: 'A driver has been assigned to your ride.',
    type: 'booking',
    priority: 'high',
    actionUrl: '/app/my-trips?tab=rides',
  } );

  return { handled: true, eventId, recipients: 1 };
}

async function handlePackagesDelivered (
  admin: ReturnType<typeof getAdminClient>,
  eventId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const packageId = readString( payload, 'packageId' ) || readString( payload, 'package_id' );
  if ( !packageId ) {
    return { handled: false, reason: 'missing_package_id' };
  }

  const { data: pkg, error } = await admin
    .from( 'packages' )
    .select( 'sender_id, receiver_id, package_id' )
    .eq( 'package_id', packageId )
    .maybeSingle();

  if ( error ) {throw new Error( `package lookup failed: ${ error.message }` );}
  if ( !pkg ) {
    return { handled: false, reason: 'package_not_found' };
  }

  const recipients = [ pkg.sender_id, pkg.receiver_id ]
    .filter( ( id ): id is string => typeof id === 'string' && id.length > 0 );

  await Promise.all(
    recipients.map( ( userId ) =>
      notifyUser( admin, userId, {
        title: 'Package delivered',
        message: 'Your package has been delivered successfully.',
        type: 'booking',
        priority: 'high',
        actionUrl: '',
      } )
    ),
  );

  return { handled: true, eventId, recipients: recipients.length };
}

/**
 * `payments.captured` is the only producer of the `revenue_captured` ops
 * aggregate. In the browser it was written through `increment_ops_aggregate`,
 * which is service-role only (20260826000000_atomic_ops_aggregate_increment.sql),
 * so the browser call always failed and the revenue metric never moved.
 */
async function handlePaymentsCaptured (
  admin: ReturnType<typeof getAdminClient>,
  eventId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const rawAmount = Number( payload.amount ?? 0 );
  const amount = Number.isFinite( rawAmount ) ? rawAmount : 0;

  const { error } = await admin.rpc( 'increment_ops_aggregate' as never, {
    p_metric_date: readString( payload, 'occurredAt' ).slice( 0, 10 ) || new Date().toISOString().slice( 0, 10 ),
    p_metric_name: 'revenue_captured',
    p_dimension: readString( payload, 'entityType' ) || 'unknown',
    p_amount: amount,
  } as never );

  if ( error ) {throw new Error( `ops aggregate increment failed: ${ error.message }` );}

  return { handled: true, eventId, amount };
}

/**
 * `rides.completed` feeds the growth funnel. Recorded through `growth_events`
 * rather than the browser's local-storage fallback, which never left the device.
 */
async function handleRidesCompleted (
  admin: ReturnType<typeof getAdminClient>,
  eventId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { error } = await admin.from( 'growth_events' ).insert( {
    event_name: 'ride_completed',
    funnel_stage: 'completed',
    service_type: 'ride',
    user_id: readString( payload, 'passengerId' ) || readString( payload, 'userId' ) || null,
    value_jod: Number( payload.amount ?? payload.valueJod ?? 0 ) || 0,
    metadata: isPlainObject( payload ) ? payload : {},
  } as never );

  if ( error ) {throw new Error( `growth event insert failed: ${ error.message }` );}

  return { handled: true, eventId };
}

export async function handleEventRequest ( request: Request ) {
  if ( !SUPABASE_SERVICE_ROLE_KEY ) {
    return json( { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set' }, 500 );
  }

  if ( !isServiceRoleRequest( request ) ) {
    return json( { error: 'Unauthorized' }, 401 );
  }

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) {
    return json( { error: 'Invalid request body' }, 400 );
  }

  const eventId = readString( body, 'id' );
  const topic = readString( body, 'topic' );

  if ( !eventId || eventId.length > 128 ) {
    return json( { error: 'Missing required field: id' }, 400 );
  }
  if ( !topic || topic.length > MAX_TOPIC_LENGTH ) {
    return json( { error: 'Missing required field: topic' }, 400 );
  }

  const rawPayload = body.payload;
  if ( !isPlainObject( rawPayload ) ) {
    return json( { error: 'Missing required field: payload' }, 400 );
  }
  const payload = rawPayload;

  if ( !SUPPORTED_TOPICS.has( topic ) ) {
    return json( { error: `Unsupported topic: ${ topic }` }, 400 );
  }

  const admin = getAdminClient();

  let result: Record<string, unknown>;
  try {
    switch ( topic ) {
      case 'notifications.dispatch':
        result = await handleNotificationsDispatch( admin, eventId, payload );
        break;
      case 'rides.assigned':
        result = await handleRidesAssigned( admin, eventId, payload );
        break;
      case 'packages.delivered':
        result = await handlePackagesDelivered( admin, eventId, payload );
        break;
      case 'payments.captured':
        result = await handlePaymentsCaptured( admin, eventId, payload );
        break;
      case 'rides.completed':
        result = await handleRidesCompleted( admin, eventId, payload );
        break;
      case 'payments.authorized':
      default:
        // Accepted and acknowledged so the queue drains; no durable side effect
        // is defined for this topic in the server runtime yet.
        result = { handled: false, reason: 'no_server_handler', eventId };
        break;
    }
  } catch ( error ) {
    const message = error instanceof Error ? error.message : String( error );
    console.error( '[events] handler failed', JSON.stringify( { eventId, topic, message } ) );
    // 500 makes outbox-worker increment attempts and retry, which is the
    // correct behaviour for a transient database failure.
    return json( { error: 'Event handler failed' }, 500 );
  }

  // A row that cannot be actioned is still acknowledged. Retrying it forever
  // cannot create the missing booking or package, and a permanently failing
  // event blocks the queue behind it.
  return json( { ok: true, topic, ...result } );
}