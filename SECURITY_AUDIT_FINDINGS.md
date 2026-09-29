# Wasel — Phase 4 audit findings (partial, read-only)

Scope actually reviewed (files read in full): `src/utils/supabase/client.ts`, `info.tsx`,
`src/utils/session.ts`, `src/services/storage.ts`, `src/utils/stripe.ts`,
`api/auth/callback.ts`, `supabase/config.toml`, `supabase/functions/deno.json`,
`supabase/functions/make-server-0b1f4071/index.ts`, `_handlers/webhooks.ts`,
`_handlers/payments.ts`, plus `vercel.json`, CI workflows and env templates.

NOT reviewed yet: `_handlers/shared.ts` (92 KB), `wallet.ts`, `admin.ts`, `identity.ts`,
`gdpr.ts`, the other edge functions, `supabase/migrations/*` (RLS), `mobile/src/*`,
`src/pages`/`components` (XSS sinks), `@google/genai` usage.
No code was executed. Nothing here is a verified exploit; "verify" means confirm in your
deployed environment.

## A. Blockers

**A1. The main API edge function looks like an unfinished refactor.**
`scripts/full-refactor.js` (now in `_CLEANUP_REVIEW_DELETE_ME/scripts/`) split the old
monolithic `make-server-0b1f4071/index.ts` into `_handlers/*.ts`. As the files stand:
- `index.ts` imports `handleStripeWebhook, handleCliqWebhook, handleSanadWebhook,
  handleResendWebhook, handleTwilioWebhook` from `webhooks.ts`, but `webhooks.ts` only
  exports `handleSendSmsHook`. A missing named export is a module-link error, so the
  function would fail to start.
- `index.ts` also calls `handleProfileRequest`, `handleTripRequest`, `handleHealth`,
  `handlePaymentIntentCreate`, etc. that it never imports; the `import './_handlers/x.ts'`
  lines are side-effect imports only.
- `webhooks.ts` and `payments.ts` use `stripe`, `Stripe`, `STRIPE_WEBHOOK_SECRET`,
  `CLIQ_WEBHOOK_SECRET`, `verifyStripeWebhookSignature`, `normalizePaymentAmount`,
  `ALLOWED_PAYMENT_CURRENCIES`, `finalizeTopUpTransaction`... without importing them.
- A copy of `webhooks.ts` in `.kilo/worktrees/laced-shell` has the identical byte size
  (15,318 B), so the committed code probably has the same shape.
Verify: what version is actually deployed, and does `deno check
supabase/functions/make-server-0b1f4071/index.ts` pass? If not, either finish the split
(export every handler, import every symbol) or restore the last working monolith from git
history. Add a `deno check` step to CI so this cannot ship silently.

**A2. `verify_jwt = true` on the function that hosts the webhooks.**
`supabase/config.toml` sets `[functions.make-server-0b1f4071] verify_jwt = true`, but the
same function serves Stripe, CliQ, Sanad, Resend and Twilio webhooks and the Supabase
Send-SMS auth hook. Those callers do not send a Supabase JWT, so the gateway would return
401 before your signature checks run. Verify in the dashboard (Edge Functions ->
make-server-0b1f4071 -> Verify JWT) and test with `stripe trigger checkout.session.completed`.
If you need JWT verification for user routes, move webhooks to their own function with
`verify_jwt = false`.

## B. High

**B1. `/payment/refund` has no ownership or business-rule check** (`payments.ts`).
Any signed-in user can pass any `payment_intent_id` and an arbitrary `amount`. A user could
top up the wallet by card, receive the wallet credit via webhook, then refund the card
payment and keep the balance. Require an admin permission (or server-side ownership plus
eligibility rules), never accept `amount` from the client, and record refunds in the ledger.
(The earlier open question "is there a refund path?" is answered: yes, here.)

**B2. Open redirect in `api/auth/callback.ts`.** `safeReturnTo` blocks `//` but not
`/\evil.example`, which browsers normalize to `//evil.example`. Fix: reject any backslash or
control character, or build `new URL(value, origin)` and require `url.origin === origin`.

**B3. `/payment/create-intent` trusts client input.** `customer_id`, `metadata` and
`idempotency_key` come from the request. A caller can set `metadata.transaction_id` to
someone else's top-up id, and `payment_intent.payment_failed` then marks that transaction
failed. Derive the customer server-side, whitelist metadata keys, and namespace idempotency
keys with the user id.

**B4. Anonymous sign-ins and Web3 logins enabled** (`config.toml`:
`enable_anonymous_sign_ins = true`, `[auth.web3.solana]` and `[auth.web3.ethereum]`
enabled). Anonymous users get the `authenticated` role, so any RLS policy written as
"authenticated" admits them. Turn these off in the dashboard unless a feature needs them.

## C. Medium

- **Send-SMS hook verification.** `handleSendSmsHook` checks `Authorization: Bearer <secret>`.
  Supabase HTTPS auth hooks are documented as signed with Standard Webhooks headers, so
  this may reject real calls. Verify phone OTP end to end.
- **Webhook auth for Resend/Twilio** is a token in the URL query string (leaks into logs).
  Use Svix signature verification for Resend and `X-Twilio-Signature` for Twilio.
- **Stripe webhook idempotency and replay:** confirm `finalizeTopUpTransaction` dedupes on
  `event.id` and that `verifyStripeWebhookSignature` enforces a timestamp tolerance.
- **Session cookie is JS-readable** (`@supabase/ssr` browser client needs it). That misses
  the "httpOnly preferred" line in `ENGINEERING_STANDARDS.md`; the strict CSP is the
  mitigation. Set `secure: true` and `sameSite: 'lax'` explicitly in `cookieOptions`.
- **Error text reflected from the URL:** `/api/auth/callback?error_description=...` is
  passed to `/app/auth?error=...`. Show a fixed message per known code instead, to prevent
  phishing text injection (and confirm the page renders it as text, not HTML).
- **`optimizedQuery`** (`src/utils/supabase/client.ts`) caches results in `sessionStorage`
  under `qc-<key>` (not scoped per user, not cleared on sign-out visible here), retries
  5xx/network errors up to 3 times, and replays queued calls after coming back online.
  Fine for reads; dangerous for payments or bookings. Verify no mutation uses it.
- **Two payment implementations** exist (`make-server` payment handlers and
  `stripe-payments-v2`). Keep one authoritative path.
- **API-exposed schemas:** `config.toml` exposes `stripe` and `pgmq_public`. Confirm `anon`
  and `authenticated` have no grants there.
- **Auth policy:** `minimum_password_length = 7`; use at least 8. TOTP `enroll_enabled =
  false` locally while the app advertises 2FA; check the production dashboard.
- **Apex vs www:** Supabase `site_url` is `https://www.wasel14.online`, `VITE_APP_URL` is
  `https://wasel14.online`. Pick one canonical host and redirect the other.
- **Auth redirect allow-list in the dashboard** should contain only production URLs plus
  `/api/auth/callback`; `config.toml` lists many localhost entries (local stack only).

## D. Low / hygiene

- `.kilo/worktrees/dedicated-mitten` and `laced-shell` are full copies of the repo inside
  the project (and inside OneDrive). They may hold their own `.env` copies. Remove them with
  `git worktree remove` after checking for unpushed work.
- `mobile/node_modules` contains half-renamed npm temp folders (`.entities-xxxx`), i.e. an
  interrupted install inside OneDrive. Reinstall outside OneDrive.
- `src/utils/stripe.ts` `checkRateLimit` is an in-memory client-side limiter; it is not a
  security control.
- `src/services/tokens.ts` holds design tokens, not auth tokens; consider renaming.
- Error responses return raw Stripe/DB messages (`error.message`) to callers.

## E. Good practice already in place

PKCE flow; publishable key only in the browser; checked-in Supabase fallback disabled and
placeholder detection; cryptographic session ids; Origin allow-list and request-security
middleware in the edge function; HMAC verification with timestamps for CliQ/Sanad;
constant-time compare for the hook secret; strict CSP (no script `unsafe-inline`);
refresh-token rotation enabled; gitleaks and TruffleHog in CI.

## Suggested next steps (in order)

1. Resolve A1 and A2 (they decide whether the API works at all).
2. Fix B1-B3 (money and redirect issues), then B4 in the dashboard.
3. Continue the audit: `shared.ts` (CORS, auth helpers), `wallet.ts`, RLS migrations,
   `mobile/src` token storage, and the `@google/genai` usage.
