# Wasel Production Operations Checklist

**Purpose:** Step-by-step gate every production deployment and confirm the platform is fully operational.  
**Owner:** On-call engineer  
**Last updated:** 2026-10

---

## Pre-Deployment Gate (run before every production push)

```bash
# 1. Full CI verification
npm run verify:ci

# 2. Production pre-flight (env vars, security flags, edge config)
npm run preflight:strict

# 3. Live integration probes (Supabase, edge function, Stripe, Sentry, App Insights)
npm run verify:live-integrations

# 4. Build
npm run build

# 5. Deploy edge functions first (backend before frontend)
npm run edge:deploy

# Or run everything in one gated command:
npm run deploy:production
```

---

## Credential Rotation Status

All items below must be ✅ before go-live. See `SECURITY_CHECKLIST.md` for provider links.

| Credential | Status | Action |
|---|---|---|
| Stripe secret key | ❌ | Rotate at dashboard.stripe.com/apikeys |
| Stripe webhook secret | ❌ | Rotate at dashboard.stripe.com/webhooks |
| Twilio auth token | ❌ | Rotate at console.twilio.com |
| Resend API key | ❌ | Rotate at resend.com/api-keys |
| SendGrid API key | ❌ | Rotate at app.sendgrid.com/settings/api_keys |
| Supabase service role key | ❌ | Rotate at Supabase Dashboard → Settings → API |
| Google OAuth client secret | ❌ | Reset at console.cloud.google.com/apis/credentials |
| Facebook OAuth app secret | ❌ | Reset at developers.facebook.com |
| COMMUNICATION_WORKER_SECRET | ❌ | `openssl rand -hex 32` → set in Vercel + Supabase secrets |
| COMMUNICATION_WEBHOOK_TOKEN | ❌ | `openssl rand -hex 32` → set in Vercel + Supabase secrets |
| Vercel OIDC token | ❌ | Revoke at vercel.com/account/tokens |
| Google service account key | ❌ | Delete key in Cloud Console + `git filter-repo` to purge history |

---

## Vercel Environment Variables (must be set before deploy)

Go to: **Vercel Dashboard → Project → Settings → Environment Variables**

### Required (deployment fails without these)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_EDGE_FUNCTION_NAME=make-server-0b1f4071
VITE_APP_URL=https://www.wasel14.online
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_SENTRY_DSN=https://...@....ingest.sentry.io/...
VITE_APP_INSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

### Server-only (never VITE_ prefixed)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...
COMMUNICATION_WORKER_SECRET=<64-char hex>
COMMUNICATION_WEBHOOK_TOKEN=<64-char hex>
RESEND_API_KEY=re_live_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
CLIQ_API_KEY=...
CLIQ_WEBHOOK_SECRET=...
SANAD_CLIENT_SECRET=...
SANAD_WEBHOOK_SECRET=...
```

### Supabase Edge Function Secrets
Go to: **Supabase Dashboard → Project → Edge Functions → Secrets**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL=Wasel <notifications@wasel14.online>
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID
COMMUNICATION_WORKER_SECRET
SUPABASE_SERVICE_ROLE_KEY
CLIQ_API_KEY
CLIQ_WEBHOOK_SECRET
SANAD_CLIENT_SECRET
SANAD_WEBHOOK_SECRET
```

---

## Webhook Endpoint Verification

### Stripe
1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Endpoint must be: `https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071/payments/webhooks/stripe`
3. Send test event: `payment_intent.succeeded` → must return 200
4. If still pointing to `stripe-payments-v2/webhook` → update it (that endpoint returns 410)

### Twilio
- Status callback URL: `https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071/communications/webhooks/twilio?token=<COMMUNICATION_WEBHOOK_TOKEN>`

### Resend
- Webhook URL: `https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071/communications/webhooks/resend?token=<COMMUNICATION_WEBHOOK_TOKEN>`

---

## Post-Deployment Verification

```bash
# 1. Health check
curl https://zexlxabdcsjefptmjhuq.supabase.co/functions/v1/make-server-0b1f4071/health

# Expected response:
# { "status": "ok", "broker": { "outboxPending": 0, "deadLetterCount": 0 }, ... }

# 2. Verify Stripe webhook
stripe trigger checkout.session.completed
# Must return 200 (not 401)

# 3. Verify canonical URL redirects
curl -I https://wasel14.online
# Must redirect to https://www.wasel14.online (301/302)

# 4. Verify Sentry is receiving events
# Go to sentry.io → Your project → Issues → Production
# Should see events within minutes of first user session

# 5. Verify App Insights
# Go to Azure Portal → Application Insights → Live Metrics
# Should show active sessions after first page load
```

---

## Git History Hygiene (one-time, required before public repo)

```bash
# Check if .env files were ever committed
git log --all --full-history -- .env
git log --all --full-history -- .env.local
git log --all --full-history -- .env.production

# If any commits appear, purge with git-filter-repo:
pip install git-filter-repo
git filter-repo --invert-paths --path .env --path .env.local --path .env.production

# Verify the Google service account key is gone from history:
git log --all --full-history -- docs/wasel-planning-with-ai.json
# Should return nothing

# Force push after history rewrite (coordinate with team):
git push --force-with-lease origin main

# Enable GitHub secret scanning + push protection:
# GitHub → Settings → Security → Secret scanning → Enable
# GitHub → Settings → Security → Push protection → Enable
```

---

## Observability Activation Checklist

- [ ] `VITE_SENTRY_DSN` set in Vercel → Sentry receives production errors
- [ ] `VITE_APP_INSIGHTS_CONNECTION_STRING` set in Vercel → Azure metrics active
- [ ] `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` set (optional) → distributed tracing export
- [ ] Grafana dashboard imported from `.github/workflows/grafana-dashboard-wasel-overview.json`
- [ ] Alert thresholds configured per `docs/observability.md`
- [ ] DLQ depth alert: notify when `broker.deadLetterCount > 10`
- [ ] Uptime monitor on `GET /v1/health` (60s interval)

---

## Canonical URL Fix

The apex domain (`wasel14.online`) and www (`www.wasel14.online`) must redirect to one canonical host.

Current state: `VITE_APP_URL=https://www.wasel14.online` (www is canonical).

In Vercel → Project → Settings → Domains:
- Add `wasel14.online` → set redirect to `www.wasel14.online` (301)
- Primary domain: `www.wasel14.online`

In Supabase → Authentication → URL Configuration:
- Site URL: `https://www.wasel14.online`
- Redirect URLs: `https://www.wasel14.online/app/auth/callback`

---

## OneDrive Sync — Move Secrets Outside Sync Tree

Real `.env` files must not live inside an OneDrive-synced folder.

```powershell
# Create external secrets directory
mkdir $env:USERPROFILE\.wasel-secrets

# Move real env files there
Move-Item C:\Users\user\Wasel14.online\.env.local $env:USERPROFILE\.wasel-secrets\
Move-Item C:\Users\user\Wasel14.online\.env.production $env:USERPROFILE\.wasel-secrets\

# Set WASEL_ENV_DIR so Vite loads from there
$env:WASEL_ENV_DIR = "$env:USERPROFILE\.wasel-secrets"

# Add to Windows environment permanently
[System.Environment]::SetEnvironmentVariable('WASEL_ENV_DIR', "$env:USERPROFILE\.wasel-secrets", 'User')
```

---

## SLO Targets (from `docs/reliability-slos.md`)

| Service | Availability | Latency |
|---|---|---|
| API gateway | 99.9% | p95 < 250ms |
| Identity | 99.95% | p95 < 200ms |
| Ride matching | 99.9% | p95 < 700ms |
| Package delivery | 99.9% | p95 < 400ms, freshness < 5s |
| Payment service | 99.95% | p95 < 350ms |
| Notification worker | 99.9% | freshness < 2s |

Alert when error budget burn rate > 2× for 2 consecutive hours.
