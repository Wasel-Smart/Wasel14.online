/**
 * Webhooks function — verify_jwt = false
 *
 * Serves all inbound provider callbacks: Stripe, CliQ, Sanad, Resend, Twilio,
 * and the Supabase Send-SMS auth hook. None of these callers send a Supabase
 * JWT, so this function runs without JWT verification. Every handler verifies
 * its own provider signature before touching any data.
 *
 * Routes:
 *   POST /payments/webhooks/stripe
 *   POST /payments/webhooks/cliq
 *   POST /trust/webhooks/sanad
 *   POST /communications/webhooks/resend
 *   POST /communications/webhooks/twilio
 *   POST /auth/hooks/send-sms
 */

import {
    json,
    finalizeResponse,
    sanitizedUnhandledErrorResponse,
    logUnhandledRouteError,
} from './_vendor/supabase/functions/make-server-0b1f4071/_handlers/shared.ts';

import {
  handleStripeWebhook,
  handleCliqWebhook,
  handleSanadWebhook,
  handleResendWebhook,
  handleTwilioWebhook,
  handleSendSmsHook,
} from './_vendor/supabase/functions/make-server-0b1f4071/_handlers/webhooks.ts';

Deno.serve(async (request: Request) => {
  // Webhook callers (Stripe, Twilio, etc.) send from their own origins, not
  // from the Wasel app origin. Skip the origin allow-list for this function.
  // Each handler enforces its own provider signature check instead.

  if (request.method === 'OPTIONS') {
    return finalizeResponse(request, new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  // Strip the function prefix so paths match the same patterns as in the main function.
  const path = url.pathname.replace(/^.*\/webhooks/, '') || '/';

  try {
    if (request.method === 'POST') {
      if (path === '/payments/webhooks/stripe') {return await handleStripeWebhook(request);}
      if (path === '/payments/webhooks/cliq')   {return await handleCliqWebhook(request);}
      if (path === '/trust/webhooks/sanad')      {return await handleSanadWebhook(request);}
      if (path === '/communications/webhooks/resend') {return await handleResendWebhook(request);}
      if (path === '/communications/webhooks/twilio') {return await handleTwilioWebhook(request);}
      if (path === '/auth/hooks/send-sms')       {return await handleSendSmsHook(request);}
    }

    return json({ error: 'Route not found', path }, 404);
  } catch (error) {
    logUnhandledRouteError(error, request);
    return sanitizedUnhandledErrorResponse();
  }
});
