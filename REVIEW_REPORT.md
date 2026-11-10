# Wasel Quality & Release-Readiness Review

**Updated:** 2026-11-10. This is a local code review; no production deployment or live-provider verification was performed.
**Status: code remediation in progress; production readiness is not verified.** The local fixes below close the profile Data API exposure, prevent fictitious Mobility OS booking success, retire the duplicate Stripe implementation, and strengthen CI gates. Live database replay is unavailable in this environment because the local Docker daemon is not running. CliQ's amount unit still requires a signed sandbox payload and provider configuration before top-ups can be credited.

## 2026-11-10 follow-up

| Area | Change | Verification state |
|---|---|---|
| **Database privacy** | New migration revokes client access to `public.profiles`, removes broad policies, and adds a restrictive self-read policy. The RLS SQL gate now checks profile table and column privileges. | Migration and live SQL gate not applied locally or in production; Docker unavailable. |
| **Mobility OS** | Booking UI is disabled until payment authorization/confirmation exists; the endpoint fails closed and client errors no longer create local success records. | E2E regression updated; execution pending. |
| **CliQ** | Webhook amount conversion now requires an explicit `CLIQ_WEBHOOK_AMOUNT_UNIT` (`jod` or `fils`) and reports held/mismatched payments accurately. | Unit conversion cases added; actual unit must be confirmed in CliQ sandbox. |
| **Stripe** | `stripe-payments-v2` is reduced to a 410 compatibility endpoint; the deploy workflow publishes the stub, while the main backend remains authoritative. | Local source updated; deploy workflow has not run. |
| **CI** | Added mobile type/lint/unit checks and raised the regular web coverage gate to 30/25/20/28, matching the current Vitest ratchet. | Workflow not run in this session. |
| **Docs** | Updated wiring, Stripe endpoint, Mobility OS, and deployment guidance. | File review only. |

---

## Historical changes (October 2026)

| Area | Fix |
|---|---|
| **Security — webhook JWT gate** | Dedicated `supabase/functions/webhooks/` function with `verify_jwt = false`. Provider signature checks now run before any auth. `supabase/config.toml` updated. |
| **Security — password policy** | `minimum_password_length` raised from 8 → 12. |
| **Testing — edge functions** | Deno handler tests cover Stripe, CliQ, Resend, Twilio, and Send-SMS signature/configuration paths. This review adds current Resend/Svix format and replay/tamper cases; these tests still need to pass in CI and against configured provider callbacks. |
| **Testing — excluded suites** | `tests/database/**` and `tests/utils/pricing/**` removed from vitest exclude list — they now run in CI. |
| **CI — translation drift** | `verify-translations.mjs` now exits 1 on drift (was always 0). `translations` job added to CI and gates the build. |
| **CI — deno lint + test** | `deno-lint` CI job now runs `deno lint supabase/functions/` AND `deno test` for webhook handlers. |
| **CI — Lighthouse** | `lighthouse` CI job added. `@lhci/cli` added to devDependencies. `lighthouserc.js` updated with `startServerCommand`. |
| **CI — npm audit** | Removed `continue-on-error: true` from `npm audit` — high-severity vulnerabilities now block the security workflow. |
| **DX — pre-commit hook** | Replaced full `lint + typecheck + test:unit` with `lint-staged` — only staged files are checked, keeping commits fast. |
| **DX — lint-staged** | Added `lint-staged` config to `package.json` and as a devDependency. |
| **DX — .gitattributes** | Added `.gitattributes` enforcing LF line endings for all text files — fixes Windows/Linux CRLF churn. |
| **Docker — .dockerignore** | Added `scripts/`, `mobile/`, `.kilo/`, `artifacts/`, `brand/`, `infra/`, `tests/`, `e2e/`, all env templates, and sensitive docs to `.dockerignore`. |
| **Docs — testing.md** | Corrected coverage thresholds (70/75/80 → 75/80/85/85) and fixed non-existent `npm run test:coverage` command. |

---

## Remaining production work

1. **Rotate all credentials at the providers.** No code change can invalidate a live key.
   Rotate: Stripe, Twilio, Supabase service role, Google OAuth, Facebook OAuth, Resend,
   SendGrid, Vercel token, worker secrets. See `SECURITY_CHECKLIST.md`.
2. **Purge git history** if any secret was ever committed (`git filter-repo` or BFG),
   then enable GitHub Secret Scanning + Push Protection.
3. **Move real env files out of OneDrive** — set `WASEL_ENV_DIR` to a path outside the
   OneDrive sync tree (e.g. `%USERPROFILE%\.wasel-secrets`).
4. **Deploy the migration and edge-function changes** through the protected deployment workflow, then verify profile reads/writes as anon and authenticated users and run payment smoke tests.
5. **Configure `CLIQ_WEBHOOK_AMOUNT_UNIT` only after checking an actual signed sandbox event.** Until then, amount-less or unrecognized values remain uncredited for manual review.
6. **Verify production observability and provider settings** in Vercel and Supabase; this repository review cannot inspect those account values.

---

## Remaining improvements (not blockers)

- Twilio webhook authentication still allows a query-string token until
  `TWILIO_WEBHOOK_REQUIRE_SIGNATURE=true` is enabled after validating the
  provider-side signature URL and secret.
- Confirm `finalizeTopUpTransaction` dedupes on Stripe `event.id` and that
  `verifyStripeWebhookSignature` enforces a timestamp tolerance.
- Keep the 30/25/20/28 coverage ratchet moving toward the 85% release target; current coverage remains substantially below target.
- Add end-to-end payment authorization and settlement for Mobility OS before re-enabling its booking action.
- Add OTLP distributed tracing export via `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`.
