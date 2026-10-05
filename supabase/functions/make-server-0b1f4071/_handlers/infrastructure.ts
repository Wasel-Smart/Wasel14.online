import {
    json,
    CLIQ_CHECKOUT_URL_TEMPLATE,
    RUNTIME_ADMIN_ENABLED,
    SERVICE_NAME,
    STRIPE_SECRET_KEY,
    STRIPE_WASEL_PLUS_PRICE_ID,
    STRIPE_WEBHOOK_SECRET,
    deliveryEnv,
    getWorkerSecret,
    hasTwilioVerifyRuntime,
    hasWorkerAccess,
} from './shared.ts';

import {
  buildPublicHealthPayload,
} from '../_shared/request-security.ts';


export function handleHealth ( request: Request ) {
  const publicPayload = buildPublicHealthPayload( SERVICE_NAME );

  const emailConfigured = Boolean( deliveryEnv.resendApiKey && deliveryEnv.resendFromEmail ) ||
    Boolean( deliveryEnv.sendgridApiKey && deliveryEnv.sendgridFromEmail );
  const twilioConfigured = Boolean(
    deliveryEnv.twilioAccountSid &&
    ( deliveryEnv.twilioAuthToken || ( deliveryEnv.twilioApiKeySid && deliveryEnv.twilioApiKeySecret ) ) &&
    ( deliveryEnv.twilioMessagingServiceSid || deliveryEnv.twilioSmsFrom || deliveryEnv.twilioWhatsappFrom ),
  );
  const sentryConfigured = Boolean( Deno.env.get( 'SENTRY_DSN' ) );
  const appInsightsConfigured = Boolean( Deno.env.get( 'APPLICATIONINSIGHTS_CONNECTION_STRING' ) );

  // Log missing provider configuration at startup so it is visible in Supabase
  // Function logs without requiring an authenticated health probe.
  if ( !emailConfigured ) {
    console.warn( '[health] Email provider not configured — set RESEND_API_KEY + RESEND_FROM_EMAIL or SENDGRID_API_KEY + SENDGRID_FROM_EMAIL in Vercel env vars' );
  }
  if ( !twilioConfigured ) {
    console.warn( '[health] Twilio not configured — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_MESSAGING_SERVICE_SID in Vercel env vars' );
  }
  if ( !sentryConfigured ) {
    console.warn( '[health] Sentry DSN not configured — set SENTRY_DSN in Vercel env vars to enable server-side error capture' );
  }
  if ( !appInsightsConfigured ) {
    console.warn( '[health] App Insights not configured — set APPLICATIONINSIGHTS_CONNECTION_STRING in Vercel env vars' );
  }

  if ( !RUNTIME_ADMIN_ENABLED || !hasWorkerAccess( request ) ) {
    return json( publicPayload );
  }

  return json( {
    ...publicPayload,
    runtimeAdminEnabled: true,
    twoFactor: {
      enabled: true,
      serverVerified: true,
    },
    communications: {
      resendConfigured: Boolean( deliveryEnv.resendApiKey && deliveryEnv.resendFromEmail ),
      sendgridConfigured: Boolean( deliveryEnv.sendgridApiKey && deliveryEnv.sendgridFromEmail ),
      emailConfigured,
      twilioConfigured,
      twilioVerifyConfigured: hasTwilioVerifyRuntime(),
      workerSecretConfigured: Boolean( getWorkerSecret() ),
      webhookTokenConfigured: Boolean( deliveryEnv.communicationWebhookToken ),
    },
    payments: {
      stripeConfigured: Boolean( STRIPE_SECRET_KEY ),
      stripeWebhookConfigured: Boolean( STRIPE_WEBHOOK_SECRET ),
      cliqConfigured: Boolean( CLIQ_CHECKOUT_URL_TEMPLATE ),
      waselPlusPriceConfigured: Boolean( STRIPE_WASEL_PLUS_PRICE_ID ),
    },
    observability: {
      sentryConfigured,
      appInsightsConfigured,
    },
  } );
}
