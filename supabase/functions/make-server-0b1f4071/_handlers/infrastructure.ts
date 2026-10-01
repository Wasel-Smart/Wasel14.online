import {
    json,
} from './shared.ts';

import {
  buildPublicHealthPayload,
} from '../_shared/request-security.ts';

import {
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


export async function handleHealth ( request: Request ) {
  const publicPayload = buildPublicHealthPayload( SERVICE_NAME );

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
      twilioConfigured: Boolean(
        deliveryEnv.twilioAccountSid &&
        ( deliveryEnv.twilioAuthToken ||
          ( deliveryEnv.twilioApiKeySid && deliveryEnv.twilioApiKeySecret ) ) &&
        ( deliveryEnv.twilioMessagingServiceSid || deliveryEnv.twilioSmsFrom || deliveryEnv.twilioWhatsappFrom ),
      ),
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
  } );
}
