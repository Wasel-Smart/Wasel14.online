# Security & Secrets Management

## Credential Rotation Status - Not Verified

**Do not treat provider credentials as rotated.** The local audit inspected variable names only; it did not print values or access provider secret stores. The current working tree contains ignored local environment files, and Git history contains prior entries for docs/wasel-planning-with-ai.json. Confirm provider-side revocation before production use. The older OneDrive path warning was stale for this checkout; confirm device backup settings separately.

Local variable names requiring immediate provider-side review:

| Local source | Variable names or evidence | Required action |
|---|---|---|
| .env | SUPABASE_AUTH_GOOGLE_CLIENT_SECRET, SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET | Rotate at Google and Meta, update Supabase Auth provider settings, and test sign-in. |
| .env.local | VERCEL_OIDC_TOKEN, AI_GATEWAY_API_KEY | Confirm source and lifetime; rotate active credentials and update deployment consumers. |
| .env.production | VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_GOOGLE_MAPS_API_KEY | Migrate from the legacy anon key and confirm Maps API restrictions. These client keys are public by design. |
| Process environment | NPM_TOKEN, OPENAI_API_KEY | Identify owners and scope; rotate if active and avoid inheriting these into unrelated build jobs. |
| Git history | docs/wasel-planning-with-ai.json | Revoke the historical Google service-account key, then coordinate history cleanup. |

Remote stores including Vercel, Supabase, Google Cloud, Meta, Stripe, Twilio, CliQ, Resend, SendGrid, AWS, Sentry, database, and Redis were not inspected. Their status is unknown. See docs/CREDENTIAL_ROTATION_RUNBOOK.md and run npm run credentials:inventory; the inventory command never prints values.

The 2026-11-09 Google Cloud access check found two active, non-expiring user-managed keys on the historical `fb-service-account` in project `wasel-planning-with-ai`. The authenticated account has Viewer access only, so neither key was revoked. Complete revocation with a Google Cloud IAM administrator or an operator granted `roles/iam.serviceAccountKeyAdmin`; details and safe follow-up steps are in the runbook. Credential rotation remains unverified.

## Browser Session and XSS Boundary

The browser client in `src/utils/supabase/client.ts` persists the Supabase session in a browser cookie through `@supabase/ssr`'s browser client. JavaScript can access this client-managed session; it is not an `HttpOnly` server-issued session. `HttpOnly` cannot be applied by browser JavaScript. The production CSP in `vercel.json` restricts script sources and omits `unsafe-inline`/`unsafe-eval` from `script-src`; React escapes normal text rendering, and JSON-LD passes through an escaping serializer. Search before adding any HTML sink, and sanitize any unavoidable untrusted HTML. Moving the session to an `HttpOnly` cookie requires a server-side auth/BFF flow that owns cookie creation and refresh; this repository currently has no such flow, so that architectural risk remains open.

## Required Environment Variables

Before running the app locally or deploying to production, ensure these variables are set.

### Always required
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Payments (at least one provider)
- `STRIPE_SECRET_KEY` — Stripe secret key (sk_...)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook endpoint secret (whsec_...)
- `STRIPE_API_VERSION` — defaults to `2024-11-20` if unset

### CliQ (Jordan)
- `CLIQ_API_BASE_URL`
- `CLIQ_MERCHANT_ID`
- `CLIQ_API_KEY`
- `CLIQ_WEBHOOK_SECRET` — must be set in Supabase secrets for webhook verification

### Communications
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SENDER_ID`

### Observability
- `VITE_SENTRY_DSN` — optional but recommended in production

## Running Validation

```bash
# Check all env vars (Node.js only)
node scripts/validate-env.mjs
```

## Supabase Edge Function Secrets

Use the Supabase CLI to set secrets that edge functions need:

```bash
supabase secrets set STRIPE_SECRET_KEY="<your-stripe-secret-key>"
supabase secrets set STRIPE_WEBHOOK_SECRET="<your-stripe-webhook-secret>"
supabase secrets set CLIQ_WEBHOOK_SECRET="<your-cliq-webhook-secret>"
supabase secrets set CLIQ_API_KEY="<your-cliq-api-key>"
supabase secrets set CLIQ_MERCHANT_ID="<your-cliq-merchant-id>"
```

## Pre-Deployment Checklist

1. [ ] Run `npm run verify:ci` locally
2. [ ] Apply pending Supabase migrations (`supabase db push`)
3. [ ] Set all required secrets in Supabase (`supabase secrets set ...`)
4. [ ] Verify Stripe webhook points to the dedicated `webhooks` function at `/payments/webhooks/stripe`
5. [ ] Verify `.env.local` is not being cloud-synced
6. [ ] Confirm `CLIQ_WEBHOOK_SECRET` is set and matches CliQ dashboard
7. [ ] Confirm `VITE_ALLOW_DIRECT_SUPABASE_FALLBACK=false` in production
8. [ ] Confirm `verify_jwt = true` in `supabase/config.toml`
9. [ ] Run `bash src/platform/validate-10-out-of-10.sh`

## Credential Rotation Guide

Follow [the credential rotation runbook](docs/CREDENTIAL_ROTATION_RUNBOOK.md). Provider-side replacement and revocation must be confirmed before this document is marked complete.

Run npm run credentials:inventory to list variable names only. Run npm run secrets:check and npm run env:check after updating approved secret stores.
