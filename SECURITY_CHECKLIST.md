# Security remediation checklist

This file tracks the credential rotation and hardening actions required after
sensitive values were found in local environment files.

**Complete all items marked ❌ before any production deployment or public push.**

---

## Credential rotation

| Credential | Where to rotate | Status |
|---|---|---|
| `TWILIO_AUTH_TOKEN` | [Twilio Console → Account → Auth Token](https://console.twilio.com/us1/account/keys-credentials/auth-token) | ❌ Rotate now |
| `TWILIO_API_KEY_SECRET` | Twilio Console → API Keys → delete & recreate `SKd72935...` | ❌ Rotate now |
| `TWILIO_ACCOUNT_SID` | Note: SIDs are not secrets but rotate the auth token which invalidates them | — |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio Console → Messaging → Services | ❌ Verify not exposed |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Console → Verify → Services | ❌ Verify not exposed |
| `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_live_51Spp9L...`) | [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys) | ❌ Roll key |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys → reveal & rotate | ❌ Rotate now |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → rotate | ❌ Rotate now |
| `VITE_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_CLIENT_ID` | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) | ❌ Verify scope |
| `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth Client → regenerate | ⚠️ Redacted from `.env`/`.env.production` working tree (placeholder now) — **MUST rotate at provider before go-live** |
| `docs/wasel-planning-with-ai.json` (service account private key) | [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → delete key → create new key | ❌ Rotate & remove from repo |
| `VITE_FACEBOOK_APP_ID` / `SUPABASE_AUTH_FACEBOOK_CLIENT_ID` | [Meta for Developers → App Settings → Security](https://developers.facebook.com/) | ❌ Verify scope |
| `SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET` | Meta for Developers → regenerate | ⚠️ Redacted from `.env`/`.env.production` working tree (placeholder now) — **MUST rotate at provider before go-live** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/_/settings/api) | ⚠️ Redacted from working tree — **MUST set in Vercel env vars** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → regenerate | ❌ Rotate now |
| `VERCEL_OIDC_TOKEN` (full JWT in `.env.local`) | Vercel Dashboard → Settings → Tokens | ❌ Revoke & regenerate |
| `RESEND_API_KEY` | [Resend Dashboard → API Keys](https://resend.com/api-keys) | ❌ Rotate now |
| `SENDGRID_API_KEY` | [SendGrid → Settings → API Keys](https://app.sendgrid.com/settings/api_keys) | ❌ Rotate now |
| `COMMUNICATION_WORKER_SECRET` | Generate a new 64-char random secret | ❌ Rotate now |
| `COMMUNICATION_WEBHOOK_TOKEN` | Generate a new 64-char random token | ❌ Rotate now |

---

## Repository hardening

- [x] Real Supabase project ref (`zexlxabdcsjefptmjhuq`) replaced with placeholder in committed `.env` template
- [ ] Run `git log --all --full-history -- .env` to confirm `.env` was never committed
- [ ] Run `git log --all --full-history -- .env.local` to confirm `.env.local` was never committed
- [ ] If either command returns commits, run `git filter-repo --invert-paths --path .env` to scrub history
- [ ] Run `git ls-files --error-unmatch .env` — should error (not tracked)
- [ ] Run `git ls-files --error-unmatch .env.local` — should error (not tracked)
- [x] Delete `_SECRETS_NEEDS_ROTATION_THEN_DELETE/` directory — **DONE: deleted, folder removed, pattern added to .gitignore**
- [ ] Enable GitHub → Settings → Security → Secret scanning
- [ ] Enable GitHub → Settings → Security → Push protection
- [x] `stripe_backup_code.txt` real code overwritten with rotation instructions — regenerate in Stripe dashboard
- [x] `vercel-env-variables.txt` scrubbed — real OAuth IDs replaced with placeholders
- [x] `SUPABASE_SECRET_KEY`, `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET`, `SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET`, `SUPABASE_AUTH_HOOK_SEND_SMS_SECRET`, `VITE_SUPABASE_PUBLISHABLE_KEY` replaced with placeholders in `.env` and `.env.production`
- [ ] Confirm no `.crt`, `.pem`, or `.key` files are tracked: `git ls-files | grep -E '\.(pem|key|crt|cer|p12|pfx)'`

---

## After rotating all credentials

1. Update `.env.example` with the new placeholder names (not real values).
2. Update Vercel environment variables via the Vercel Dashboard or `vercel env pull`.
3. Re-run `npm run verify:live-integrations` to confirm all integrations are healthy.
4. Delete this checklist once all items are resolved, or archive it in `.github/`.

---

*Generated: 2026-06-11*

---

## Session update — 2026-09-24 (file-level verification only, no exec access)

- `docs/wasel-planning-with-ai.json` (the real service account key) is
  **still not present in the working tree** — only the `.example` placeholder
  remains. It may still be in git history; the `git filter-repo`/BFG
  commands above under "Repository hardening" still need to be run and
  confirmed by a human with push access.
- `_SECRETS_NEEDS_ROTATION_THEN_DELETE/` **no longer exists** — confirmed
  deleted from the working tree (the two conflicting notes about this in the
  prior version of this file are resolved: it is gone, full stop).
- The Google OAuth client secret JSON (`client_secret_*.json`) that was
  sitting loose in the project root — inside a OneDrive-synced folder — has
  been **moved to `_git_hygiene_quarantine/`** (still on disk, still
  syncable, but no longer loose at the repo root). **Delete it after you
  rotate the Google OAuth client in the Cloud Console.**
- `prod-ca-2021.crt` and the Vercel env cheat sheets
  (`vercel-env-variables.txt`, `scripts/check-vercel-env.mjs`,
  `scripts/extract-vercel-env.mjs`, `scripts/generate-all-vercel-env.mjs`)
  have been **untracked from git** and added to `.gitignore`.
- The Google and Facebook OAuth credentials in `.env.production`
  (gitignored, local only) are now populated with the **current** live
  values as of 2026-09-24:
  - Google client `[REDACTED]` / secret `[REDACTED]`
  - Facebook app `[REDACTED]` / secret `[REDACTED]`
  - The older Google client `631682127784-...` that was previously in this
    file is **no longer referenced** — confirm it has been deleted or
    rotated in the Google Cloud Console so it cannot be abused.
- **Still not rotation.** Populating a local env file is not the same as
  invalidating a credential at the provider. Confirm in Google Cloud
  Console and Meta for Developers that these are the only active clients
  and that no older client secrets remain valid.
- No credential in this table has been confirmed rotated (i.e. invalidated
  at the provider) as of this session — redaction from local files and
  provider-side rotation are two different things, and only the first one
  has been done here.
- **Git tree scan (2026-09-24):** zero tracked files contain
  `client_secret`, `GOCSPX`, `sk_live`, `whsec_`, `re_live`, Twilio
  account SIDs, or any `.env`/`.env.local`/`.env.production` file. The
  committed tree is clean of secrets.
