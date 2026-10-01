import {
    json,
    authenticateRequest,
    enforcePermission,
    consumeRateLimit,
} from './shared.ts';

import {
  ALLOWED_PAYMENT_CURRENCIES,
  normalizePaymentAmount,
  stripe,
} from './shared.ts';

// Metadata keys the server owns. A client must never be able to set these:
// `transaction_id` / `client_reference_id` drive wallet top-up finalization and
// failure handling in the Stripe webhook, and `user_id` / `plan*` drive
// ownership and subscription sync.
const RESERVED_METADATA_KEYS = new Set( [
  'user_id',
  'transaction_id',
  'client_reference_id',
  'plan',
  'plan_name',
  'wallet_id',
  'booking_id_verified',
] );

const MAX_METADATA_ENTRIES = 10;
const MAX_METADATA_VALUE_LENGTH = 200;
const REFUND_REASONS = new Set( [ 'requested_by_customer', 'duplicate', 'fraudulent' ] );

function sanitizeClientMetadata ( input: unknown ): Record<string, string> {
  const out: Record<string, string> = {};
  if ( !input || typeof input !== 'object' || Array.isArray( input ) ) {return out;}

  for ( const [ rawKey, rawValue ] of Object.entries( input as Record<string, unknown> ) ) {
    if ( Object.keys( out ).length >= MAX_METADATA_ENTRIES ) {break;}
    const key = rawKey.trim().slice( 0, 40 );
    if ( !key || RESERVED_METADATA_KEYS.has( key.toLowerCase() ) ) {continue;}
    if ( typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean' ) {continue;}
    out[ key ] = String( rawValue ).slice( 0, MAX_METADATA_VALUE_LENGTH );
  }
  return out;
}

export async function handlePaymentIntentCreate ( request: Request ): Promise<Response> {
  if ( !stripe ) {
    return json( { error: 'Stripe is not configured' }, 503 );
  }

  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  const {
    action,
    amount,
    currency = 'usd',
    metadata,
    idempotency_key,
  } = body as {
    action?: string;
    amount?: unknown;
    currency?: string;
    metadata?: unknown;
    idempotency_key?: string;
  };
  // Card-testing / fee-abuse guard: each call creates a live PaymentIntent on
  // the platform's Stripe account. Fail closed - a money path must not run
  // unthrottled just because the limiter is down.
  const limited = await consumeRateLimit( auth.admin, `payment-intent:${ auth.authUser.id }`, 10, 3600, { failClosed: true } );
  if ( limited ) {return limited;}

  // NOTE: a client-supplied `customer_id` is intentionally ignored. Accepting
  // one lets a caller attach a PaymentIntent to another user's Stripe customer.

  if ( action && action !== 'create-payment-intent' ) {
    return json( { error: 'Unsupported payment action' }, 400 );
  }

  const normalizedAmount = normalizePaymentAmount( amount );
  const normalizedCurrency = String( currency ).toLowerCase();
  if ( !normalizedAmount ) {
    return json( { error: 'Invalid amount' }, 400 );
  }
  if ( !ALLOWED_PAYMENT_CURRENCIES.has( normalizedCurrency ) ) {
    return json( { error: 'Invalid currency' }, 400 );
  }

  // Scope the idempotency key to the caller so one user can never replay or
  // collide with another user's key.
  const scopedIdempotencyKey =
    typeof idempotency_key === 'string' && idempotency_key.trim().length > 0
      ? `${ auth.authUser.id }:${ idempotency_key.trim().slice( 0, 120 ) }`
      : undefined;

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: normalizedAmount,
        currency: normalizedCurrency,
        metadata: {
          ...sanitizeClientMetadata( metadata ),
          user_id: auth.authUser.id,
        },
      },
      scopedIdempotencyKey ? { idempotencyKey: scopedIdempotencyKey } : undefined,
    );

    return json( {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      client_secret: pi.client_secret,
    } );
  } catch ( error ) {
    console.error( '[payments] create-intent failed', error instanceof Error ? error.message : String( error ) );
    return json( { error: 'Payment intent creation failed' }, 502 );
  }
}

export async function handlePaymentRefund ( request: Request ): Promise<Response> {
  if ( !stripe ) {
    return json( { error: 'Stripe is not configured' }, 503 );
  }

  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  // Refunds move money out of the platform. Only roles holding the canonical
  // `payments:refund` permission (admin, finance) may issue them. Passenger
  // refunds must go through the cancellation flow, which applies policy.
  const denied = enforcePermission( auth, 'payments:refund' );
  if ( denied ) {return denied;}

  const body = await request.json().catch( () => ( {} ) );
  const { payment_intent_id, booking_id, amount, reason } = body as {
    payment_intent_id?: string;
    booking_id?: string;
    amount?: unknown;
    reason?: string;
  };

  let resolvedPaymentIntentId =
    typeof payment_intent_id === 'string' && payment_intent_id.startsWith( 'pi_' )
      ? payment_intent_id
      : undefined;

  if ( !resolvedPaymentIntentId && typeof booking_id === 'string' && booking_id ) {
    const { data: paymentRecord, error: lookupError } = await auth.admin
      .from( 'payments' )
      .select( 'id' )
      .eq( 'booking_id', booking_id )
      .order( 'created_at', { ascending: false } )
      .limit( 1 )
      .maybeSingle();

    if ( lookupError ) {
      console.error( '[payments] refund lookup failed', lookupError.message );
      return json( { error: 'Payment lookup failed' }, 500 );
    }

    const candidate = paymentRecord?.id ? String( paymentRecord.id ) : '';
    // Only a Stripe PaymentIntent id can be refunded; a bare DB uuid cannot.
    resolvedPaymentIntentId = candidate.startsWith( 'pi_' ) ? candidate : undefined;
  }

  if ( !resolvedPaymentIntentId ) {
    return json( { error: 'A valid payment_intent_id (pi_…) or a booking with a card payment is required' }, 400 );
  }

  let refundAmount: number | undefined;
  if ( amount !== undefined && amount !== null ) {
    if ( typeof amount !== 'number' || !Number.isInteger( amount ) || amount <= 0 ) {
      return json( { error: 'Refund amount must be a positive integer in minor units' }, 400 );
    }
    refundAmount = amount;
  }

  const normalizedReason = REFUND_REASONS.has( String( reason ) )
    ? ( reason as 'requested_by_customer' | 'duplicate' | 'fraudulent' )
    : 'requested_by_customer';

  try {
    // Declared locally rather than as `Stripe.RefundCreateParams`: the Stripe
    // SDK is loaded as a remote ESM module, which exports the class but not the
    // `Stripe` namespace, so the namespace type is not reachable here. This is
    // the subset of refund parameters this handler actually sends.
    const params: {
      payment_intent: string;
      amount?: number;
      reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
      metadata: Record<string, string>;
    } = {
      payment_intent: resolvedPaymentIntentId,
      reason: normalizedReason,
      metadata: { refunded_by: auth.authUser.id },
    };
    if ( refundAmount ) {
      params.amount = refundAmount;
    }

    // Deterministic key: a retried request for the same intent/amount cannot
    // issue a second refund.
    const idempotencyKey = `refund:${ resolvedPaymentIntentId }:${ refundAmount ?? 'full' }`;
    const refund = await stripe.refunds.create( params, { idempotencyKey } );

    console.info( '[payments] refund issued', {
      refundId: refund.id,
      paymentIntent: resolvedPaymentIntentId,
      actor: auth.authUser.id,
    } );

    return json( {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    } );
  } catch ( error ) {
    console.error( '[payments] refund failed', error instanceof Error ? error.message : String( error ) );
    return json( { error: 'Refund failed' }, 502 );
  }
}

export async function handleGetPaymentStatus ( request: Request, bookingId: string ): Promise<Response> {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const admin = auth.admin;
  const { data, error } = await admin
    .from( 'bookings' )
    .select( 'payment_status' )
    .eq( 'id', bookingId )
    .eq( 'passenger_id', auth.canonicalUser.id )
    .maybeSingle();

  if ( error ) {
    console.error( '[payments] status lookup failed', error.message );
    return json( { error: 'Payment status lookup failed' }, error.code === 'PGRST116' ? 404 : 500 );
  }

  return json( { paymentStatus: data?.payment_status ?? 'unknown' } );
}
