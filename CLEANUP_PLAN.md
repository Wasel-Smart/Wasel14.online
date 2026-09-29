# Wasel Cleanup & Best-Practices Plan

Status: PROPOSAL ONLY. Nothing below has been applied.
Method: read-only survey of directory structure, `package.json`, `.gitignore`,
`.gitleaks.toml`, `ENGINEERING_STANDARDS.md`, `CHANGES.md`, and a few scripts.
Not reviewed yet: application source code, `.env*` files (deliberately not opened),
CI workflows, Supabase migrations, Docker/infra files.

---

## 0. Secrets and location (do first, manual)

The project lives under `OneDrive\Desktop`, so OneDrive is likely syncing every file
in it, including gitignored ones.

Files that hold or may hold secrets and are sitting in the synced folder:
- `.env`, `.env.production`, `.env.local`, `.env.production.*.template` (templates should be placeholders only)
- `mobile/.env`
- `stripe_backup_code.txt`
- `vercel-env-variables.txt`
- `prod-ca-2021.crt`
- `_SECRETS_NEEDS_ROTATION_THEN_DELETE/` (named in `.gitignore`; not seen at root listing, check elsewhere)

Actions (owner: Laith):
1. Move the project to a non-synced path (e.g. `C:\dev\Wasel14.online`).
   `scripts/check-onedrive.mjs` and `scripts/fix-node-modules.ps1` exist only to work
   around this location, and can be removed afterwards.
2. Treat anything that was synced as exposed. Rotate at the provider:
   Stripe keys and backup codes, Supabase service-role key, Twilio, OAuth client
   secrets (Google/Facebook), Firebase admin, any DB passwords in `.env.production`.
   `docs/CREDENTIAL_ROTATION_GUIDE.md` already describes the process.
3. Keep production secrets only in Vercel / Supabase secret management. Local `.env`
   should hold dev-only values.
4. Delete `stripe_backup_code.txt` and `vercel-env-variables.txt` after moving their
   contents to a password manager.

## 1. Root clutter

| Item | Observation | Proposed action |
|---|---|---|
| `CHANGES.md` and `CHANGELOG.md` | Two changelogs. `CHANGES.md` is a one-off external review note dated 2026-07-01 | Merge anything useful into `CHANGELOG.md`, quarantine `CHANGES.md` |
| `REVIEW_REPORT.md` (21 KB) | Point-in-time report | Move to `docs/reports/` |
| `lint-output.txt` (0 B) | Empty scratch file, already gitignored | Quarantine |
| `probe-auth.mjs` | One-off probe script at root | Move to `scripts/` or quarantine |
| `skills-lock.json` | Tooling lock file, `cleanup-root.mjs` marks it for deletion | Keep only if `.agents`/`.claude` skills tooling needs it |
| `deploy.production.sh` (root, 1.82 KB) | A different copy exists at `scripts/deploy.production.sh` (3.08 KB) | Diff both, keep one |
| `dist/`, `test-results/`, `.vercel/`, `.expo/` | Build/test output and local state | Confirm ignored, leave alone |
| `.venv/` (root) | Python venv, used by `scripts/*.py` brand tooling | Keep local, ensure ignored |
| `.kilo/`, `.agents/`, `.claude/`, `.idea/` | Editor/AI tooling folders | Keep local, ensure ignored (`.kilo`, `.idea` already are) |
| `artifacts/` | Only empty-looking subfolders `brand`, `live-integrations`, already gitignored | Quarantine if empty |

## 2. Duplicated or stale documents

- `docs/HONEST_AUDIT_REPORT.md` and `mobile/HONEST_AUDIT_REPORT.md`
- `docs/30_DAY_PRODUCTION_REPORT.md` and `mobile/30_DAY_PRODUCTION_REPORT.md`
- `docs/PHONE_NUMBER_FIX_SUMMARY.md` and `mobile/PHONE_NUMBER_FIX_SUMMARY.md`
- Overlapping OAuth docs: `oauth-setup-checklist.md`, `oauth-setup-guide.md`, `FACEBOOK_OAUTH_SETUP.md`
- Overlapping status docs: `DEPLOYMENT_SUMMARY.md`, `IMPROVEMENTS_SUMMARY.md`, `implementation-status.md`, `PRODUCTION_HARDENING_REPORT.md`, `DATABASE_SCORECARD.md`
- `docs/README.txt` (0 B) and `docs/RUN_MIGRATION.sql` (belongs in `supabase/migrations/` or `scripts/`)
- Self-graded "10/10" style material is already partly gitignored (`scripts/validate-10-out-of-10.*` etc.)

Proposal: keep one canonical doc per topic, move point-in-time reports into
`docs/archive/`, and quarantine exact duplicates.

## 3. `scripts/` (102 files)

One-off patch and refactor scripts that look already applied:
`patch-20260223.mjs`, `swap-20260224.mjs`, `patch-all-constraints.mjs`,
`patch-wasel-cols.mjs`, `fix-all-do-blocks.mjs`, `fix-backup-config.mjs`,
`fix-chunks.mjs`, `fix-region-data.mjs`, `fix-views.mjs`, `full-refactor.js`,
`split-currency.mjs`, `split-regionConfig.mjs`, `split-translations.mjs`,
`reorder-migrations.mjs`, `find-countries.mjs`, `extract-countries.mjs`,
`analyze-files.cjs`, `create-shared.js`.
Proposal: quarantine, then delete once nothing references them.

Other issues:
- `scripts/` contains its own `package.json`, `package-lock.json` and `node_modules`
  (`@wasel/payment-reconciliation-service`). Its `dev` script runs `service.ts`, which is
  not in `scripts/`, and `cleanup-root.mjs` says `service.ts` lives in `docs/`.
  Decide whether this service is real; if so move it to `packages/` or `services/`.
- Duplicate pairs: `brand-check.mjs` and `brand-check.ts`; `.bat`/`.sh`/`.ps1` variants
  of the same task; `backend-health-check.yml` (a workflow file, belongs in `.github/workflows/`).
- `cleanup-root.mjs` has a bug: `remove()` calls `resolve()` but only `join`, `basename`
  and `dirname` are imported from `path`, so any real (non-dry) run throws a
  ReferenceError. It also would skip moving root `deploy.production.sh` because the
  destination already exists. Do not run it as-is (`npm run cleanup:root`).
- Scripts named `check-vercel-env`, `extract-vercel-env`, `generate-all-vercel-env`
  handle env values and are already gitignored. Confirm they are not tracked.

## 4. Web app dependencies (`package.json`)

1. `ioredis` and `facebook-nodejs-business-sdk` are Node server SDKs in the browser
   app's `dependencies`. Move to the server package (`api/`, `packages/`) or remove.
2. `@google/genai` in the client: confirm no API key is bundled into the browser
   build. Calls should go through a server route.
3. `vite` belongs in `devDependencies`.
4. `motion` and `framer-motion` are the same library under two names. Keep one.
5. `@eslint/js ^8.57.1` with `eslint ^10.11.0`: align majors.
6. `three`, `@react-three/*`, `recharts`, `leaflet`: verify each is imported and
   lazy-loaded; otherwise remove or code-split.
7. `build` runs `npx tsc` while `type-check:app` uses `tsconfig.build.json`; make the
   build use the same config and drop `npx`.
8. Add `"engines"` (Node) and `"packageManager"`; remove `yarn.lock` from `.gitignore`
   logic by choosing one package manager.
9. Run `npm audit` and `npm outdated`; note `CHANGES.md` mentions unmerged Dependabot
   security PRs on GitHub.

## 5. Mobile (`mobile/`)

- Both `package-lock.json` and `yarn.lock` exist. Pick one, delete the other.
- `coverage/` (lcov HTML) and empty `dist/`: generated output; ensure ignored.
- `.jest-localstorage`: generated test artifact; ensure ignored.
- `mobile/src/types/firebase.d.ts` while the root `.gitignore` says Firebase native
  config is "not used by web client": confirm mobile actually uses Firebase.
- `CHANGES.md` reports a `@types/react ~18.2.79` vs `react-native@0.86.0` peer
  conflict (`^19.1.1`). Re-verify; it may already be fixed.
- Test files are split between `src/**/*.test.ts(x)` and `src/test/`; standardize.
- Mobile-specific checks to run in the audit phase: token storage in Keychain/Keystore
  (not AsyncStorage), certificate pinning decision, deep-link validation, no secrets in
  `app.config.js`/`eas.json`, biometric fallback behavior, screen-capture protection on
  payment screens, permissions scoped to what is used.

## 6. `.gitignore`

About 200 lines, many listing specific junk files that the cleanup would remove
(`landing-*.json`, `test-*.cjs`, `fix-*.cjs`, and so on). After cleanup, shrink to
category patterns. Also:
- `.env?*` and `.env.*.local` overlap; simplify.
- `.gitignore` ignores `stripe_backup_code.txt` twice and `client_secret_*.json` twice.
- `Dockerfile.*` then `!Dockerfile.dev` is fragile; use explicit names.
- Verify none of the ignored-but-present files were ever committed:
  `git log --all --diff-filter=A -- .env stripe_backup_code.txt vercel-env-variables.txt`.
  If any was, rotate and consider history rewrite.

## 7. Best-practice audit (phase 4, after approval)

Checked against `ENGINEERING_STANDARDS.md` and OWASP ASVS/MASVS:
- Auth: session/token storage, refresh handling, CSRF on state-changing routes
- Supabase: RLS enabled on every table, no service-role key reachable from client code
- Input validation: Zod at API boundaries; no `dangerouslySetInnerHTML` without sanitizing
- Payments: Stripe webhook signature verification and idempotency
- Headers: CSP, HSTS, frame-ancestors in `vercel.json`
- Logging: no PII or tokens in logs, Sentry/App Insights scrubbing
- Accessibility (axe), i18n/RTL correctness for Arabic
- CI: secret scanning (gitleaks/trufflehog wired in `.husky` and `.github`), lockfile
  integrity, pinned action versions, least-privilege workflow permissions
- Docker: non-root user, pinned base images, no secrets in build args
- Coverage thresholds in `ENGINEERING_STANDARDS.md` versus actual `vitest.config.ts`

## 8. Proposed order and safety rules

1. Owner actions in section 0.
2. Quarantine (move, don't delete) into `_CLEANUP_REVIEW/` with a manifest listing
   each file's original path.
3. Config and dependency fixes from sections 4, 5 and 6, one small change at a time, with
   `npm run verify:ci` between steps (run on your machine; I cannot execute commands).
4. Source audit from section 7, reported as findings before any edit.
5. Never touch `.env*` files; never delete anything; never overwrite without showing you
   the change first.
