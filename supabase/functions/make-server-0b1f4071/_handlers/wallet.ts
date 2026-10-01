import {
  json,
  noContent,
  buildResponseHeaders,
  finalizeResponse,
  isOriginAllowed,
  isWebhookRoute,
  enforceRequestSecurity,
  ensureRuntimeAdminAccess,
  authenticateRequest,
  getAdminClient,
  authenticateAuthUser,
  enforcePermission,
  hasAnyPermission,
  getFunctionBaseUrl,
  executeSqlStatements,
  getAppBaseUrl,
  matchesAuthenticatedUser,
  ensureCanonicalUserForAuth,
  getWalletForUser,
  getVerificationForUser,
  getDriverForUser,
  ensureDriverForUser,
  isApprovedDriver,
  buildProfilePayload,
  mapTripRow,
  mapBookingRow,
  mapPackageRow,
  fetchDriverProfiles,
  buildTrustStatus,
  ensureMobilitySeed,
  logUnhandledRouteError,
  sanitizedUnhandledErrorResponse,
  consumeRateLimit,
  resetRateLimit,
} from './shared.ts';

import {
  CLIQ_API_BASE_URL,
  CLIQ_API_KEY,
  CLIQ_CHECKOUT_URL_TEMPLATE,
  CLIQ_MERCHANT_ID,
  authenticateWalletRequest,
  buildCliqCheckoutUrl,
  buildWalletInsights,
  createCliqCheckoutSession,
  createPendingTopUpTransaction,
  createStripeCheckoutSession,
  createStripeSubscriptionCheckoutSession,
  ensureWalletForUser,
  getWalletSubscription,
  hashWalletPin,
  loadWalletDetails,
  loadWalletPayload,
  mapReferenceTypeToTransactionType,
  mapSubscriptionPlan,
  markTopUpTransactionFailed,
  normalizeWalletPaymentMethod,
  parseWalletRoute,
  resolveWalletRecipient,
  toMoneyNumber,
  toWalletTransaction,
  updateTopUpTransactionMetadata,
  verifyWalletPinHash,
} from './shared.ts';

import {
  toNumber,
} from '../_shared/pricing.ts';


export async function handleGetWallet ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  try {
    return json( await loadWalletPayload( auth.admin, auth.canonicalUser.id ) );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleGetWalletTransactions ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  try {
    const url = new URL( request.url );
    const page = Math.max( 1, Number.parseInt( url.searchParams.get( 'page' ) ?? '1', 10 ) || 1 );
    const limit = Math.min( 100, Math.max( 1, Number.parseInt( url.searchParams.get( 'limit' ) ?? '20', 10 ) || 20 ) );
    const type = url.searchParams.get( 'type' );
    const details = await loadWalletDetails( auth.admin, auth.canonicalUser.id );
    const all = details.transactions.map( toWalletTransaction );
    const filtered = type ? all.filter( ( tx ) => tx.type === type ) : all;
    const start = ( page - 1 ) * limit;
    return json( {
      transactions: filtered.slice( start, start + limit ),
      page,
      limit,
      total: filtered.length,
    } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleGetWalletInsights ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  try {
    const details = await loadWalletDetails( auth.admin, auth.canonicalUser.id );
    return json( buildWalletInsights( details.transactions.map( toWalletTransaction ) ) );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

// Per-operation ceilings (JOD). Anything larger must go through support/KYC.
const MAX_WALLET_WITHDRAW_JOD = 2000;
const MAX_WALLET_SEND_JOD = 1000;
const MAX_WALLET_TOPUP_JOD = 2000;
const WITHDRAW_METHODS = new Set( [ 'bank_transfer', 'instant' ] );
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_SECONDS = 15 * 60;

function pinAttemptKey ( userId: string ): string {
  return `wallet-pin:${ userId }`;
}

function walletOperationFailed ( scope: string, error: unknown ): Response {
  // Log the detail server-side; never echo raw database/RPC text to the client.
  console.error( `[wallet] ${ scope } failed`, error instanceof Error ? error.message : String( error ) );
  return json( { error: 'Wallet operation failed. Please try again.' }, 500 );
}

/**
 * Server-side wallet PIN gate for money-out operations.
 *
 * A wallet with a PIN set must present it on every withdrawal/transfer; before
 * this, the PIN was only ever checked by a client-called /pin/verify endpoint,
 * so anyone holding a session could skip it by calling /withdraw directly.
 * Wrong attempts are counted in Postgres and lock the wallet for 15 minutes
 * after 5 failures (fail-closed if the limiter is unavailable).
 *
 * Returns null when the operation may proceed.
 */
async function enforceWalletPin (
  admin: Parameters<typeof consumeRateLimit>[ 0 ],
  userId: string,
  wallet: { pin_hash?: string | null },
  rawPin: unknown,
): Promise<Response | null> {
  if ( !wallet.pin_hash ) return null;

  const pin = typeof rawPin === 'string' ? rawPin.trim() : '';
  if ( !/^\d{4}$/.test( pin ) ) {
    return json( { error: 'Wallet PIN is required.', code: 'PIN_REQUIRED' }, 403 );
  }

  const limited = await consumeRateLimit(
    admin,
    pinAttemptKey( userId ),
    PIN_MAX_ATTEMPTS,
    PIN_LOCKOUT_SECONDS,
    { failClosed: true },
  );
  if ( limited ) return limited;

  const verified = await verifyWalletPinHash( pin, wallet.pin_hash );
  if ( !verified ) {
    return json( { error: 'Incorrect wallet PIN.', code: 'PIN_INVALID' }, 403 );
  }

  await resetRateLimit( admin, pinAttemptKey( userId ) );
  return null;
}

export async function handleWalletWithdraw ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const throttled = await consumeRateLimit( auth.admin, `wallet-withdraw:${ auth.canonicalUser.id }`, 5, 3600, { failClosed: true } );
  if ( throttled ) return throttled;

  const body = await request.json().catch( () => ( {} ) );
  const amountJod = toMoneyNumber( body.amount );
  const bankAccount = String( body.bankAccount ?? '' ).trim();
  const method = String( body.method ?? 'bank_transfer' ).trim() || 'bank_transfer';
  if ( amountJod <= 0 ) return json( { error: 'Amount must be greater than zero.' }, 400 );
  if ( amountJod > MAX_WALLET_WITHDRAW_JOD ) {
    return json( { error: `Withdrawals are limited to JOD ${ MAX_WALLET_WITHDRAW_JOD } per request.` }, 400 );
  }
  if ( !bankAccount ) return json( { error: 'Bank account is required.' }, 400 );
  if ( !/^[A-Za-z0-9 -]{6,64}$/.test( bankAccount ) ) {
    return json( { error: 'Bank account format is invalid.' }, 400 );
  }
  if ( !WITHDRAW_METHODS.has( method ) ) {
    return json( { error: 'Unsupported withdrawal method.' }, 400 );
  }

  try {
    const wallet = await ensureWalletForUser( auth.admin, auth.canonicalUser.id );
    const pinDenied = await enforceWalletPin( auth.admin, auth.canonicalUser.id, wallet, body.pin );
    if ( pinDenied ) return pinDenied;
    if ( toNumber( wallet.balance, 0 ) < amountJod ) {
      return json( { error: 'Insufficient wallet balance.' }, 400 );
    }
    const { error } = await auth.admin.rpc( 'wallet_post_transaction', {
      p_wallet_id: wallet.wallet_id,
      p_amount: amountJod,
      p_transaction_type: 'withdraw_funds',
      p_payment_method: 'local_gateway',
      p_direction: 'debit',
      p_reference_type: 'bank_account',
      p_reference_id: null,
      p_metadata: {
        bank_account: bankAccount,
        requested_via: method,
        description: 'Wallet withdrawal',
      },
    } );
    if ( error ) throw new Error( error.message );
    return json( await loadWalletPayload( auth.admin, auth.canonicalUser.id ) );
  } catch ( error ) {
    return walletOperationFailed( 'withdraw', error );
  }
}

export async function handleWalletSend ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const amountJod = toMoneyNumber( body.amount );
  const recipientId = String( body.recipientId ?? '' ).trim();
  const note = String( body.note ?? '' ).trim().slice( 0, 200 );
  if ( amountJod <= 0 ) return json( { error: 'Amount must be greater than zero.' }, 400 );
  if ( amountJod > MAX_WALLET_SEND_JOD ) {
    return json( { error: `Transfers are limited to JOD ${ MAX_WALLET_SEND_JOD } per request.` }, 400 );
  }

  const throttled = await consumeRateLimit( auth.admin, `wallet-send:${ auth.canonicalUser.id }`, 20, 3600, { failClosed: true } );
  if ( throttled ) return throttled;

  try {
    const senderWallet = await ensureWalletForUser( auth.admin, auth.canonicalUser.id );
    const pinDenied = await enforceWalletPin( auth.admin, auth.canonicalUser.id, senderWallet, body.pin );
    if ( pinDenied ) return pinDenied;

    const recipientUserId = await resolveWalletRecipient( auth.admin, recipientId );
    if ( !recipientUserId ) return json( { error: 'Recipient wallet was not found.' }, 404 );
    if ( recipientUserId === auth.canonicalUser.id ) {
      return json( { error: 'Cannot send wallet funds to the same account.' }, 400 );
    }

    const { error } = await auth.admin.rpc( 'app_transfer_wallet_funds', {
      p_from_user_id: auth.canonicalUser.id,
      p_to_user_id: recipientUserId,
      p_amount: amountJod,
      p_payment_method: 'wallet_balance',
    } );
    if ( error ) throw new Error( error.message );

    return json( { success: true, note, wallet: await loadWalletPayload( auth.admin, auth.canonicalUser.id ) } );
  } catch ( error ) {
    return walletOperationFailed( 'send', error );
  }
}

export async function handleSetWalletPin ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const pin = String( body.pin ?? '' ).trim();
  if ( !/^\d{4}$/.test( pin ) ) return json( { error: 'Wallet PIN must be four digits.' }, 400 );

  try {
    const pinHash = await hashWalletPin( pin );
    const { error } = await auth.admin
      .from( 'wallets' )
      .update( { pin_hash: pinHash, updated_at: new Date().toISOString() } )
      .eq( 'user_id', auth.canonicalUser.id );
    if ( error ) throw new Error( error.message );
    return json( { success: true, wallet: await loadWalletPayload( auth.admin, auth.canonicalUser.id ) } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleVerifyWalletPin ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const pin = String( body.pin ?? '' ).trim();
  try {
    const wallet = await ensureWalletForUser( auth.admin, auth.canonicalUser.id );
    if ( !wallet.pin_hash ) return json( { verified: false } );

    // Same lockout bucket as withdraw/send, so /pin/verify cannot be used as an
    // unthrottled oracle to brute-force the 4-digit space.
    const limited = await consumeRateLimit(
      auth.admin,
      pinAttemptKey( auth.canonicalUser.id ),
      PIN_MAX_ATTEMPTS,
      PIN_LOCKOUT_SECONDS,
      { failClosed: true },
    );
    if ( limited ) return limited;

    const verified = await verifyWalletPinHash( pin, wallet.pin_hash );
    if ( verified ) await resetRateLimit( auth.admin, pinAttemptKey( auth.canonicalUser.id ) );
    return json( { verified } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleSetWalletAutoTopUp ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const amount = toMoneyNumber( body.amount );
  const threshold = toMoneyNumber( body.threshold );
  try {
    const { error } = await auth.admin
      .from( 'wallets' )
      .update( {
        auto_top_up_enabled: Boolean( body.enabled ),
        auto_top_up_amount: amount > 0 ? amount : 20,
        auto_top_up_threshold: threshold >= 0 ? threshold : 5,
        updated_at: new Date().toISOString(),
      } )
      .eq( 'user_id', auth.canonicalUser.id );
    if ( error ) throw new Error( error.message );
    return json( await loadWalletPayload( auth.admin, auth.canonicalUser.id ) );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleGetWalletPaymentMethods ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  try {
    const details = await loadWalletDetails( auth.admin, auth.canonicalUser.id );
    return json( { methods: details.paymentMethods } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleAddWalletPaymentMethod ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const provider = String( body.provider ?? 'manual' ).trim() || 'manual';
  try {
    const { data, error } = await auth.admin
      .from( 'payment_methods' )
      .insert( {
        user_id: auth.canonicalUser.id,
        provider,
        method_type: normalizeWalletPaymentMethod( body.type ?? body.method_type ),
        token_reference: String( body.token_reference ?? body.last4 ?? `pm-${ crypto.randomUUID() }` ),
        is_default: Boolean( body.is_default ),
        status: 'active',
      } )
      .select( '*' )
      .single();
    if ( error ) throw new Error( error.message );
    return json( data, 201 );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleDeleteWalletPaymentMethod ( request: Request, requestedUserId: string, methodId: string | null ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;
  if ( !methodId ) return json( { error: 'Payment method id is required.' }, 400 );

  try {
    const { error } = await auth.admin
      .from( 'payment_methods' )
      .delete()
      .eq( 'payment_method_id', methodId )
      .eq( 'user_id', auth.canonicalUser.id );
    if ( error ) throw new Error( error.message );
    return json( { success: true } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleGetWalletTrustScore ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  try {
    const [ { data: wallet }, { data: driver }, { data: user, error: userError } ] = await Promise.all( [
      auth.admin.from( 'wallets' ).select( 'balance' ).eq( 'user_id', auth.canonicalUser.id ).maybeSingle(),
      auth.admin.from( 'drivers' ).select( 'driver_id' ).eq( 'user_id', auth.canonicalUser.id ).maybeSingle(),
      auth.admin.from( 'users' ).select( 'verification_level' ).eq( 'id', auth.canonicalUser.id ).maybeSingle(),
    ] );
    if ( userError ) throw new Error( userError.message );
    let tripCount = 0;
    if ( driver?.driver_id ) {
      const { count } = await auth.admin
        .from( 'trips' )
        .select( 'trip_id', { count: 'exact', head: true } )
        .eq( 'driver_id', driver.driver_id );
      tripCount = toNumber( count, 0 );
    }
    return json( {
      totalTrips: tripCount,
      cashRating: 5,
      onTimePayments: user?.verification_level === 'level_0' ? 80 : 98,
      deposit: toNumber( wallet?.balance, 0 ),
    } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleGetWalletRewards ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;
  return json( { rewards: [] } );
}

export async function handleClaimWalletReward ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;
  const body = await request.json().catch( () => ( {} ) );
  const rewardId = String( body.rewardId ?? '' ).trim();
  if ( !rewardId ) return json( { error: 'Reward id is required.' }, 400 );
  return json( { error: 'Reward is not available.' }, 404 );
}

export async function handleGetWalletSubscription ( request: Request, requestedUserId: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;
  if ( !matchesAuthenticatedUser( auth, requestedUserId ) ) {
    return json( { error: 'Wallet route is not authorized for this user.' }, 403 );
  }

  try {
    const subscription = await getWalletSubscription( auth.admin, auth.canonicalUser.id );
    return json( { subscription } );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 500 );
  }
}

export async function handleWalletTopUp ( request: Request, requestedUserId: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;
  if ( !matchesAuthenticatedUser( auth, requestedUserId ) ) {
    return json( { error: 'Wallet route is not authorized for this user.' }, 403 );
  }

  const body = await request.json().catch( () => ( {} ) );
  const amountJod = toMoneyNumber( body.amount );
  const paymentMethod = String( body.paymentMethod ?? 'card' ).trim() || 'card';

  if ( amountJod <= 0 ) {
    return json( { error: 'Amount must be greater than zero.' }, 400 );
  }
  if ( amountJod > MAX_WALLET_TOPUP_JOD ) {
    return json( { error: `Top-ups are limited to JOD ${ MAX_WALLET_TOPUP_JOD } per request.` }, 400 );
  }

  // Each call creates a pending transaction row and a provider checkout session.
  const throttled = await consumeRateLimit( auth.admin, `wallet-topup:${ auth.canonicalUser.id }`, 10, 3600 );
  if ( throttled ) return throttled;

  const { data: wallet, error: walletError } = await auth.admin
    .from( 'wallets' )
    .select( 'wallet_id, user_id, currency_code' )
    .eq( 'user_id', auth.canonicalUser.id )
    .maybeSingle();

  if ( walletError ) {
    return json( { error: walletError.message }, 500 );
  }
  if ( !wallet?.wallet_id ) {
    return json( { error: 'Wallet not found.' }, 404 );
  }

  const pending = await createPendingTopUpTransaction(
    auth.admin,
    String( wallet.wallet_id ),
    amountJod,
    paymentMethod,
  );

  if ( paymentMethod === 'cliq' ) {
    if ( !CLIQ_CHECKOUT_URL_TEMPLATE && !( CLIQ_API_BASE_URL && CLIQ_MERCHANT_ID && CLIQ_API_KEY ) ) {
      await markTopUpTransactionFailed(
        auth.admin,
        pending.transactionId,
        null,
        'cliq',
        'CliQ provider is not configured on the server',
        { requested_method: paymentMethod },
      );
      return json( { error: 'CliQ provider is not configured on the server.' }, 503 );
    }

    const cliqSession = await createCliqCheckoutSession( {
      transactionId: pending.transactionId,
      amountJod,
      currency: String( wallet.currency_code ?? 'JOD' ).toUpperCase(),
      request,
    } ).catch( async ( error: unknown ) => {
      await markTopUpTransactionFailed(
        auth.admin,
        pending.transactionId,
        null,
        'cliq',
        error instanceof Error ? error.message : String( error ),
        { requested_method: paymentMethod },
      );
      throw error;
    } );

    const checkoutUrl = cliqSession.checkoutUrl || buildCliqCheckoutUrl( CLIQ_CHECKOUT_URL_TEMPLATE, {
      transactionId: pending.transactionId,
      amount: amountJod.toFixed( 3 ),
      currency: String( wallet.currency_code ?? 'JOD' ).toUpperCase(),
      returnUrl: `${ getAppBaseUrl( request ) }/app/wallet?payment=success&tx=${ encodeURIComponent( pending.transactionId ) }`,
    } );

    await updateTopUpTransactionMetadata( auth.admin, pending.transactionId, {
      provider: 'cliq',
      checkout_url: checkoutUrl,
      provider_reference: cliqSession.providerReference,
      provider_status: 'requires_action',
    } );

    return json( {
      payment: {
        transactionId: pending.transactionId,
        provider: 'cliq',
        status: 'requires_action',
        checkoutUrl,
      },
    }, 202 );
  }

  try {
    const session = await createStripeCheckoutSession( {
      amountJod,
      paymentMethod,
      transactionId: pending.transactionId,
      canonicalUserId: auth.canonicalUser.id,
      walletId: String( wallet.wallet_id ),
      request,
    } );

    await updateTopUpTransactionMetadata( auth.admin, pending.transactionId, {
      provider: 'stripe',
      provider_status: 'requires_action',
      checkout_session_id: session.id,
      checkout_url: session.url ?? null,
    } );

    return json( {
      payment: {
        transactionId: pending.transactionId,
        provider: 'stripe',
        status: 'requires_action',
        checkoutUrl: session.url ?? null,
        sessionId: session.id,
      },
    }, 202 );
  } catch ( error ) {
    const message = error instanceof Error ? error.message : String( error );
    await markTopUpTransactionFailed(
      auth.admin,
      pending.transactionId,
      null,
      'stripe',
      message,
      { requested_method: paymentMethod },
    ).catch( () => undefined );
    return json( { error: message }, 502 );
  }
}

export async function handleWalletSubscribe ( request: Request, requestedUserId: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) return auth.error;
  if ( !matchesAuthenticatedUser( auth, requestedUserId ) ) {
    return json( { error: 'Wallet route is not authorized for this user.' }, 403 );
  }

  const body = await request.json().catch( () => ( {} ) );
  const planName = String( body.planName ?? 'Wasel Plus' ).trim() || 'Wasel Plus';

  try {
    const existingSubscription = await getWalletSubscription( auth.admin, auth.canonicalUser.id );
    if ( existingSubscription && [ 'active', 'trialing', 'past_due' ].includes( existingSubscription.status ) ) {
      return json( {
        subscription: {
          ...existingSubscription,
          provider: 'stripe',
        },
      } );
    }

    const session = await createStripeSubscriptionCheckoutSession( {
      admin: auth.admin,
      canonicalUser: {
        id: auth.canonicalUser.id,
        email: auth.canonicalUser.email ?? auth.authUser.email ?? null,
        full_name: auth.canonicalUser.full_name ?? null,
        phone_number: auth.canonicalUser.phone_number ?? null,
      },
      planName,
      request,
    } );

    return json( {
      subscription: {
        provider: 'stripe',
        status: 'requires_action',
        checkoutUrl: session.url ?? null,
        sessionId: session.id,
        plan: mapSubscriptionPlan( planName ),
      },
    }, 202 );
  } catch ( error ) {
    return json( { error: error instanceof Error ? error.message : String( error ) }, 502 );
  }
}

type PayableAmount =
  | { amountJod: number; metadata: Record<string, unknown> }
  | { error: Response };

/**
 * Derive the authoritative amount for a wallet payment from the referenced
 * record, and confirm the caller actually owns it.
 *
 * The browser computes fares (see `getMovementPriceQuote` in FindRidePage and
 * `usePayment`), so accepting `amount` from the request body would let any
 * caller settle a booking for an arbitrary sum. The amount is therefore always
 * read back from the server-side record and the owner is checked before money
 * moves.
 */
async function resolvePayableAmount (
  admin: ReturnType<typeof getAdminClient>,
  referenceType: string,
  referenceId: string,
  callerUserId: string,
): Promise<PayableAmount> {
  if ( referenceType === 'ride_booking' ) {
    const { data, error } = await admin
      .from( 'bookings' )
      .select( 'id, trip_id, amount, total_price, price_per_seat, seats_requested, user_id, passenger_id, booking_status, payment_status' )
      .eq( 'id', referenceId )
      .maybeSingle();

    if ( error ) return { error: walletOperationFailed( 'pay', error ) };
    if ( !data ) return { error: json( { error: 'Booking not found.' }, 404 ) };
    if ( !isOwnedByCaller( data, callerUserId ) ) {
      return { error: json( { error: 'This booking does not belong to you.' }, 403 ) };
    }

    // Prefer the recomputed fare so a tampered stored total cannot be settled.
    const perSeat = toMoneyNumber( data.price_per_seat );
    const seats = toNumber( data.seats_requested, 1 );
    const computed = perSeat > 0 && seats > 0 ? perSeat * seats : 0;
    const amountJod = computed > 0 ? computed : toMoneyNumber( data.total_price ?? data.amount );

    if ( amountJod <= 0 ) {
      return { error: json( { error: 'This booking has no payable amount.' }, 409 ) };
    }

    return {
      amountJod,
      metadata: { trip_id: data.trip_id ?? null, booking_id: data.id },
    };
  }

  if ( referenceType === 'package_delivery' ) {
    const { data, error } = await admin
      .from( 'packages' )
      .select( 'id, price, sender_id, recipient_id, status' )
      .eq( 'id', referenceId )
      .maybeSingle();

    if ( error ) return { error: walletOperationFailed( 'pay', error ) };
    if ( !data ) return { error: json( { error: 'Package not found.' }, 404 ) };
    if ( data.sender_id !== callerUserId ) {
      return { error: json( { error: 'This package does not belong to you.' }, 403 ) };
    }

    const amountJod = toMoneyNumber( data.price );
    if ( amountJod <= 0 ) {
      return { error: json( { error: 'This package has no payable amount.' }, 409 ) };
    }

    return { amountJod, metadata: { package_id: data.id } };
  }

  if ( referenceType === 'bus_booking' ) {
    const { data, error } = await admin
      .from( 'bus_bookings' )
      .select( 'id, total_price, user_id, status' )
      .eq( 'id', referenceId )
      .maybeSingle();

    if ( error ) return { error: walletOperationFailed( 'pay', error ) };
    if ( !data ) return { error: json( { error: 'Bus booking not found.' }, 404 ) };
    if ( data.user_id !== callerUserId ) {
      return { error: json( { error: 'This booking does not belong to you.' }, 403 ) };
    }

    const amountJod = toMoneyNumber( data.total_price );
    if ( amountJod <= 0 ) {
      return { error: json( { error: 'This booking has no payable amount.' }, 409 ) };
    }

    return { amountJod, metadata: { bus_booking_id: data.id } };
  }

  // Subscriptions and one-off purchases are priced by the server from the
  // configured plan, so there is no client-referenced record to re-derive.
  if ( referenceType === 'subscription' ) {
    return { error: json( { error: 'Subscriptions are billed by the payment provider, not the wallet.' }, 400 ) };
  }

  return { error: json( { error: 'Invalid reference type.' }, 400 ) };
}

/** Booking ownership spans several schema generations, so check every owner column. */
function isOwnedByCaller ( row: Record<string, unknown>, callerUserId: string ): boolean {
  const ownerColumns = [ 'user_id', 'passenger_id', 'rider_id', 'sender_id' ];
  return ownerColumns.some( column => row[ column ] === callerUserId );
}

export async function handleWalletPay ( request: Request, requestedUserId: string ) {
  const auth = await authenticateWalletRequest( request, requestedUserId );
  if ( 'error' in auth ) return auth.error;

  const body = await request.json().catch( () => ( {} ) );
  const referenceType = String( body.referenceType ?? body.reference_type ?? 'ride_booking' ).trim();
  const referenceId = String( body.referenceId ?? body.reference_id ?? '' ).trim();

  if ( !referenceId ) {
    return json( { error: 'A reference id is required.' }, 400 );
  }

  const allowedReferenceTypes = [ 'ride_booking', 'package_delivery', 'bus_booking', 'subscription', 'purchase' ];
  if ( !allowedReferenceTypes.includes( referenceType ) ) {
    return json( { error: `Invalid reference type. Must be one of: ${ allowedReferenceTypes.join( ', ' ) }` }, 400 );
  }

  try {
    // The fare is always re-derived from the referenced record. A client-supplied
    // amount is never trusted: the browser computes the quote, so accepting it
    // would let a caller settle any booking for an arbitrary sum.
    const authoritativeAmountJod = await resolvePayableAmount( auth.admin, referenceType, referenceId, auth.canonicalUser.id );
    if ( 'error' in authoritativeAmountJod ) return authoritativeAmountJod.error;

    const { amountJod, metadata } = authoritativeAmountJod;
    if ( amountJod <= 0 ) {
      return json( { error: 'Amount must be greater than zero.' }, 400 );
    }

    const wallet = await ensureWalletForUser( auth.admin, auth.canonicalUser.id );
    if ( toNumber( wallet.balance, 0 ) < amountJod ) {
      return json( { error: 'Insufficient wallet balance.' }, 400 );
    }

    const transactionType = mapReferenceTypeToTransactionType( referenceType );
    const { error } = await auth.admin.rpc( 'app_pay_with_wallet', {
      p_user_id: auth.canonicalUser.id,
      p_amount: amountJod,
      p_transaction_type: transactionType,
      p_payment_method: 'wallet_balance',
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_metadata: metadata,
    } );

    if ( error ) {
      return walletOperationFailed( 'pay', error );
    }

    const updatedWallet = await loadWalletPayload( auth.admin, auth.canonicalUser.id );
    return json( { success: true, wallet: updatedWallet, transactionType, referenceId } );
  } catch ( error ) {
    return walletOperationFailed( 'pay', error );
  }
}

export async function handleWalletDispatch ( request: Request, path: string ): Promise<Response | undefined> {
  const walletRoute = parseWalletRoute( path );
  if ( !walletRoute ) return undefined;

  const method = request.method;
  const { userId, action, resourceId } = walletRoute;

  if ( method === 'GET' && action === '' ) return handleGetWallet( request, userId );
  if ( method === 'GET' && action === 'transactions' ) return handleGetWalletTransactions( request, userId );
  if ( method === 'GET' && action === 'insights' ) return handleGetWalletInsights( request, userId );
  if ( method === 'POST' && action === 'withdraw' ) return handleWalletWithdraw( request, userId );
  if ( method === 'POST' && action === 'send' ) return handleWalletSend( request, userId );
  if ( method === 'POST' && action === 'pin' && resourceId === 'set' ) return handleSetWalletPin( request, userId );
  if ( method === 'POST' && action === 'pin' && resourceId === 'verify' ) return handleVerifyWalletPin( request, userId );
  if ( method === 'POST' && action === 'auto-topup' ) return handleSetWalletAutoTopUp( request, userId );
  if ( method === 'GET' && action === 'payment-methods' ) return handleGetWalletPaymentMethods( request, userId );
  if ( method === 'POST' && action === 'payment-methods' ) return handleAddWalletPaymentMethod( request, userId );
  if ( method === 'DELETE' && action === 'payment-methods' ) return handleDeleteWalletPaymentMethod( request, userId, resourceId );
  if ( method === 'GET' && action === 'trust-score' ) return handleGetWalletTrustScore( request, userId );
  if ( method === 'GET' && action === 'rewards' ) return handleGetWalletRewards( request, userId );
  if ( method === 'POST' && action === 'rewards' && resourceId === 'claim' ) return handleClaimWalletReward( request, userId );
  if ( method === 'GET' && action === 'subscription' ) return handleGetWalletSubscription( request, userId );
  if ( method === 'POST' && action === 'top-up' ) return handleWalletTopUp( request, userId );
  if ( method === 'POST' && action === 'subscribe' ) return handleWalletSubscribe( request, userId );
  if ( method === 'POST' && action === 'pay' ) return handleWalletPay( request, userId );
  return undefined;
}
