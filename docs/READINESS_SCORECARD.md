# Wasel readiness scorecard

Rule: a score rises only when its evidence exists. "I read the code" is worth at most
a 7. A 9 needs an executed run, a deployed check, or a signed-off human action.

Last independent review: 2026-10-17 (file-level; nothing executed).

| Aspect | Now | Needed for 9 | Evidence required |
|---|---|---|---|
| Payments | 8 | Booking and top-up flows proven end to end in Stripe test mode and the CliQ sandbox | Test-mode run log; CliQ amount unit (JOD vs fils) confirmed from a real sandbox payload |
| Security | 7.5 | RLS reviewed table by table; secrets rotated; webhooks deployed and returning 200 | RLS review notes; rotation checklist signed; `stripe trigger checkout.session.completed` returns 200 |
| Testing and CI | 7 | `npm run verify` green on a clean checkout; edge tests run in CI | CI run URL; coverage report |
| Architecture | 6 | One authoritative payment path; legacy per-domain functions retired or documented | Deleted or archived functions; updated `docs/architecture.md` |
| Maintainability | 6.5 | `scripts/` pruned; one lockfile per package; duplicate docs archived | Smaller `scripts/`; `CLEANUP_PLAN.md` items closed |
| Operations | 6 | Rotation done, runbook drill done, alerting live, restore tested | Drill notes; alert fired in staging; backup restore log |
| Scalability | 6 | k6 production profile passes against staging at the target load | k6 summary against staging |
| Product fit | 8.5 | Jordan and Iraq flows verified with real providers | Provider sandbox runs |

## Verified by reading (2026-10-17)

- Stripe webhook: signature check with a 300 s timestamp tolerance; top-up crediting is
  idempotent (row lock plus `posted` check in `finalizeTopUpTransaction`).
- Booking card payments: amount and currency reconciled in `finalizeBookingPayment`.
- Refunds: gated by `payments:refund`, ownership-checked, amount capped server-side.
- Runtime admin routes (`apply-migrations`): off unless `ENABLE_RUNTIME_ADMIN_ENDPOINTS`
  is set, and they also need the worker secret.
- `webhooks/_vendor/**` is generated from `make-server-0b1f4071`; run `npm run edge:sync`
  after editing handlers there.

## Changed on 2026-10-17

- Card amounts now use per-currency Stripe minor units (`toStripeMinorUnits`). Before, any
  three-decimal currency other than JOD (KWD, BHD, OMR, TND) was billed at one tenth.
  Unknown currencies (IQD) now fail closed instead of guessing.
- Twilio delivery receipts now verify `X-Twilio-Signature`. Before, the handler required a
  URL token that the StatusCallback URL no longer carries, so receipts were rejected.
  Set `TWILIO_WEBHOOK_REQUIRE_SIGNATURE=true` once receipts verify in production, and
  `TWILIO_WEBHOOK_PUBLIC_URL` if the proxy rewrites the URL.
- Added Deno tests for both changes in `supabase/functions/tests/webhooks.test.ts`.

## Open: needs the owner

1. Rotate every provider credential; purge git history if a secret was ever committed.
2. Run `npm run edge:sync`, then `npm run verify`, and fix what fails.
3. Deploy `webhooks` and confirm Stripe, CliQ, Sanad and Twilio callbacks return 200.
4. Confirm the Stripe account entity is eligible for a Jordan-market business.

## Open: code

- Pin `@supabase/supabase-js` and the Stripe SDK; commit a `deno.lock`.
- Align Stripe API versions (SDK uses 2024-11-20, raw calls use 2026-02-25.clover).
- Pool Postgres connections in `finalizeTopUpTransaction` (one new client per webhook).
- Retire or document the legacy per-domain edge functions that overlap `make-server`.
- Add a test that every non-public route rejects an anonymous request.
- Review RLS migrations against `is_anonymous` and role tables.
- Fix mojibake in comments (`shared.ts` has `â”€â”€` where `──` was intended).
