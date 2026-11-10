# Wasel Credential Rotation Runbook

**Purpose:** Exact steps to rotate every live credential used by Wasel.  
**When to use:** After any suspected exposure, before go-live, or on the quarterly rotation schedule.  
**Time required:** ~45 minutes end-to-end if you have access to all provider dashboards.

> After rotating each credential, update the corresponding value in:
> 1. `~/.wasel-secrets/.env.production` (your offsite secrets file)
> 2. Vercel Dashboard → Project → Settings → Environment Variables
> 3. Supabase Dashboard → Project → Edge Functions → Secrets (for server-side vars)

---

## Pre-rotation checklist

- [ ] You have access to all provider dashboards listed below
- [ ] You have run `powershell -ExecutionPolicy Bypass -File scripts\move-env-offsite.ps1` and confirmed `.env` files are out of OneDrive
- [ ] You have a password manager open to store new secrets immediately
- [ ] You are NOT on a shared/public network

---

## 1. Stripe

**Dashboard:** https://dashboard.stripe.com/apikeys

### 1a. Secret key (`STRIPE_SECRET_KEY`)
1. Go to **Developers → API Keys**
2. Click **Roll key** next to the Secret key
3. Confirm the roll — the old key is immediately invalidated
4. Copy the new `sk_live_...` value
5. Set in Vercel: `STRIPE_SECRET_KEY=sk_live_...`
6. Set in Supabase Edge Function Secrets: `STRIPE_SECRET_KEY=sk_live_...`

### 1b. Webhook signing secret (`STRIPE_WEBHOOK_SECRET`)
1. Go to **Developers → Webhooks**
2. Click your webhook endpoint (pointing to `make-server-0b1f4071`)
3. Click **Reveal** next to Signing secret, then **Roll secret**
4. Copy the new `whsec_...` value
5. Set in Vercel: `STRIPE_WEBHOOK_SECRET=whsec_...`
6. Set in Supabase Edge Function Secrets: `STRIPE_WEBHOOK_SECRET=whsec_...`

### 1c. Publishable key (`VITE_STRIPE_PUBLISHABLE_KEY`)
> Publishable keys are browser-safe but should still be rotated if exposed.
1. Go to **Developers → API Keys**
2. Click **Roll key** next to the Publishable key
3. Copy the new `pk_live_...` value
4. Set in Vercel: `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
5. Trigger a Vercel redeploy (VITE_ vars are inlined at build time)

### 1d. Verify
```
curl -s https://www.wasel14.online/v1/health | jq '.data.payments'
# Should return: { "configured": true }
```

---

## 2. Twilio

**Dashboard:** https://console.twilio.com

### 2a. Auth Token (`TWILIO_AUTH_TOKEN`)
1. Go to **Account → General Settings → Auth Token**
2. Click **Rotate** (the secondary token becomes primary; old primary is invalidated after 24h)
3. Copy the new auth token
4. Set in Vercel: `TWILIO_AUTH_TOKEN=...`
5. Set in Supabase Edge Function Secrets: `TWILIO_AUTH_TOKEN=...`

### 2b. API Keys (if used)
1. Go to **Account → API Keys & Tokens**
2. Delete the exposed key
3. Click **Create API Key** → Standard
4. Copy the SID and Secret immediately (Secret shown only once)
5. Update any references in your edge functions

### 2c. Verify
```
node scripts/verify-twilio-config.mjs
```

---

## 3. Resend

**Dashboard:** https://resend.com/api-keys

### 3a. API Key (`RESEND_API_KEY`)
1. Click the **...** menu next to the exposed key → **Delete**
2. Click **Create API Key**
3. Name it `wasel-production`, set permission to **Sending access**
4. Copy the new `re_live_...` value (shown only once)
5. Set in Vercel: `RESEND_API_KEY=re_live_...`
6. Set in Supabase Edge Function Secrets: `RESEND_API_KEY=re_live_...`

### 3b. Verify
Send a test notification via the health endpoint:
```
curl -X POST https://www.wasel14.online/v1/notifications/test \
  -H "Authorization: Bearer <your-jwt>"
```

---

## 4. Supabase

**Dashboard:** https://supabase.com/dashboard/project/zexlxabdcsjefptmjhuq/settings/api

### 4a. Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)
1. Go to **Settings → API**
2. Under **Project API keys**, click **Reveal** next to `service_role`
3. Click **Generate new key** (this immediately invalidates the old one)
4. Copy the new key
5. Set in Vercel: `SUPABASE_SERVICE_ROLE_KEY=...` (server-only, never VITE_)
6. Set in Supabase Edge Function Secrets: `SUPABASE_SERVICE_ROLE_KEY=...`

### 4b. JWT Secret (`SUPABASE_JWT_SECRET`)
> Only rotate if you suspect the JWT secret is compromised — this invalidates ALL existing sessions.
1. Go to **Settings → API → JWT Settings**
2. Click **Generate new secret**
3. Update `SUPABASE_JWT_SECRET` in Vercel and Edge Function Secrets
4. All users will be signed out and must re-authenticate

### 4c. Publishable (anon) key (`VITE_SUPABASE_PUBLISHABLE_KEY`)
1. Go to **Settings → API**
2. Under **Project API keys**, click **Reveal** next to `anon/public`
3. Click **Generate new key**
4. Set in Vercel: `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
5. Trigger a Vercel redeploy

---

## 5. Google OAuth

**Dashboard:** https://console.cloud.google.com/apis/credentials

### 5a. Client Secret (`SUPABASE_AUTH_GOOGLE_CLIENT_SECRET`)
1. Click the OAuth 2.0 Client ID used by Wasel
2. Click **Reset Secret**
3. Copy the new client secret
4. Go to **Supabase Dashboard → Authentication → Providers → Google**
5. Paste the new secret into **Client Secret** → Save
6. Set in Vercel: `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET=...`

### 5b. Verify
Test Google sign-in at https://www.wasel14.online/app/auth — the OAuth flow must complete without `redirect_uri_mismatch` or `invalid_client` errors.

---

## 6. Facebook OAuth

**Dashboard:** https://developers.facebook.com → Your App → Settings → Basic

### 6a. App Secret (`SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET`)
1. Under **App Secret**, click **Show** then **Reset**
2. Confirm the reset
3. Copy the new secret
4. Go to **Supabase Dashboard → Authentication → Providers → Facebook**
5. Paste the new secret into **App Secret** → Save
6. Set in Vercel: `SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET=...`

### 6b. Verify
Test Facebook sign-in at https://www.wasel14.online/app/auth.

---

## 7. Internal worker secrets

These are generated locally — no provider dashboard needed.

### Generate new secrets
```powershell
# PowerShell
$secrets = @(
  'COMMUNICATION_WORKER_SECRET',
  'COMMUNICATION_WEBHOOK_TOKEN',
  'OUTBOX_WORKER_SECRET',
  'WASEL_INTERNAL_HEALTH_TOKEN',
  'VIte_TELEMETRY_TOKEN',
  'VITE_EVENT_BROKER_WORKER_SECRET'
)
foreach ($s in $secrets) {
  $val = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
  Write-Host "$s=$val"
}
```

Or with OpenSSL (WSL/Git Bash):
```bash
for s in COMMUNICATION_WORKER_SECRET COMMUNICATION_WEBHOOK_TOKEN \
         OUTBOX_WORKER_SECRET WASEL_INTERNAL_HEALTH_TOKEN; do
  echo "$s=$(openssl rand -hex 32)"
done
```

Set each generated value in:
- Vercel → Environment Variables
- Supabase → Edge Function Secrets

---

## 8. Sentry DSN (`VITE_SENTRY_DSN`)

**Dashboard:** https://sentry.io → Your project → Settings → Client Keys

1. Click **Generate New Key** (old DSN continues working until you delete it)
2. Copy the new DSN
3. Delete the old key
4. Set in Vercel: `VITE_SENTRY_DSN=https://...@....ingest.sentry.io/...`
5. Trigger a Vercel redeploy

---

## 9. Azure Application Insights (`VITE_APP_INSIGHTS_CONNECTION_STRING`)

**Dashboard:** Azure Portal → Application Insights resource → Overview

1. Copy the **Connection String** (format: `InstrumentationKey=...;IngestionEndpoint=...`)
2. Set in Vercel: `VITE_APP_INSIGHTS_CONNECTION_STRING=InstrumentationKey=...`
3. Trigger a Vercel redeploy

> Application Insights does not support key rotation — if the key is compromised,
> delete the resource and create a new one, then update the connection string.

---

## 10. Vercel deployment token

**Dashboard:** https://vercel.com/account/tokens

1. Click **Create** → name it `wasel-ci-deploy`, set expiry to 90 days
2. Copy the token
3. Go to your GitHub repo → Settings → Secrets → Actions
4. Update `VERCEL_TOKEN` with the new value
5. Delete the old token from Vercel

---

## 11. Git history cleanup

If any secret was ever committed (even briefly), the file move is not enough:

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env files from all history
git filter-repo --invert-paths --path .env --path .env.local \
  --path .env.production --path .env.production.local --force

# Force-push (coordinate with team — this rewrites history)
git push origin --force --all
git push origin --force --tags
```

Then:
1. Enable **GitHub → Settings → Security → Secret scanning**
2. Enable **GitHub → Settings → Security → Push protection**
3. Notify all collaborators to re-clone (their local history is now diverged)

---

## Post-rotation verification

Run all three checks after completing rotations:

```powershell
# 1. Validate all Vercel env vars are set and non-placeholder
node scripts/validate-vercel-env.mjs

# 2. Run production preflight
node scripts/production-preflight.mjs

# 3. Check live integrations
node scripts/verify-live-integrations.mjs
```

Expected output: all green, no placeholder warnings.

---

## Rotation schedule

| Credential type | Frequency |
|---|---|
| Stripe secret key | Every 90 days or on any suspected exposure |
| Twilio auth token | Every 90 days |
| Resend API key | Every 90 days |
| Worker secrets | Every 180 days |
| OAuth client secrets | Every 180 days or on any suspected exposure |
| Supabase service role key | Every 180 days |
| Vercel deploy token | Every 90 days |
| Sentry DSN | On suspected exposure only |

---

*Last updated: 2026-11-10*
