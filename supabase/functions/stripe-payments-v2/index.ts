
// Same convention as every other edge function here: esm.sh, no exact-version
// pin. `npm:stripe@12.12.0` could not resolve against the local node_modules
// tree (stripe is not a root dependency), leaving this entry point unlinkable.
import Stripe from "https://esm.sh/stripe@12.12.0";
// Matches every other edge function. The previous `npm:@supabase/supabase-js@2.36.0`
// pinned an exact version that resolves against neither the local node_modules
// tree nor the deno.json import map, so `deno check` failed to link this entry
// point. The broken import was invisible because check-edge-types.mjs counted
// only framed diagnostics and reported success on a non-zero exit.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRateLimitMiddleware } from "./_shared/rate-limiter.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ??
  Deno.env.get("PUBLIC_SITE_URL") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://wasel14.online,https://www.wasel14.online")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!STRIPE_SECRET) {throw new Error("Missing STRIPE_SECRET_KEY");}
// Supabase is required for authenticating checkout requests. Payment intents are
// created only by the canonical booking and wallet flows, which persist their
// business references before returning client secrets.

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-11-20" });
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
const paymentRateLimit = createRateLimitMiddleware(
  { windowMs: 60_000, maxRequests: 30 },
);
const WASEL_PLUS_PRICE_ID = Deno.env.get('STRIPE_WASEL_PLUS_PRICE_ID') ?? '';

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }
  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  init: ResponseInit = {},
  request?: Request,
): Response {
  const corsHeaders = request ? getCorsHeaders(request) : {};
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function isAllowedRedirectUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {return false;}

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {return false;}
    // Redirect URLs are a security boundary. Missing configuration must never
    // widen the policy to every HTTPS site.
    if (!APP_ORIGIN) {return false;}
    return url.origin === new URL(APP_ORIGIN).origin;
  } catch {
    return false;
  }
}

async function requireAuthenticatedUser(
  req: Request,
): Promise<{ id: string } | Response> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {return jsonResponse({ error: "Unauthorized" }, { status: 401 });}

  if (!supabase) {
    return jsonResponse(
      { error: "Authentication service unavailable" },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return jsonResponse({ error: "Invalid auth token" }, { status: 401 });
  }

  return { id: user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, x-supabase-client, x-supabase-session",
      "Access-Control-Max-Age": "86400",
    };

    if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Vary"] = "Origin";
    }

    return new Response(null, { status: 204, headers });
  }

  const rateLimitResponse = paymentRateLimit(req);
  if (rateLimitResponse) {return rateLimitResponse;}

  try {
    const url = new URL(req.url);
    const pathname = url.pathname.replace(/\/+$/, "");

    if ((pathname.endsWith("/create-payment-intent") || pathname.endsWith("/stripe-payments-v2")) && req.method === "POST") {
      // This legacy endpoint created chargeable intents without the durable
      // transaction_id or booking binding required by the canonical webhook.
      // Do not accept money until it can be tied to a payable business record.
      return jsonResponse(
        { error: "This payment endpoint is retired. Create payment intents through the canonical booking or wallet checkout flow." },
        { status: 410 },
        req,
      );
    }

    if (
      pathname.endsWith("/create-checkout-session") && req.method === "POST"
    ) {
      const auth = await requireAuthenticatedUser(req);
      if (auth instanceof Response) {return auth;}

      const body = await req.json() as {
        price_id?: unknown;
        quantity?: unknown;
        mode?: string;
        success_url?: unknown;
        cancel_url?: unknown;
        customer_email?: string;
      };
      const {
        price_id,
        quantity,
        mode = "payment",
        success_url,
        cancel_url,
        customer_email,
      } = body;
      const normalizedQuantity =
        typeof quantity === 'number' && Number.isInteger(quantity) ? quantity : null;
      if (
        typeof price_id !== 'string' ||
        !WASEL_PLUS_PRICE_ID ||
        price_id !== WASEL_PLUS_PRICE_ID ||
        normalizedQuantity === null || normalizedQuantity < 1 || normalizedQuantity > 12
      ) {
        return jsonResponse({ error: "Invalid checkout item" }, { status: 400 });
      }
      if (
        !isAllowedRedirectUrl(success_url) || !isAllowedRedirectUrl(cancel_url)
      ) {
        return jsonResponse({ error: "Invalid redirect URL" }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        // The price is selected from a server-side allowlist. Never forward
        // client-provided Stripe price_data or arbitrary line items.
        line_items: [{ price: WASEL_PLUS_PRICE_ID, quantity: normalizedQuantity }],
        mode: mode === 'subscription' ? 'subscription' : 'payment',
        success_url,
        cancel_url,
        customer_email,
      });

      return jsonResponse({ session_id: session.id, url: session.url });
    }

    if (pathname.endsWith("/webhook") && req.method === "POST") {
      // Stripe webhooks are handled exclusively by the canonical
      // make-server-0b1f4071 function at /payments/webhooks/stripe.
      // This endpoint is intentionally disabled to prevent split processing.
      // Point your Stripe webhook destination to:
      //   https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071/payments/webhooks/stripe
      return jsonResponse(
        { error: "Webhook endpoint moved. Configure Stripe to call /payments/webhooks/stripe on make-server-0b1f4071." },
        { status: 410 },
        req,
      );
    }

    return jsonResponse(
      {
        status: "ok",
        routes: [
          "/create-checkout-session",
        ],
        webhookNote: "Stripe webhooks must be sent to make-server-0b1f4071/payments/webhooks/stripe",
      },
    );
  } catch {
    return jsonResponse({ error: "Payment request failed" }, { status: 500 });
  }
});
