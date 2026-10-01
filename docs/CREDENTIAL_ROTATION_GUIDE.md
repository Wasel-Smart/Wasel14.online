# Credential Rotation Guide

Step-by-step instructions for rotating every credential listed in `SECURITY_CHECKLIST.md`.
Rotation means **invalidating the old value at the provider**. Editing or deleting a local
file does not do that.

> **Where to store the new values:** never inside this project folder while it lives in
> OneDrive. Set `WASEL_ENV_DIR` to a folder outside any synced location (for example
> `%USERPROFILE%\.wasel-secrets`, which `scripts\finish-hardening.ps1` creates) and keep the
> real `.env*` files there, or set them only in Vercel / Supabase secret management.
> Where a step below says "your env folder", it means that external folder.
> Never paste a secret into chat, a ticket, a commit message, or a markdown file.

---

## 0. Order of work

1. **Prepare the destinations first** so nothing is down while the old key is still live:
   open the Vercel project env settings and have the Supabase secrets command ready (section 7).
2. **Create the new credential** at the provider (do not revoke the old one yet when the provider
   offers a grace period or a second slot).
3. **Deploy the new value** to every consumer (external env folder, Vercel, Supabase secrets).
4. **Verify** (section 8).
5. **Revoke the old credential.**
6. Tick the row in `SECURITY_CHECKLIST.md` only after step 5. Do not write the value there.

Suggested priority: Supabase service role and DB password, Stripe, Twilio, Google service
account key, Vercel token, then OAuth providers, email providers, and worker secrets.

Webhook URLs in this project live under the edge function, for example:
`https://<project-ref>.supabase.co/functions/v1/make-server-0b1f4071/payments/webhooks/stripe`
(other routes: `/communications/webhooks/twilio`, `/communications/webhooks/resend`,
`/trust/webhooks/sanad`, `/payments/webhooks/cliq`, `/auth/hooks/send-sms`).

---

## 1. Stripe

### 1.1 Secret key (`STRIPE_SECRET_KEY`) and publishable key (`VITE_STRIPE_PUBLISHABLE_KEY`)
1. Open [Stripe API keys](https://dashboard.stripe.com/apikeys).
2. Secret key: **Roll key**, choose an expiry for the old key (a short grace period such as
   1 to 24 hours lets you deploy first), copy the new value.
3. Publishable key: copy the rolled value if Stripe issued a new one.
4. Update both in your env folder, Vercel, and Supabase secrets (section 7). Redeploy.
5. After verification, let the old key expire or expire it immediately.

### 1.2 Webhook signing secret (`STRIPE_WEBHOOK_SECRET`)
1. Open [Stripe Webhooks](https://dashboard.stripe.com/webhooks) and select the Wasel endpoint
   (the URL above, not a generic `/v1/webhooks/stripe` path).
2. **Roll secret**, set an expiry for the old one, copy the new `whsec_...` value.
3. Update it in Supabase secrets and redeploy the function.
4. Test with `stripe trigger checkout.session.completed` (section 8).

### 1.3 Stripe account recovery codes (`stripe_backup_code.txt`)
Regenerate the 2FA backup codes in Stripe (Settings, Personal details, Two-step authentication)
and store them in a password manager, not in the repo or OneDrive.

---

## 2. Twilio

### 2.1 Auth token (`TWILIO_AUTH_TOKEN`)
1. Open the [Twilio Console](https://console.twilio.com/), Account, API keys & tokens.
2. Create a **secondary auth token**, deploy it, then **promote** it to primary. This avoids downtime.
3. Update `TWILIO_AUTH_TOKEN` in Supabase secrets.

### 2.2 API key (`TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET`)
1. **Create API key** (Standard), copy the SID and secret once (the secret is shown only once).
2. Deploy both values, verify, then **delete the old (exposed) API key**.

### 2.3 Service SIDs
`TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_VERIFY_SERVICE_SID` are identifiers, not secrets.
Just confirm they were not shared alongside the auth token; no rotation needed unless you
want to recreate the services.

---

## 3. Supabase

### 3.1 API keys (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, publishable/anon key)
1. Open [Supabase project settings, API keys](https://supabase.com/dashboard/project/_/settings/api-keys).
2. Create a new **secret** key (`sb_secret_...`) and use it for server code. Delete the old one
   after deploying.
3. For the legacy `service_role` / `anon` JWT keys, rotate the **JWT secret**
   (Settings, JWT keys). This invalidates every legacy key and **signs all users out**, so
   do it in a quiet window and deploy the new keys immediately.
4. The publishable key (`sb_publishable_...`) is public by design. Rotate it only if you want to
   invalidate old builds.
5. Update `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel and rebuild; update the secret key in Supabase
   secrets and Vercel server-side variables.

### 3.2 Database password (`DATABASE_URL`)
Settings, Database, **Reset database password**. Update `DATABASE_URL` everywhere it is used and
restart anything holding connections.

### 3.3 Send-SMS auth hook secret (`SEND_SMS_HOOK_SECRET`)
Regenerate the hook secret in Authentication, Hooks, and set the same value as the
`SEND_SMS_HOOK_SECRET` edge secret so `handleSendSmsHook` accepts it. (The code also still
reads the old `SUPABASE_AUTH_HOOK_SEND_SMS_SECRET` name as a fallback, but Supabase will not
let you set secrets with a `SUPABASE_` prefix.)

---

## 4. Auth providers

### 4.1 Google OAuth client secret (`SUPABASE_AUTH_GOOGLE_CLIENT_SECRET`)
1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) and the
   Wasel OAuth 2.0 client.
2. **Add secret** (a new one), copy it, paste it into Supabase Authentication, Providers, Google.
3. Verify Google sign-in, then **disable and delete the old secret**.
4. Delete any older OAuth clients that are no longer used (including the previous client id that
   used to be in `.env.example`). Keep the authorized redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback` on the client you keep.

### 4.2 Google service account key (`docs/wasel-planning-with-ai.json`)
In [IAM, Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) open the
account, Keys, **delete the exposed key**, and create a new one only if something still needs it.
Store any new key outside the project folder.

### 4.3 Facebook app secret (`SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET`)
1. [Meta for Developers](https://developers.facebook.com/), your app, Settings, Basic.
2. **Reset** the App Secret (this takes effect immediately), paste the new value into Supabase
   Authentication, Providers, Facebook, and verify sign-in right away.

---

## 5. Email providers

### 5.1 Resend (`RESEND_API_KEY`)
Create a new key named for the environment (for example `wasel-prod`), deploy it, verify sending,
then delete the old key at [Resend API keys](https://resend.com/api-keys). If you use Resend
webhooks, regenerate the webhook signing secret too.

### 5.2 SendGrid (`SENDGRID_API_KEY`)
Create a new key with the minimum scope needed (Mail Send is usually enough, not Full Access),
deploy it, verify, then delete the old key in
[SendGrid API keys](https://app.sendgrid.com/settings/api_keys).

---

## 6. Platform and worker secrets

### 6.1 Vercel token / OIDC token (`VERCEL_OIDC_TOKEN`)
OIDC tokens are short-lived; make sure none was committed or synced, then revoke any
long-lived access tokens in Vercel, Settings, Tokens, and create new ones as needed.

### 6.2 Worker and webhook tokens (`COMMUNICATION_WORKER_SECRET`, `COMMUNICATION_WEBHOOK_TOKEN`)
1. Generate two separate random values (do not reuse one for both):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Set them in Supabase secrets and in whatever calls the dispatch endpoints (for example the
   Resend/Twilio webhook URL tokens). Update the provider webhook URLs that embed the token.

---

## 7. Deploying new values

Do not type secrets on the command line (they end up in shell history). Put them in a file in
your external env folder and load that file:

```powershell
# Edge function secrets (server-side values read by the Supabase function)
supabase secrets set --env-file "$env:WASEL_ENV_DIR\edge-secrets.env" --project-ref <project-ref>

# Redeploy so the function picks them up
npm run edge:deploy
```

For Vercel, set them in Project Settings, Environment Variables (server-side variables must not
use the `VITE_` prefix), then redeploy. `docs/WIRING_ARCHITECTURE.md` lists which variable belongs
where. Delete `edge-secrets.env` when finished.

---

## 8. Verification

There is no `verify:live-integrations` script in this repository. Use these instead:

```bash
npm run secrets:check     # no secrets in tracked files or local env files
npm run env:check         # env files are placeholders in templates, not synced
npm run verify:oauth      # OAuth config and live provider settings
npm run verify:wiring     # frontend can reach the backend (needs VITE_SUPABASE_* set)
```

Then check the live system:

- `GET https://<project-ref>.supabase.co/functions/v1/make-server-0b1f4071/health` returns healthy.
- Sign in with Google, Facebook, email, and a phone OTP.
- `stripe trigger checkout.session.completed` is received and handled (no 401).
- Send a test email and SMS from the admin diagnostics route.

Only after these pass, revoke the old credentials and tick `SECURITY_CHECKLIST.md`.

---

## 9. If a secret was ever committed

Rotation comes first (the value is already public to anyone with repo access). Then scrub history
with `git filter-repo` (see `scripts\finish-hardening.ps1` for the scan), force-push with
`--force-with-lease`, ask collaborators to re-clone, and enable GitHub secret scanning and
push protection.
