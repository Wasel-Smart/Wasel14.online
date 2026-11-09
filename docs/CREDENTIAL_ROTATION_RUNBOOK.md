# Credential Rotation Runbook

## Current status (2026-11-09)

**Rotation is not confirmed complete. Do not mark credentials as rotated or treat the deployment as cleared.** This local audit inspected variable names only; it never printed values and did not access provider dashboards or remote secret stores.

| Evidence | What was observed | Required follow-up |
|---|---|---|
| Local `.env` | Names for `SUPABASE_AUTH_GOOGLE_CLIENT_SECRET` and `SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET` | Rotate at Google and Meta, then update the Google and Facebook providers in Supabase Auth. |
| Local `.env.local` | Names `VERCEL_OIDC_TOKEN` and `AI_GATEWAY_API_KEY` | Confirm source and lifetime; revoke/rotate any active credential and update its deployment consumer. |
| Local `.env.production` / `.env.production.local` | Names include `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_GOOGLE_MAPS_API_KEY` | These are client-visible values, not server secrets. Migrate away from the legacy Supabase anon key and confirm Maps API restrictions. |
| Current process environment | Names `NPM_TOKEN` and `OPENAI_API_KEY` | Identify the owning account and scope; rotate if active and ensure the token is not unnecessarily inherited by builds. |
| Git history | Prior commits reference `docs/wasel-planning-with-ai.json` | Treat its Google service-account key as compromised until Google Cloud confirms the key is disabled or deleted. |
| Provider secret stores | Not inspected | Check every provider listed below and record the rotation date, operator, and old-key revocation evidence. |

The current checkout resolves outside the historical OneDrive path described in older documentation. Confirm device backup and sync settings independently. `.env` and `.env.local` are not tracked at the current Git revision; that does not prove their values were never copied elsewhere.

## Safe local inventory

Run `npm run credentials:inventory` to list matching credential variable **names** from `.env*` files, an optional `WASEL_ENV_DIR`, and the current process environment. It never prints values and cannot determine whether a provider credential is valid, revoked, or present in a remote secret store.

Do not paste secret values into tickets, chat, terminal transcripts, build output, or this repository. Use each provider's secret manager and access-controlled deployment settings.

## Rotation sequence

For each credential, record the owner, affected integration, storage locations, rotation date, and revocation confirmation. Unless a provider documents a safer emergency path, use this sequence:

1. Stop further exposure: remove the credential from tracked files and stop generating logs or artifacts containing it.
2. Create a replacement in the provider console or an approved identity workflow.
3. Update the provider configuration, Vercel environment, Supabase Edge Function secrets, CI secrets, and any local developer secret store that uses it.
4. Deploy the consumers and verify sign-in, webhooks, payment flows, messaging, or database access in staging.
5. Revoke the old credential at the provider. A file edit or deployment does not revoke a key.
6. Confirm old-key requests fail and new-key integration checks pass. Save only non-secret evidence such as timestamps, key identifiers, and test results.

For actively abused credentials, prioritize revocation over a zero-downtime sequence, then restore integrations with replacements.

## Provider checklist

- [ ] **Google OAuth:** Reset the affected OAuth client secret in Google Cloud Credentials; update Supabase Auth > Providers > Google; test sign-in; revoke the previous secret. Google documents that resetting a client secret can cause temporary outage: [Google Cloud compromised credentials](https://docs.cloud.google.com/docs/security/compromised-credentials).
- [ ] **Meta/Facebook OAuth:** Rotate the app secret in Meta for Developers; update Supabase Auth > Providers > Facebook; test sign-in; revoke the previous secret.
- [ ] **Google service account:** Disable/delete the historical private key in Google Cloud IAM. Prefer workload identity over a downloaded JSON key when the deployment supports it. Purge the key from Git history and coordinate any force-push with every collaborator; history cleanup does not replace provider revocation.
- [ ] **Supabase API keys:** Inventory browser publishable keys separately from server secret keys. Replace any leaked secret or legacy `service_role` key, update server consumers, and explicitly retire the old key. Follow [Supabase's leaked-key rotation steps](https://supabase.com/docs/guides/security/rotate-leaked-api-keys); creating a replacement does not itself revoke a legacy key.
- [ ] **Supabase browser key migration:** Replace any configured `VITE_SUPABASE_ANON_KEY` with the publishable key, verify web and mobile clients, then deactivate the legacy anon/service-role key pair in the Dashboard. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [ ] **Supabase database/JWT credentials:** Check the project database password and JWT signing-key state. Rotate only with a dependency plan because database connections and token validation can be affected. Follow the current [Supabase signing-key guidance](https://supabase.com/docs/guides/auth/signing-keys).
- [ ] **Stripe:** Rotate the API secret key and each webhook endpoint secret that may have been exposed. Update Vercel/Supabase consumers, exercise a test webhook, then revoke the previous keys.
- [ ] **Twilio:** Rotate the Account Auth Token and API key secrets. When possible, use a secondary token to update consumers before promoting it; then remove the old token/key. See [Twilio Auth Token rotation](https://help.twilio.com/articles/223136027-Auth-Tokens-and-How-to-Change-Them).
- [ ] **CliQ:** Ask the provider to rotate the merchant API key and webhook secret; update the checkout and webhook consumers and verify signed callbacks.
- [ ] **Resend and SendGrid:** Create replacements, update sender integrations, send a staging message, then revoke the old API keys.
- [ ] **AWS:** Inventory access keys and last-used metadata; replace active keys, deploy consumers, deactivate and delete old keys. Prefer role-based or workload identity credentials. See [AWS access-key management](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-keys-admin-managed.html).
- [ ] **Vercel:** Revoke personal/deployment tokens if exposed. Confirm whether `VERCEL_OIDC_TOKEN` is an ephemeral deployment token or a persistent credential before rotating; update the corresponding CI/deployment flow.
- [ ] **AI gateway, OpenAI, and npm registry:** Identify which account owns `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, and `NPM_TOKEN`; rotate active keys, use least-privilege scopes, and keep package-publish credentials out of normal app builds.
- [ ] **Google Maps:** Keep the browser key public by design, restrict it to Wasel origins and only required Maps APIs, and rotate it if unrestricted or abused.
- [ ] **Postgres and Redis:** Rotate database passwords, pooler credentials, Redis passwords/tokens, and connection URLs if they were exposed; deploy all consumers before revocation where practical.
- [ ] **Sentry and other observability services:** Rotate auth/upload tokens if present. Public DSNs and project identifiers are not equivalent to secret auth tokens.
- [ ] **Worker and webhook secrets:** Rotate `COMMUNICATION_WORKER_SECRET`, `COMMUNICATION_WEBHOOK_TOKEN`, and any other shared service secrets at both producer and consumer.

## Repository and release verification

- [ ] Run `npm run credentials:inventory` and confirm no unexpected local credential names or sources.
- [ ] Confirm every remote environment and secret store has the intended replacement and no old active credential.
- [ ] Run `npm run secrets:check`, `npm run env:check`, the provider integration checks, and the application verification workflow.
- [ ] Scan all Git refs and artifacts for leaked material. If history must be rewritten, coordinate the operation and invalidate old clones, forks, caches, and downloaded artifacts.
- [ ] Update the status table above only after provider-side revocation and replacement have been confirmed. Do not mark completion based on code changes alone.
