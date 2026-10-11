# Wasel14.online - Master Task: production readiness audit

Started 2026-10-11. One master task. Priority order: build/CI/deploy, security and credentials,
database authorization, payments, backend, end-to-end tests, performance/accessibility/reliability.

## How to read this file

Evidence levels used below:

- **READ**: confirmed by reading the code or migrations in this repo. Not executed.
- **EDITED**: a fix was written. Not compiled or tested (the auditing session had read/write file
  access only, no shell on this machine).
- **TO RUN**: needs a command from "Verification to run" before it counts as done.

Nothing here is marked closed. `REVIEW_REPORT.md` claims 9.2/10; the evidence below does not support
that score (see Tier 0).

## Tier 0 - build and deploy

| ID | Finding | Evidence | State |
|---|---|---|---|
| D1 | `package.json` and `package-lock.json` depend on `@sentry/core` as `file:sentry-core-8.55.2.tgz`. The tarball is not in the repo root, so `npm ci` (the Vercel `installCommand`) fails with ENOENT on any clean checkout. | READ: `package.json`, `package-lock.json` head, ENOENT on the path | OPEN, TO RUN |
| D2 | The newest build log (`build-output.log`, Oct 9) ends `exit code: 2`: TS2322 in `src/utils/monitoring.ts` and `src/config/monitoring.ts`, TS2339 `setMeasurement` not on `Scope`, and ~40 errors in `CorridorGlobeScene.tsx` (`three` has no exported `Vector3`, `mesh`/`group` not in JSX). | READ: log vs current source | monitoring files EDITED; three errors OPEN, TO RUN |
| D3 | `.env` sets `NODE_ENV=production`; Vite warns and ignores it (`build-cutover.log`). | READ | OPEN |
| D4 | Bundle: main chunk 1.16 MB (355 KB gzip), globe chunk 940 KB. | READ: `build-cutover.log` | OPEN (Tier 6) |

D1 fix: `@sentry/react` and `@sentry/browser` already pull in `@sentry/core`. Find out why the tarball
was introduced before removing it (it looks like a workaround for a bad install), then
`npm pkg set "dependencies.@sentry/core=^8.55.2"` and `npm install` to regenerate the lockfile.

D2 three errors: they say `@types/three` / R3F types did not resolve at build time. The repo lives
under OneDrive and `SECURITY_AUDIT_FINDINGS.md` already records interrupted installs there. Delete
`node_modules`, reinstall outside OneDrive, rerun `tsc` before changing `CorridorGlobeScene.tsx`.

## Tier 1 - security and credentials

| ID | Finding | State |
|---|---|---|
| S1 | Credential rotation (Stripe, Twilio, Resend, SendGrid, Supabase service role, OAuth, Vercel, worker secrets) and git-history purge of the committed Google service-account key are still listed as pending in `REVIEW_REPORT.md`. Only the owner can do these. `.env*`, `.env.production` and `vercel-env-variables.txt` sit in the working folder; they were not opened. | OPEN, human action |
| S2 | Earlier audit items verified against current code: A1 module link (index imports and `webhooks.ts` exports now match), A2 (`verify_jwt = false`, webhooks in their own function), B1 refund needs `payments:refund`, B3 reserved metadata keys and user-scoped idempotency, B4 anonymous and web3 sign-in off. | READ: closed in code; deploy state TO RUN |
| S3 | Twilio webhook signs `url.origin + url.pathname`. Twilio signs the exact URL it was configured with, and the edge runtime path omits `/functions/v1`, so this likely rejects every genuine callback. Resend and Twilio also fall back to a query-string token, which downgrades the signature check. | OPEN, TO RUN (live callback) |
| S4 | `supabase-js@2` is imported unpinned from esm.sh; the Stripe SDK is 12.12.0 with `apiVersion` 2024-11-20 while raw Stripe calls use 2026-02-25.clover. | OPEN |

## Tier 2 - database authorization

| ID | Finding | State |
|---|---|---|
| A1 | `20260720054123` grants `anon` SELECT on `public.drivers` (rows carry `license_number`, `background_check_status`). Safe only if RLS blocks anon; the later PII view targets `driver_profiles`, a different table. | OPEN, TO RUN with the anon key |
| A2 | `app_submit_sanad_verification(p_user_id ...)` is SECURITY DEFINER, granted to `authenticated`, with no check that `p_user_id` is the caller. | OPEN, verify against `20261001120000` |
| A3 | `bookings` is addressed with two column sets: `booking_id`/`passenger_id` (booking create, list, PUT, payment status) and `id`/`user_id` (rating, cancel, cancel-eligibility, `assertTripParticipant` used for chat). One set may not exist. Check `information_schema.columns`. | OPEN, TO RUN |

## Tier 3 - payments and transaction integrity

| ID | Finding | State |
|---|---|---|
| P1 | **Every ride booking was rejected.** The handler calls `app_create_ride_booking` with the service-role client; the function required `auth.uid()` and `p_passenger_id = auth.uid()`, and a service-role JWT has no `sub`. `20260720062017` also removed `authenticated` EXECUTE. | READ. EDITED: `supabase/migrations/20261011000000_fix_ride_booking_service_role_and_fare.sql` (SQL parsed by the PostgreSQL parser, with a negative control). Not applied. TO RUN |
| P2 | The same function stored the fare as whatever was passed in (the handler passes 0), so bookings had `amount = total_price = 0`. The new function derives the fare from the locked trip row and fails closed if no price column is found. | EDITED, TO RUN |
| P3 | `finalizeTopUpTransaction` credited any pending row named by a provider callback, including debits. Now requires `add_funds` + `credit`. | EDITED (`shared.ts`) |
| P4 | `markTopUpTransactionFailed` could overwrite a `posted` row (check-then-write race). Update is now guarded with `neq posted`. | EDITED (`shared.ts`) |
| P5 | `PUT /bookings/:id` wrote any string; a passenger could confirm or complete their own booking. Now restricted to the enum, terminal states are frozen, passengers can only cancel. | EDITED (`bookings.ts`) |
| P6 | CliQ webhook credits the stored amount but never compares the amount/currency the provider reports. The checkout URL carries `amount` and `transactionId` as parameters. Add a strict match once the CliQ payload field names are confirmed. | OPEN |
| P7 | Stripe webhook handles checkout sessions, subscriptions and `payment_failed`, but not `payment_intent.succeeded`. `/payment/create-intent` therefore collects money with no server-side record. Confirm whether any UI uses it. | OPEN |
| P8 | `POST /bookings` then picks an arbitrary online driver (`limit 1`, not scoped to the trip) and overwrites `trips.driver_id` with `drivers.driver_id`, while `app_update_booking_status` compares `trips.driver_id` to `auth.uid()`. Decide the id space, then remove or scope this block. | OPEN, needs owner decision |
| P9 | Cancel (`/cancellations/bookings`) writes `status` only (not `booking_status`), never returns seats, does not enforce the 1-hour rule, and only flags `refundRequired`. PUT cancel also skips seat release. Route both through `app_update_booking_status` (needs an actor parameter for service role). | OPEN |
| P10 | Rating: `driverId` and `tripId` come from the client, and the notification goes to any `user_id` supplied. Derive both from the booking. | OPEN |
| P11 | Amount bounds are currency-agnostic (50 to 5,000,000 minor units) and three-decimal currencies (JOD, KWD, BHD, OMR) are not forced to multiples of 10 for create-intent. | OPEN |

## Tier 4 - backend and jobs

| ID | Finding | State |
|---|---|---|
| B1 | `/mobility-os/public-snapshot` (unauthenticated) opened a privileged Postgres connection and ran DDL on every request. Now a SELECT-first path with a per-isolate memo. | EDITED (`shared.ts`) |
| B2 | `/mobility-os/booking/create`: read-then-write on a stale corridor row (oversell, `seats_booked` overwritten not incremented), client `timestamp` feeds dynamic pricing, no payment, fractional quantity allowed. Needs an atomic RPC like the ride-booking one. | OPEN |
| B3 | `consume_rate_limit` exists in `20261001000000` (verified); create-intent fails closed (503) if that migration is not applied in production. `cleanup_api_rate_limits` has no schedule. | READ; TO RUN |
| B4 | Each `finalizeTopUpTransaction` opens a direct Postgres connection (no pooler). | OPEN |

## Tiers 5 and 6 - tests, performance, accessibility

Not reviewed. Coverage was reported as 20% lines against an 85% gate. Run `npm run verify:ci` and
`npm run test:e2e` before any score is claimed.

## Verification to run (needs a shell)

```
npm pkg set "dependencies.@sentry/core=^8.55.2"
rmdir /s /q node_modules          (move the repo out of OneDrive first)
npm install
npm run type-check
npm run lint
npm run build
npm run verify:ci
deno check supabase/functions/make-server-0b1f4071/index.ts
supabase db push --dry-run
npm run test:e2e:smoke
```

```sql
-- A3: which columns does bookings really have?
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' order by 1;
-- A1: test as anon with the anon key: GET /rest/v1/drivers?select=license_number&limit=1
```

After applying the booking migration, create one booking end to end and confirm `amount` is the trip
price times seats.

## Score

Not certified. Static review only; no build, test, or deployment was run.
