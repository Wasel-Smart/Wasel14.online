import {
    json,
    noContent,
    finalizeResponse,
    isOriginAllowed,
    enforceRequestSecurity,
    logUnhandledRouteError,
    sanitizedUnhandledErrorResponse,
    parseWalletRoute,
} from './_handlers/shared.ts';

import {
  handleAdminListPendingDrivers,
  handleAdminApproveDriver,
  handleAdminListUsers,
  handleAdminSetUserStatus,
  handleAdminListDisputes,
  handleAdminResolveDispute,
  handleAdminDashboardMetrics,
} from './_handlers/admin.ts';
// Every handler module is imported for its named bindings further down; the
// bare side-effect imports that used to sit here never registered anything and
// left the route table referencing functions that did not exist in scope.
import { handleWalletDispatch } from './_handlers/wallet.ts';
import {
  handleGetActiveTrip,
  handleSetActiveTrip,
  handlePatchActiveTrip,
  handleClearActiveTrip,
} from './_handlers/activeTrip.ts';
import {
  handleGetNotifications,
  handleMarkNotificationRead,
  handleSendPushNotification,
  handleSetPushPreference,
} from './_handlers/notifications.ts';
import { handleSubmitReview } from './_handlers/reviews.ts';
import { handleStripeWebhook, handleCliqWebhook, handleSanadWebhook, handleResendWebhook, handleTwilioWebhook, handleSendSmsHook } from './_handlers/webhooks.ts';

import {
  handleEnableDriverMode,
  handleProfileRequest,
  handleSubmitDriverDocuments,
  handleSubmitIdentityVerification,
  handleTwoFactorDisable,
  handleTwoFactorSetup,
  handleTwoFactorVerify,
} from './_handlers/identity.ts';

import {
  handleCancelTrip,
  handleGetLiveTrip,
  handleTripRequest,
} from './_handlers/trips.ts';

import {
  handleBookingRequest,
  handleCanCancelBooking,
  handleCanRateBooking,
  handleCancelBooking,
  handleGetDriverRating,
  handleSubmitRating,
} from './_handlers/bookings.ts';

import {
  handlePackageRequest,
} from './_handlers/packages.ts';

import {
  handleApplyModerationMigrations,
  handleSubmitReport,
} from './_handlers/moderation.ts';

import {
  handleGetChatMessages,
  handleGetChatUnreadCount,
  handleMarkChatMessagesRead,
  handleSendChatMessage,
} from './_handlers/chat.ts';

import {
  handleGetMobilityLiveRows,
  handleMobilityOSRequest,
  handlePublicMobilitySnapshot,
} from './_handlers/mobility.ts';

import {
  handleCancelDeletion,
  handleGetConsent,
  handleRecordConsent,
  handleRequestDataExport,
  handleRequestDeletion,
} from './_handlers/gdpr.ts';

import {
  handleApplyCommunicationMigrations,
  handleGetCommunicationPreferences,
  handlePatchCommunicationPreferences,
  handleProcessCommunicationQueue,
  handleProviderDiagnostics,
  handleQueueCommunicationDeliveries,
  handleSendTestCommunication,
} from './_handlers/communications.ts';

import {
  handleConfirmPhoneVerification,
  handleGetTrustStatus,
  handleStartPhoneVerification,
} from './_handlers/trust.ts';

import {
  handleGetPaymentStatus,
  handlePaymentIntentCreate,
  handlePaymentRefund,
} from './_handlers/payments.ts';

import {
  handleHealth,
} from './_handlers/infrastructure.ts';

import {
  handleCreateOrganization,
  handleGetOrganization,
  handleListOrganizations,
  handleAddMember,
  handleAddCredits,
  handleGenerateInvoice,
  handleGetInvoices,
} from './_handlers/corporate.ts';


interface RouteDescriptor {
  id: string;
  methods?: string[];
  test: ( path: string, method: string ) => boolean;
  handle: ( request: Request, path: string ) => Promise<Response | undefined>;
}

const ROUTES: RouteDescriptor[] = [
  {
    id: 'profile',
    test: ( path, method ) =>
      ( method === 'POST' && path === '/profile' ) ||
      ( ( method === 'GET' || method === 'PATCH' ) && /^\/profile\/[^/]+$/.test( path ) ),
    handle: ( request, path ) => handleProfileRequest( request, path ),
  },
  {
    id: 'trips',
    test: ( path ) => path === '/trips' || path.startsWith( '/trips/' ),
    handle: ( request, path ) => handleTripRequest( request, path ),
  },
  {
    id: 'bookings',
    test: ( path ) => path === '/bookings' || path.startsWith( '/bookings/' ),
    handle: ( request, path ) => handleBookingRequest( request, path ),
  },
  {
    id: 'packages',
    test: ( path ) => path === '/packages' || path.startsWith( '/packages/' ),
    handle: ( request, path ) => handlePackageRequest( request, path ),
  },
  {
    id: 'ratings-submit',
    methods: [ 'POST' ],
    test: ( path ) => path === '/ratings',
    handle: ( request ) => handleSubmitRating( request ),
  },
  {
    id: 'ratings-driver',
    methods: [ 'GET' ],
    test: ( path ) => /^\/ratings\/drivers\/[^/]+$/.test( path ),
    handle: ( request, path ) => handleGetDriverRating( request, path ),
  },
  {
    id: 'ratings-eligibility',
    methods: [ 'GET' ],
    test: ( path ) => /^\/ratings\/bookings\/[^/]+\/eligibility$/.test( path ),
    handle: ( request, path ) => handleCanRateBooking( request, path ),
  },
  {
    id: 'reports-submit',
    methods: [ 'POST' ],
    test: ( path ) => path === '/reports',
    handle: ( request ) => handleSubmitReport( request ),
  },
  {
    id: 'cancel-booking',
    methods: [ 'POST' ],
    test: ( path ) => path === '/cancellations/bookings',
    handle: ( request ) => handleCancelBooking( request ),
  },
  {
    id: 'cancel-trip',
    methods: [ 'POST' ],
    test: ( path ) => path === '/cancellations/trips',
    handle: ( request ) => handleCancelTrip( request ),
  },
  {
    id: 'cancel-eligibility',
    methods: [ 'GET' ],
    test: ( path ) => /^\/cancellations\/bookings\/[^/]+\/eligibility$/.test( path ),
    handle: ( request, path ) => handleCanCancelBooking( request, path ),
  },
  {
    id: 'chat-messages-get',
    methods: [ 'GET' ],
    test: ( path ) => /^\/chat\/trips\/[^/]+\/messages$/.test( path ),
    handle: ( request, path ) => handleGetChatMessages( request, path ),
  },
  {
    id: 'chat-messages-post',
    methods: [ 'POST' ],
    test: ( path ) => /^\/chat\/trips\/[^/]+\/messages$/.test( path ),
    handle: ( request, path ) => handleSendChatMessage( request, path ),
  },
  {
    id: 'chat-read',
    methods: [ 'POST' ],
    test: ( path ) => path === '/chat/messages/read',
    handle: ( request ) => handleMarkChatMessagesRead( request ),
  },
  {
    id: 'chat-unread',
    methods: [ 'GET' ],
    test: ( path ) => /^\/chat\/trips\/[^/]+\/unread-count$/.test( path ),
    handle: ( request, path ) => handleGetChatUnreadCount( request, path ),
  },
  {
    id: 'mobility-live-rows',
    methods: [ 'GET' ],
    test: ( path ) => path === '/mobility-os/live-rows',
    handle: ( request ) => handleGetMobilityLiveRows( request ),
  },
  {
    id: 'live-trip',
    methods: [ 'GET' ],
    test: ( path ) => path === '/live-trip',
    handle: ( request ) => handleGetLiveTrip( request ),
  },
  // ── Ride-in-progress state ────────────────────────────────────────────────
  // One record per user, shared by the Dashboard banner and LiveTripTracking so
  // a reload restores the ride. Mutating verbs require the x-csrf-token header
  // that fetchWithRetry attaches centrally.
  {
    id: 'active-trip-get',
    methods: [ 'GET' ],
    test: ( path ) => path === '/active-trip',
    handle: ( request ) => handleGetActiveTrip( request ),
  },
  {
    id: 'active-trip-set',
    methods: [ 'POST' ],
    test: ( path ) => path === '/active-trip',
    handle: ( request ) => handleSetActiveTrip( request ),
  },
  {
    id: 'active-trip-patch',
    methods: [ 'PATCH' ],
    test: ( path ) => path === '/active-trip',
    handle: ( request ) => handlePatchActiveTrip( request ),
  },
  {
    id: 'active-trip-clear',
    methods: [ 'DELETE' ],
    test: ( path ) => path === '/active-trip',
    handle: ( request ) => handleClearActiveTrip( request ),
  },
  // ── Notifications ────────────────────────────────────────────────────────
  // The literal sub-paths are registered before the {id}/read pattern so a
  // notification type can never shadow a route name.
  {
    id: 'notifications-list',
    methods: [ 'GET' ],
    test: ( path ) => path === '/notifications',
    handle: ( request ) => handleGetNotifications( request ),
  },
  {
    id: 'notifications-send-push',
    methods: [ 'POST' ],
    test: ( path ) => path === '/notifications/send-push',
    handle: ( request ) => handleSendPushNotification( request ),
  },
  {
    id: 'notifications-push-pref',
    methods: [ 'POST' ],
    test: ( path ) => path === '/notifications/push-pref',
    handle: ( request ) => handleSetPushPreference( request ),
  },
  {
    id: 'notifications-mark-read',
    methods: [ 'PATCH' ],
    test: ( path ) => /^\/notifications\/[^/]+\/read$/.test( path ),
    handle: ( request, path ) =>
      handleMarkNotificationRead( request, decodeURIComponent( path.split( '/' )[ 2 ] ) ),
  },
  // ── Post-ride review ─────────────────────────────────────────────────────
  // Distinct from /ratings: see the contract note in _handlers/reviews.ts.
  {
    id: 'reviews-submit',
    methods: [ 'POST' ],
    test: ( path ) => path === '/reviews',
    handle: ( request ) => handleSubmitReview( request ),
  },
  {
    id: 'gdpr-consents-post',
    methods: [ 'POST' ],
    test: ( path ) => path === '/gdpr/consents',
    handle: ( request ) => handleRecordConsent( request ),
  },
  {
    id: 'gdpr-consents-get',
    methods: [ 'GET' ],
    test: ( path ) => /^\/gdpr\/consents\/[^/]+$/.test( path ),
    handle: ( request, path ) => handleGetConsent( request, path ),
  },
  {
    id: 'gdpr-data-exports',
    methods: [ 'POST' ],
    test: ( path ) => path === '/gdpr/data-exports',
    handle: ( request ) => handleRequestDataExport( request ),
  },
  {
    id: 'gdpr-deletions',
    methods: [ 'POST' ],
    test: ( path ) => path === '/gdpr/deletions',
    handle: ( request ) => handleRequestDeletion( request ),
  },
  {
    id: 'gdpr-deletions-cancel',
    methods: [ 'POST' ],
    test: ( path ) => path === '/gdpr/deletions/cancel',
    handle: ( request ) => handleCancelDeletion( request ),
  },
  {
    id: 'mobility-os',
    test: ( path ) => path === '/mobility-os/snapshot' || path === '/mobility-os/booking/create',
    handle: ( request, path ) => handleMobilityOSRequest( request, path ),
  },
  {
    id: 'mobility-os-public',
    methods: [ 'GET' ],
    test: ( path ) => path === '/mobility-os/public-snapshot',
    handle: ( _request, _path ) => handlePublicMobilitySnapshot( _request ),
  },
  {
    id: 'wallet',
    test: ( path ) => parseWalletRoute( path ) !== null,
    handle: ( request, path ) => handleWalletDispatch( request, path ),
  },
  {
    id: 'communications-preferences-get',
    methods: [ 'GET' ],
    test: ( path ) => path === '/communications/preferences',
    handle: ( request ) => handleGetCommunicationPreferences( request ),
  },
  {
    id: 'trust-status',
    methods: [ 'GET' ],
    test: ( path ) => path === '/trust/status',
    handle: ( request ) => handleGetTrustStatus( request ),
  },
  {
    id: 'trust-phone-start',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/phone/start',
    handle: ( request ) => handleStartPhoneVerification( request ),
  },
  {
    id: 'trust-phone-confirm',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/phone/confirm',
    handle: ( request ) => handleConfirmPhoneVerification( request ),
  },
  {
    id: 'trust-identity-submit',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/identity/submit',
    handle: ( request ) => handleSubmitIdentityVerification( request ),
  },
  {
    id: 'trust-driver-mode-enable',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/driver-mode/enable',
    handle: ( request ) => handleEnableDriverMode( request ),
  },
  {
    id: 'trust-driver-documents-submit',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/driver-documents/submit',
    handle: ( request ) => handleSubmitDriverDocuments( request ),
  },
  {
    id: 'auth-2fa-setup',
    methods: [ 'POST' ],
    test: ( path ) => path === '/auth/2fa/setup',
    handle: ( request ) => handleTwoFactorSetup( request ),
  },
  {
    id: 'auth-2fa-verify',
    methods: [ 'POST' ],
    test: ( path ) => path === '/auth/2fa/verify',
    handle: ( request ) => handleTwoFactorVerify( request ),
  },
  {
    id: 'auth-2fa-disable',
    methods: [ 'POST' ],
    test: ( path ) => path === '/auth/2fa/disable',
    handle: ( request ) => handleTwoFactorDisable( request ),
  },
  {
    id: 'communications-preferences-patch',
    methods: [ 'PATCH' ],
    test: ( path ) => path === '/communications/preferences',
    handle: ( request ) => handlePatchCommunicationPreferences( request ),
  },
  {
    id: 'communications-deliver',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/deliver',
    handle: ( request ) => handleQueueCommunicationDeliveries( request ),
  },
  {
    id: 'communications-process',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/process',
    handle: ( request ) => handleProcessCommunicationQueue( request ),
  },
  {
    id: 'communications-admin-send-test',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/admin/send-test',
    handle: ( request ) => handleSendTestCommunication( request ),
  },
  {
    id: 'communications-admin-provider-diagnostics',
    methods: [ 'GET' ],
    test: ( path ) => path === '/communications/admin/provider-diagnostics',
    handle: ( request ) => handleProviderDiagnostics( request ),
  },
  {
    id: 'communications-admin-apply-migrations',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/admin/apply-migrations',
    handle: ( request ) => handleApplyCommunicationMigrations( request ),
  },
  {
    id: 'moderation-admin-apply-migrations',
    methods: [ 'POST' ],
    test: ( path ) => path === '/moderation/admin/apply-migrations',
    handle: ( request ) => handleApplyModerationMigrations( request ),
  },
  {
    id: 'admin-drivers-pending',
    methods: [ 'GET' ],
    test: ( path ) => path === '/admin/drivers/pending',
    handle: ( request ) => handleAdminListPendingDrivers( request ),
  },
  {
    id: 'admin-approve-driver',
    methods: [ 'POST' ],
    test: ( path ) => /^\/admin\/drivers\/[^/]+\/approve$/.test( path ),
    handle: ( request, path ) => handleAdminApproveDriver( request, decodeURIComponent( path.split( '/' )[ 3 ] ) ),
  },
  // ── Admin surfaces backing the web console ──────────────────────────────
  // These are session-authenticated (not worker-secret gated) and each one
  // asserts its own canonical permission inside the handler, so the RBAC
  // matrix in packages/rbac stays the single source of truth.
  {
    id: 'admin-users',
    methods: [ 'GET' ],
    test: ( path ) => path === '/admin/users',
    handle: ( request ) => handleAdminListUsers( request ),
  },
  {
    id: 'admin-user-status',
    methods: [ 'PATCH' ],
    test: ( path ) => /^\/admin\/users\/[^/]+\/status$/.test( path ),
    handle: ( request, path ) =>
      handleAdminSetUserStatus( request, decodeURIComponent( path.split( '/' )[ 3 ] ) ),
  },
  {
    id: 'admin-disputes',
    methods: [ 'GET' ],
    test: ( path ) => path === '/admin/disputes',
    handle: ( request ) => handleAdminListDisputes( request ),
  },
  {
    id: 'admin-dispute-resolve',
    methods: [ 'PATCH' ],
    test: ( path ) => /^\/admin\/disputes\/[^/]+\/resolve$/.test( path ),
    handle: ( request, path ) =>
      handleAdminResolveDispute( request, decodeURIComponent( path.split( '/' )[ 3 ] ) ),
  },
  {
    id: 'admin-dashboard-metrics',
    methods: [ 'GET' ],
    test: ( path ) => path === '/admin/dashboard/metrics',
    handle: ( request ) => handleAdminDashboardMetrics( request ),
  },
  {
    id: 'auth-hook-send-sms',
    methods: [ 'POST' ],
    test: ( path ) => path === '/auth/hooks/send-sms',
    handle: ( request ) => handleSendSmsHook( request ),
  },
  {
    id: 'payments-webhook-stripe',
    methods: [ 'POST' ],
    test: ( path ) => path === '/payments/webhooks/stripe',
    handle: ( request ) => handleStripeWebhook( request ),
  },
  {
    id: 'payments-webhook-cliq',
    methods: [ 'POST' ],
    test: ( path ) => path === '/payments/webhooks/cliq',
    handle: ( request ) => handleCliqWebhook( request ),
  },
  {
    id: 'trust-webhook-sanad',
    methods: [ 'POST' ],
    test: ( path ) => path === '/trust/webhooks/sanad',
    handle: ( request ) => handleSanadWebhook( request ),
  },
  {
    id: 'communications-webhook-resend',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/webhooks/resend',
    handle: ( request ) => handleResendWebhook( request ),
  },
  {
    id: 'payments-webhook-twilio',
    methods: [ 'POST' ],
    test: ( path ) => path === '/communications/webhooks/twilio',
    handle: ( request ) => handleTwilioWebhook( request ),
  },
  {
    id: 'payments-create-intent',
    methods: [ 'POST' ],
    test: ( path ) => path === '/payment/create-intent',
    handle: ( request ) => handlePaymentIntentCreate( request ),
  },
  {
    id: 'payments-create-refund',
    methods: [ 'POST' ],
    test: ( path ) => path === '/payment/refund',
    handle: ( request ) => handlePaymentRefund( request ),
  },
  {
    id: 'booking-payment-status',
    methods: [ 'GET' ],
    test: ( path ) => /^\/booking\/[^/]+\/payment-status$/.test( path ),
    handle: ( request, path ) => {
      const parts = path.split( '/' );
      return handleGetPaymentStatus( request, decodeURIComponent( parts[ 2 ] ) );
    },
  },
  {
    id: 'corporate-create-org',
    methods: [ 'POST' ],
    test: ( path ) => path === '/corporate/organizations',
    handle: ( request ) => handleCreateOrganization( request ),
  },
  {
    id: 'corporate-list-orgs',
    methods: [ 'GET' ],
    test: ( path ) => path === '/corporate/organizations',
    handle: ( request ) => handleListOrganizations( request ),
  },
  {
    id: 'corporate-get-org',
    methods: [ 'GET' ],
    test: ( path ) => /^\/corporate\/organizations\/[^/]+$/.test( path ),
    handle: ( request, path ) => handleGetOrganization( request, path ),
  },
  {
    id: 'corporate-add-member',
    methods: [ 'POST' ],
    test: ( path ) => /^\/corporate\/organizations\/[^/]+\/members$/.test( path ),
    handle: ( request, path ) => handleAddMember( request, path ),
  },
  {
    id: 'corporate-add-credits',
    methods: [ 'POST' ],
    test: ( path ) => /^\/corporate\/organizations\/[^/]+\/credits$/.test( path ),
    handle: ( request, path ) => handleAddCredits( request, path ),
  },
  {
    id: 'corporate-generate-invoice',
    methods: [ 'POST' ],
    test: ( path ) => path === '/corporate/invoices/generate',
    handle: ( request ) => handleGenerateInvoice( request ),
  },
  {
    id: 'corporate-get-invoices',
    methods: [ 'GET' ],
    test: ( path ) => /^\/corporate\/organizations\/[^/]+\/invoices$/.test( path ),
    handle: ( request, path ) => handleGetInvoices( request, path ),
  },
];

async function resolveRoute ( request: Request ): Promise<Response> {
  const url = new URL( request.url );
  let path = url.pathname.replace( /^.*make-server-0b1f4071/, '' ) || '/';

  if ( path.startsWith( '/v1' ) ) {
    path = path.slice( 3 ) || '/';
  }

  for ( const route of ROUTES ) {
    if ( route.methods && !route.methods.includes( request.method ) ) {continue;}
    if ( !route.test( path, request.method ) ) {continue;}

    const result = await route.handle( request, path );
    if ( result ) {return result;}
  }

  return json( { error: 'Route not found', path }, 404 );
}

Deno.serve( async ( request: Request ) => {
  let response: Response | undefined;

  if ( !isOriginAllowed( request ) ) {
    response = json( { error: 'Origin not allowed' }, 403 );
    return finalizeResponse( request, response );
  }

  if ( request.method === 'OPTIONS' ) {
    response = noContent();
    return finalizeResponse( request, response );
  }

  try {
    const url = new URL( request.url );
    const path = url.pathname.replace( /^.*make-server-0b1f4071/, '' ) || '/';

    const securityResponse = enforceRequestSecurity( request, path );
    if ( securityResponse ) {
      return finalizeResponse( request, securityResponse );
    }

    if ( request.method === 'GET' && path === '/health' ) {
      response = await handleHealth( request );
      return finalizeResponse( request, response );
    }

    response = await resolveRoute( request );
  } catch ( error ) {
    logUnhandledRouteError( error, request );
    response = sanitizedUnhandledErrorResponse();
  }

  return finalizeResponse( request, response ?? json( { error: 'Route not found' }, 404 ) );
} );
