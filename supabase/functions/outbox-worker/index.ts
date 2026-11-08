import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get( 'SUPABASE_URL' ) ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get( 'SUPABASE_SERVICE_ROLE_KEY' ) ?? '';
const WORKER_SECRET = Deno.env.get( 'OUTBOX_WORKER_SECRET' ) ?? '';
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

type OutboxRow = {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  producer: string;
  trace_id: string;
  attempts: number;
  created_at: string;
};

// Topic → edge function path for fan-out dispatch.
const TOPIC_FUNCTION_MAP: Record<string, string> = {
  'rides.requested':           'matching-worker',
  'rides.assigned':            'make-server-0b1f4071',
  'rides.completed':           'make-server-0b1f4071',
  'packages.created':          'package-service',
  'packages.location-updated': 'package-service',
  'packages.delivered':        'make-server-0b1f4071',
  'payments.authorized':       'make-server-0b1f4071',
  'payments.captured':         'make-server-0b1f4071',
  'notifications.dispatch':    'make-server-0b1f4071',
};

function getAdminClient () {
  return createClient( SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  } );
}

function constantTimeEqual ( a: string, b: string ): boolean {
  if ( a.length !== b.length ) {return false;}
  let result = 0;
  for ( let i = 0; i < a.length; i++ ) {result |= a.charCodeAt( i ) ^ b.charCodeAt( i );}
  return result === 0;
}

async function dispatchEvent ( event: OutboxRow ): Promise<{ ok: boolean; reason?: string }> {
  const fnName = TOPIC_FUNCTION_MAP[ event.topic ];
  if ( !fnName ) {
    return { ok: true, reason: 'no_worker_registered' };
  }

  const fnUrl = `${ SUPABASE_URL.replace( /\/$/, '' ) }/functions/v1/${ fnName }/events`;

  try {
    const response = await fetch( fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ SUPABASE_SERVICE_ROLE_KEY }`,
        'X-Trace-Id': event.trace_id,
        'X-Outbox-Event-Id': event.id,
      },
      body: JSON.stringify( {
        id: event.id,
        topic: event.topic,
        payload: event.payload,
        traceId: event.trace_id,
        producer: event.producer,
        occurredAt: event.created_at,
        attempts: event.attempts,
      } ),
    } );

    if ( !response.ok ) {
      const text = await response.text().catch( () => '' );
      return { ok: false, reason: `http_${ response.status }: ${ text.slice( 0, 200 ) }` };
    }

    return { ok: true };
  } catch ( err ) {
    return { ok: false, reason: err instanceof Error ? err.message : String( err ) };
  }
}

async function drainOutbox (): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
  const admin = getAdminClient();

  // Atomically claim a batch with SKIP LOCKED — concurrent worker invocations
  // (cron overlap, manual trigger) each get a disjoint set of rows and never
  // dispatch the same event twice.
  const { data, error } = await admin.rpc( 'consume_outbox_batch', { p_batch_size: BATCH_SIZE } );

  if ( error ) {throw new Error( `outbox batch claim failed: ${ error.message }` );}

  const rows = ( Array.isArray( data ) ? data : [] ) as OutboxRow[];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for ( const event of rows ) {
    const result = await dispatchEvent( event );

    if ( result.reason === 'no_worker_registered' ) {
      await admin
        .from( 'event_outbox' )
        .update( { status: 'processed', processed_at: new Date().toISOString() } )
        .eq( 'id', event.id );
      skipped++;
      continue;
    }

    if ( result.ok ) {
      await admin
        .from( 'event_outbox' )
        .update( { status: 'processed', processed_at: new Date().toISOString() } )
        .eq( 'id', event.id );
      succeeded++;
    } else {
      // Delegate backoff scheduling and DLQ transition to the DB function so the
      // logic is consistent regardless of which worker instance handles the row.
      const { error: failError } = await admin.rpc( 'outbox_record_failure', {
        p_id:           event.id,
        p_max_attempts: MAX_ATTEMPTS,
        p_error:        result.reason ?? null,
      } );

      if ( failError ) {
        console.error( JSON.stringify( {
          level: 'error',
          service: 'outbox-worker',
          message: 'outbox_record_failure RPC failed',
          eventId: event.id,
          rpcError: failError.message,
        } ) );
      }

      console.error( JSON.stringify( {
        level: 'error',
        service: 'outbox-worker',
        message: 'event dispatch failed',
        eventId: event.id,
        topic: event.topic,
        traceId: event.trace_id,
        attempts: ( event.attempts ?? 0 ) + 1,
        reason: result.reason,
      } ) );

      failed++;
    }
  }

  return { processed: rows.length, succeeded, failed, skipped };
}

Deno.serve( async ( request: Request ) => {
  if ( request.method !== 'POST' ) {
    return new Response( JSON.stringify( { error: 'Method not allowed' } ), { status: 405 } );
  }

  const secret = request.headers.get( 'x-outbox-worker-secret' ) ?? '';

  if ( !WORKER_SECRET ) {
    return new Response( JSON.stringify( { error: 'Worker is not configured' } ), { status: 503 } );
  }

  if ( !constantTimeEqual( secret, WORKER_SECRET ) ) {
    return new Response( JSON.stringify( { error: 'Unauthorized' } ), { status: 401 } );
  }

  if ( !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY ) {
    return new Response( JSON.stringify( { error: 'Supabase not configured' } ), { status: 503 } );
  }

  try {
    const result = await drainOutbox();
    console.info( JSON.stringify( { level: 'info', service: 'outbox-worker', ...result } ) );
    return new Response( JSON.stringify( result ), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    } );
  } catch ( err ) {
    const message = err instanceof Error ? err.message : String( err );
    console.error( JSON.stringify( { level: 'error', service: 'outbox-worker', message } ) );
    return new Response( JSON.stringify( { error: message } ), { status: 500 } );
  }
} );
