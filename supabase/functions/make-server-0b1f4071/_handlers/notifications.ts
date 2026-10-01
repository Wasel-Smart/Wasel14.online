import {
  json,
  authenticateRequest,
  sanitizePlainText,
  hasAnyPermission,
  isPlainObject,
} from './shared.ts';

/**
 * `/notifications` — the in-app notification feed the bell menu renders.
 *
 * GET     list the caller's own notifications, newest first
 * PATCH   /notifications/{id}/read  mark one as read
 * POST    /notifications/send-push  create a notification for a recipient
 * POST    /notifications/push-pref  persist the browser push opt-in flag
 *
 * The frontend also has a direct-Supabase fallback for all of these, so these
 * routes are the preferred path rather than the only one — but they are the only
 * ones that can run through the server-side moderation and RBAC layer.
 */

const NOTIFICATION_PRIORITIES = [ 'low', 'medium', 'high', 'urgent' ] as const;

const MAX_NOTIFICATION_LIMIT = 100;

/**
 * The notifications table has accumulated two parallel column pairs across the
 * migration families: `message` + `metadata` (20260327110000 contract) and
 * `body` + `data` (20260224000002 / 20260320000001). The edge's own insert
 * sites still write `body`/`data` (trips.ts, bookings.ts x2) while the client
 * reads `message`/`metadata`, so reading only the first pair renders those
 * notifications with blank text. Both are coalesced here, with the contract
 * pair preferred because it is what new rows are written with.
 */
function mapNotificationRow ( row: Record<string, unknown> ) {
  const metadata = isPlainObject( row.metadata )
    ? row.metadata
    : isPlainObject( row.data )
      ? row.data
      : {};
  const isRead = Boolean( row.is_read ?? row.read );
  const priority = NOTIFICATION_PRIORITIES.includes( metadata.priority as never )
    ? String( metadata.priority )
    : 'medium';
  const message = String( row.message ?? row.body ?? '' );

  return {
    id: String( row.id ?? '' ),
    user_id: String( row.user_id ?? '' ),
    type: String( row.type ?? '' ),
    title: String( row.title ?? '' ),
    message,
    priority,
    action_url: String( row.action_url ?? metadata.action_url ?? '' ),
    is_read: isRead,
    read: isRead,
    read_at: row.read_at ?? null,
    created_at: String( row.created_at ?? '' ),
  };
}

export async function handleGetNotifications ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;

  const requestedLimit = Number( new URL( request.url ).searchParams.get( 'limit' ) );
  const limit = Number.isFinite( requestedLimit ) && requestedLimit > 0
    ? Math.min( Math.trunc( requestedLimit ), MAX_NOTIFICATION_LIMIT )
    : 50;

  const { data, error } = await auth.admin
    .from( 'notifications' )
    .select( '*' )
    .eq( 'user_id', auth.canonicalUser.id )
    .order( 'created_at', { ascending: false } )
    .limit( limit );

  if ( error ) return json( { error: error.message }, 500 );

  const notifications = ( Array.isArray( data ) ? data : [] ).map(
    ( row: Record<string, unknown> ) => mapNotificationRow( row ),
  );

  return json( { notifications } );
}

export async function handleMarkNotificationRead ( request: Request, notificationId: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;

  if ( !notificationId ) return json( { error: 'Notification id is required' }, 400 );

  // The user_id predicate is what prevents one user from reading another's
  // notification — an update without it would mark arbitrary ids as read.
  const { data, error } = await auth.admin
    .from( 'notifications' )
    .update( {
      read: true,
      is_read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } )
    .eq( 'id', notificationId )
    .eq( 'user_id', auth.canonicalUser.id )
    .select( '*' )
    .maybeSingle();

  if ( error ) return json( { error: error.message }, 500 );
  if ( !data ) return json( { error: 'Notification not found' }, 404 );

  return json( { success: true, notification: mapNotificationRow( data ) } );
}

export async function handleSendPushNotification ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) return json( { error: 'Invalid request body' }, 400 );

  const recipientId = String( body.userId ?? auth.canonicalUser.id ).trim();
  if ( !recipientId ) return json( { error: 'A recipient userId is required' }, 400 );

  // Without this guard any authenticated user could post notifications into
  // somebody else's feed, so targeting yourself is allowed but targeting anyone
  // else requires the notifications:send permission.
  const isSelf = recipientId === auth.canonicalUser.id ||
    recipientId === auth.authUser.id;
  const canSendToOthers = hasAnyPermission( auth, [ 'notifications:send' ] );
  if ( !isSelf && !canSendToOthers ) {
    return json( { error: 'Cannot send notifications to another user' }, 403 );
  }

  const title = sanitizePlainText( body.title ?? '', 200 );
  const message = sanitizePlainText( body.message ?? body.body ?? '', 1000 );
  if ( !title || !message ) {
    return json( { error: 'A title and message are required' }, 400 );
  }

  const requestedPriority = String( body.priority ?? 'medium' );
  const priority = NOTIFICATION_PRIORITIES.includes( requestedPriority as never )
    ? requestedPriority
    : 'medium';

  const { data, error } = await auth.admin
    .from( 'notifications' )
    .insert( {
      user_id: recipientId,
      type: sanitizePlainText( body.type ?? 'general', 64 ),
      title,
      message,
      metadata: {
        priority,
        action_url: sanitizePlainText( body.action_url ?? '', 512 ),
        channels: Array.isArray( body.channels ) ? body.channels : [],
      },
      action_url: sanitizePlainText( body.action_url ?? '', 512 ) || null,
      read: false,
      is_read: false,
    } )
    .select( '*' )
    .single();

  if ( error ) return json( { error: error.message }, 500 );

  return json( {
    ok: true,
    notification: mapNotificationRow( data ),
  }, 201 );
}

export async function handleSetPushPreference ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  if ( !isPlainObject( body ) ) return json( { error: 'Invalid request body' }, 400 );

  // The browser permission and the server opt-in are two separate facts: the
  // user can grant the browser permission and still not want push delivered.
  const enabled = body.enabled === true;

  const { data, error } = await auth.admin
    .from( 'communication_preferences' )
    .upsert(
      {
        user_id: auth.canonicalUser.id,
        push_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select( 'user_id, push_enabled, updated_at' )
    .single();

  if ( error ) return json( { error: error.message }, 500 );

  return json( { ok: true, pushEnabled: enabled, preferences: data ?? null } );
}
