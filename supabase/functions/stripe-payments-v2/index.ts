/**
 * Retired compatibility endpoint.
 *
 * All Stripe payment-intent, refund, and webhook workflows are owned by
 * make-server-0b1f4071. Keep this function deployed temporarily so old clients
 * receive a clear migration response instead of running a second payment stack.
 */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://wasel14.online,https://www.wasel14.online')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function responseHeaders(request: Request): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

Deno.serve((request: Request) => {
  const headers = responseHeaders(request);
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
    return new Response(null, { status: 204, headers });
  }

  return new Response(JSON.stringify({
    error: 'This Stripe endpoint has been retired.',
    code: 'PAYMENT_ENDPOINT_RETIRED',
    canonicalEndpoint: '/functions/v1/make-server-0b1f4071/payments',
  }), { status: 410, headers });
});
