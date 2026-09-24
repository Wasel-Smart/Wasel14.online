# Wasel Quality & Release-Readiness Review

**Repository:** `C:\Users\user\OneDrive\Desktop\Wasel14.online`
**Scope:** CI/CD, Docker/K8s, environment handling, secrets/security/privacy, observability, load tests, docs, test coverage
**Method:** Read-only file inspection — no files modified. Tracked vs. gitignored status verified via `git ls-files`. Local-only files (`.env`, `.env.local`, `.env.production`) confirmed NOT tracked.
**Overall Score:** **4/10** — CRITICAL secret exposure in tracked files and CI/CD gaps block release.

---

## 1. Secrets Exposure in Tracked Files — SCORE: 2/10 — CRITICAL

### 1a. Real OAuth secrets in tracked docs — CRITICAL
`docs/HONEST_AUDIT_REPORT.md` (tracked, line 21) documents a **real, live** Google OAuth client secret. Line 23 documents a **real** Supabase service-role secret. These are committed to Git history permanently.

`docs/CREDENTIAL_ROTATION_GUIDE.md` (tracked, lines 14, 20) references live Stripe key prefixes (`sk_live_...`, `pk_live_...`) with rotation instructions — effectively a roadmap for an attacker.

`SECURITY_CHECKLIST.md` (tracked, lines 90–91) documents real OAuth client secrets alongside instructions on where to rotate them at the provider. Even though lines 23/26 mark some items "redacted from working tree," the checklist *itself* contains the live values.

### 1b. Real DATABASE_URL password in tracked `.env.example` — CRITICAL
`.env.example` (tracked, line 98):
```
DATABASE_URL=postgresql://postgres:[LOVEtupac90!]@db.zexlxabdcsjefptmjhuq.supabase.co:5432/postgres
```
Contains a real database password. The `validate-no-secrets.mjs` scanner **excludes** `.example` files (line 20), so this is never caught.

### 1c. Real OAuth client IDs in tracked templates — HIGH
`.env.example` (tracked, lines 140–141): real Google OAuth client ID and Facebook App ID.
`.env.production.template` (tracked, lines 39–46): real Google OAuth client ID (`996...`) and Facebook App ID (`1438...`), different from `.env.example` — indicating orphaned or migrated configs.

### 1d. Real project refs leaked across tracked files
The Supabase project ref `zexlxabdcsjefptmjhuq` appears in 20+ tracked locations: `.env.example` (lines 76, 98, 107, 112), `vercel.json` (line 61), `index.html` (line 132), `supabase/config.toml` (lines 101, 126, 134), `docs/oauth-setup-guide.md`, `docs/oauth-setup-checklist.md`, `docs/FACEBOOK_OAUTH_SETUP.md`, and more. A second ref (`vmskleqlszoupgjkyxqs`) appears in `.env.production.template` (line 12) and `.vscode/mcp.json`.

### 1e. Local `.env` files contain real values but are NOT tracked — OK (mostly)
`.env`, `.env.local`, `.env.production` are correctly gitignored (confirmed: `git ls-files --error-unmatch` returns no matches). However, they reside inside a **OneDrive-synced folder** (see SECURITY.md line 5), creating continuous cloud-sync exposure risk. `.env.local` contains a real Supabase publishable key (local-only, but browser-visible).

### 1f. SECRET SCANNER IS BLIND TO THE LEAKED FILES — CRITICAL
`scripts/validate-no-secrets.mjs` (lines 17–30): the `EXCLUDED_FILES` array includes `.example`, `.template`, `SECURITY_CHECKLIST.md`, `CREDENTIAL_ROTATION_GUIDE.md`, and `HONEST_AUDIT_REPORT.md` — **the exact files that contain the leaked secrets**. The scanner explicitly skips every file that has a problem.

### 1g. `check-env-exposure.mjs` is fundamentally broken AND not wired into CI — CRITICAL
`scripts/check-env-exposure.mjs` (line 116): `entry.name.startsWith('.')` skips **all** `.env*` files — including `.env`, `.env.local`, `.env.production`, and `.env.example`. The `ENV_FILE_PATTERNS` list (lines 51–62) defines the files to scan but they can never be reached. This script is **not referenced** by any CI workflow or husky hook.

### 1h. `.vercelignore` UN-IGNOREs `.env.production` — CRITICAL
`.vercelignore` (line 28–30):
```
.env.*
!.env.example
!.env.production
```
Line 30 (`!.env.production`) **removes** `.env.production` from the Vercel ignore list. If a developer has a local `.env.production` with real secrets (which the SECURITY_CHECKLIST.md confirms happened as of 2026-09-24, lines 87–91), it will be **uploaded to Vercel's build context** during deployment. This is a direct pipeline-to-production secret leak.

### 1i. `.dockerignore` does not exclude production env files — HIGH
`.dockerignore` (lines 1–11) only excludes `.env` and `.env.local`. It does **not** exclude `.env.production`, `.env.production.template`, `.env.production.staging.template`, `.vercel/`, `supabase/.temp/`, `docs/`, `scripts/`, or `.devcontainer/`. The `Dockerfile` (line 8) uses `COPY . .`, copying all of these into the build context.

### 1j. `deploy.production.sh` copies local env into deploy payload — HIGH
`deploy.production.sh` (lines 26–28): copies local `.env.production` into `./deploy/.env`. If that file has real secrets, they are deployed. Line 38 uses `git push -f` (force-push — dangerous for shared branches).

---

## 2. CI/CD Pipeline — SCORE: 4/10 — HIGH

### 2a. OAuth check job will fail in CI — CRITICAL
`.github/workflows/ci.yml` (lines 46–56): the `oauth-check` job runs `npm run verify:oauth`. `scripts/verify-oauth-config.mjs` (line 49) reads from the local `.env` file, which is gitignored and absent in CI. The script calls `process.exit(allPassed ? 0 : 1)` (line 238) — with no `.env`, `checkEnvFile()` returns `false`, the script exits 1, **failing the job**. This is a dependency of the `build` job (line 92), so **no build or deploy can proceed**.

### 2b. Broken `k6` devDependency — HIGH
`package.json` (line 138): `"k6": "^0.0.0"` — this is not the real k6 binary. The `npm run test:load:*` scripts and the `deploy.yml` post-deploy smoke test (line 87: `npm run test:load:smoke`) will fail or no-op.

### 2c. No Lighthouse CI — MEDIUM
`lighthouserc.js` defines performance/accessibility budgets, but `@lhci/cli` is not in devDependencies, no `lhci` script exists, and no Lighthouse job exists in any workflow.

### 2d. `verify-translations.mjs` is a no-op — MEDIUM
`scripts/verify-translations.mjs` (lines 86–87, confirmed via REVIEW_REPORT.md): always returns exit code 0 regardless of actual drift. It is included in `verify:ci` (package.json line 37), so translation drift silently passes.

### 2e. Husky hooks are excessively heavy — MEDIUM
`.husky/pre-commit` runs full `npm run lint` + `npm run type-check` + `npm run test:unit` on every commit with no `lint-staged` for selective checking. This will discourage frequent commits.

### 2f. Misplaced Grafana dashboard — LOW
`.github/workflows/grafana-dashboard-wasel-overview.json` is a dashboard JSON placed in the workflows directory. GitHub ignores it (not `.yml`), but its placement is confusing and unprofessional.

### 2g. Release publish depends on fragile commit prefix — LOW
`.github/workflows/publish.yml` (line 14): only triggers when `startsWith(github.event.head_commit.message, 'chore(release): prepare for')`. If the message format changes, releases silently stop.

---

## 3. Secrets Scanning & Detection — SCORE: 3/10 — CRITICAL

### 3a. TruffleHog uses `--only-verified` — HIGH
`.github/workflows/secret-scan.yml` (line 24): `--only-verified` flag means TruffleHog only reports **verified** findings. Many real secrets that don't match known provider patterns (like the `LOVEtupac90!` DB password or truncated JWT values) will be missed.

### 3b. `npm audit` has `continue-on-error: true` — MEDIUM
`.github/workflows/security.yml` (line 26): `npm audit --audit-level=high` runs with `continue-on-error: true`, so dependency vulnerabilities never block CI.

### 3c. No automated env-var placeholder validation in CI — MEDIUM
The project has `scripts/validate-env.mjs`, `scripts/validate-env-example.mjs`, `scripts/validate-production-boundaries.mjs`, and `scripts/check-build-env.mjs`, but **none are invoked** from any CI workflow. Only `validate-no-secrets.mjs` (which has the exclusion gap in 1f) and `verify-oauth-config.mjs` (which fails in CI per 2a) are wired in.

---

## 4. Docker & Containerization — SCORE: 5/10 — MEDIUM-HIGH

### 4a. Node 20 is EOL — MEDIUM
`Dockerfile` (line 1) and `Dockerfile.dev` (line 1) use `node:20-alpine`. Node 20 reached end-of-life in April 2026. Should use Node 22 LTS or newer.

### 4b. Missing security headers in Docker build — LOW
`Dockerfile` builds nginx from `Dockerfile` but the static `docker/nginx.conf` (included in the build) does include comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.) — this is OK. However, the Docker build has no non-root user configured in the Dockerfile itself (relies on nginx alpine defaults).

### 4c. `.dockerignore` gaps (see 1i) — already covered

---

## 5. Kubernetes / Infrastructure — SCORE: 6/10 — MEDIUM

### 5a. K8s manifests are untested drafts — MEDIUM
`infra/README.md` (lines 14–28) explicitly states: manifests were "never reviewed, never deployed" and "Do not `kubectl apply` these without a review." No production K8s deployment exists. Production runtime is Vercel + Supabase Edge Functions only.

### 5b. Network policies well-structured — GOOD
`infra/k8s-draft/network-policy.yaml` implements default-deny with explicit ingress/egress for api-server, postgres, and redis.

### 5c. API server deployment has strong security context — GOOD
`infra/k8s-draft/api-server/deployment.yaml` (lines 21–65): `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 1000`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drops ALL capabilities, has liveness/readiness probes, HPA (2–10 replicas), PDB.

### 5d. K8s secret template uses placeholders — OK
`infra/k8s-draft/secret.yaml` uses `REPLACE_WITH_*` placeholders (not real secrets).

---

## 6. Environment & Configuration — SCORE: 5/10 — MEDIUM-HIGH

### 6a. Inconsistent Supabase project refs — MEDIUM
Three different refs across the codebase:
- `zexlxabdcsjefptmjhuq` — `.env.example`, `.env`, `index.html`, `vercel.json`, `supabase/config.toml`
- `vmskleqlszoupgjkyxqs` — `.env.production.template`, `.vscode/mcp.json`, `supabase/.temp/` (local)
- `YOUR-STAGING-PROJECT-REF` — `.env.production.staging.template`

This indicates orphaned configs from a project migration.

### 6b. `WASEL_ENV_DIR` external env loading — GOOD
`vite.config.ts` (line 27): `envDir: path.resolve(__dirname, process.env.WASEL_ENV_DIR || '.')` — correct pattern for loading env from outside the OneDrive-synced tree. The `.env.example` (lines 4–20) documents this approach.

### 6c. VITE_EVENT_BROKER_WORKER_SECRET is browser-visible — LOW
`.env.example` (lines 267–271): the comment correctly notes this is a low-privilege API key. Acceptable but should be formally documented in a security policy.

---

## 7. Docker Compose — SCORE: 6/10 — MEDIUM

### 7a. `docker-compose.yml` is well-structured — GOOD
Multi-stage Docker build + nginx runtime, Redis with persistence and healthcheck, restart policies, network isolation, healthcheck on web service.

### 7b. `docker-compose.dev.yml` has dev-only default password — LOW
`docker-compose.dev.yml` (line 11): `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-your-super-secret-and-long-postgres-password}` — acceptable for local dev.

---

## 8. Supabase Configuration — SCORE: 7/10 — MEDIUM

### 8a. 35 migrations + 22 rollbacks, 17 edge functions — GOOD
`supabase/migrations/` has 35 forward + 22 rollback SQL files. `supabase/functions/` has 17 edge function entry points with shared modules (rate-limiter, idempotency middleware, RBAC, validation).

### 8b. Edge functions have no test coverage — HIGH
ESLint config (line 18: `'supabase/functions'`) and vitest config (line 50: `**/mobile/**` excludes mobile but functions are excluded via eslint ignores). The 17 edge functions handle authentication, payments, webhooks — **no tests run in CI or pre-commit**.

### 8c. Weak password policy — MEDIUM
`supabase/config.toml` (line 73): `minimum_password_length = 7` — should be 12+ for production. `password_requirements = "lower_upper_letters_digits_symbols"` (line 74) is good.

### 8d. JWT auth, MFA, refresh token rotation configured — GOOD
`jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, MFA TOTP verify enabled, SMS verify via Twilio.

---

## 9. Tests & Coverage — SCORE: 6/10 — MEDIUM

### 9a. Extensive test suite — GOOD
- 40 `.test.*` files in `tests/` (unit, integration, utils)
- 11 `.spec.*` e2e files in `tests/e2e/`
- 4 k6 load test scripts
- Coverage thresholds enforced in CI: branches ≥75%, functions ≥80%, lines ≥85%, statements ≥85%

### 9b. Some test files are excluded from vitest — LOW
`vitest.config.ts` (lines 44–55) excludes `tests/database/**`, `tests/utils/pricing/**`, and `src/services/Button.test.tsx`. The database hardening test and pricing test exist but never run.

### 9c. Stale testing docs — LOW
`docs/testing.md` (line 14–21): states coverage thresholds as 70%/75%/80% (actual: 75%/80%/85%) and references `npm run test:coverage` which **does not exist** (correct command: `npm run test:unit -- --coverage`).

---

## 10. Observability — SCORE: 7/10 — MEDIUM

### 10a. Good dependency coverage — GOOD
`package.json`: `@microsoft/applicationinsights-web` (^3.4.4), `@sentry/react` (^8.0.0), `@vercel/speed-insights` (^2.0.0), `web-vitals` (^5.2.0).

### 10b. Health endpoint is well-designed — GOOD
`api/health.ts` (187 lines): timing-safe token comparison (`timingSafeEqual`), conditional internal checks (Supabase metrics, Stripe, Twilio, Sentry), `X-Wasel-Trace-Id` header, 503 when not ready, origin-aware.

### 10c. Telemetry endpoint has validation — GOOD
`api/telemetry.ts` (80 lines): origin whitelist, max 50 events per request, 64KB content-length limit, payload structure validation.

### 10d. Rate limiter has fail-closed behavior — GOOD
`supabase/functions/_shared/rate-limiter.ts` (line 149): `checkDbRateLimit` returns `{ allowed: false }` on any error or DB unavailability.

### 10e. Idempotency middleware exists — GOOD
`supabase/functions/_shared/idempotency-middleware.ts` exists for payment safety.

### 10f. No metrics backend configured in code — LOW
OTLP exporter endpoint (`VITE_OTEL_EXPORTER_OTLP_ENDPOINT`) is empty by default. No Prometheus metrics endpoint exposed.

---

## 11. Security Headers & Privacy — SCORE: 7/10 — MEDIUM

### 11a. Strong CSP and security headers — GOOD
`vercel.json` (line 61): comprehensive CSP, plus HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, and CORS allow-list restricted to `https://www.wasel14.online`.

`docker/nginx.conf` (lines 8–16): equivalent security headers for Docker deployments.

### 11b. CSP allows `unsafe-inline` for styles — LOW
Both `vercel.json` and `nginx.conf` CSP include `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`. While common with Tailwind, `unsafe-inline` for styles weakens CSP. Consider using nonces or hashes.

---

## 12. Documentation — SCORE: 5/10 — MEDIUM

### 12a. Extensive docs coverage — GOOD
49 documentation files covering architecture, security, OAuth, deployments, runbooks, SLOs.

### 12b. Stale references to non-existent scripts — HIGH
`docs/RELEASE_GUIDE.md` (lines 54–59) references `npm run release`, `npm run release:patch`, `npm run release:minor`, `npm run release:major` — none exist in `package.json`. The actual release mechanism is GitHub Actions workflows.

### 12c. Devcontainer mismatch — MEDIUM
`.devcontainer/Dockerfile` uses `FROM mcr.microsoft.com/devcontainers/dotnet:1-7.0` with MSSQL setup scripts — this is a .NET/SQL Server stack for a TypeScript/Vite project. The devcontainer is inherited from a template and is inappropriate.

### 12d. No `.gitattributes` — LOW
No `.gitattributes` file exists. On a cross-platform team (Windows + Linux), this risks line-ending inconsistencies.

### 12e. `service.ts` references — LOW
`tsconfig.worker.json` (line 14) includes `"service.ts"` and `eslint.config.js` (line 20) ignores `'service.ts'` — **neither file exists** in the repository. Stale configuration references.

### 12f. `yarn.lock` gitignored but present — LOW
`.gitignore` (line 21) ignores `yarn.lock`, but `yarn.lock` exists in the working directory (325983 bytes). Project uses npm (`package-lock.json`), so this is a stale gitignore entry.

---

## 13. Code Quality & Linting — SCORE: 6/10 — MEDIUM

### 13a. Important directories excluded from linting — HIGH
`eslint.config.js` (lines 8–28) ignores: `scripts` (4 untracked validation scripts), `tests/load`, `mobile`, `supabase/functions` (17 edge functions handling auth/payment/webhooks), `e2e`, `docs`, `service.ts`, `*.config.{js,mjs,ts}`. Critical infrastructure code is not linted.

### 13b. TypeScript strictness enabled — GOOD
`@typescript-eslint/no-explicit-any` (warn), `consistent-type-imports` (error), `no-unused-vars` (error), `eqeqeq` (error).

---

## Risk Summary

| Category | Score | Rating |
|---|---|---|
| Secrets Exposure in Tracked Files | 2/10 | CRITICAL |
| Secret Scanning Coverage | 3/10 | CRITICAL |
| Environment File Handling | 4/10 | CRITICAL |
| CI/CD Correctness | 4/10 | HIGH |
| Docker/Container Hardening | 5/10 | MEDIUM-HIGH |
| Supabase / Edge Functions | 6/10 | MEDIUM |
| Environment Configuration | 5/10 | MEDIUM-HIGH |
| Tests & Coverage | 6/10 | MEDIUM |
| Observability | 7/10 | MEDIUM |
| Kubernetes (draft) | 6/10 | MEDIUM |
| Documentation Accuracy | 5/10 | MEDIUM |
| Code Quality / Linting | 6/10 | MEDIUM |
| **Overall** | **4/10** | **CRITICAL RISKS — NOT RELEASE-READY** |

---

## Immediate Action Required (CRITICAL — must fix before any push to public/remote)

1. **Purge real secrets from tracked files immediately:**
   - `docs/HONEST_AUDIT_REPORT.md` line 21 (Google OAuth secret), line 23 (Supabase secret key) — REMOVE
   - `SECURITY_CHECKLIST.md` lines 90–91 (real OAuth client secrets) — REMOVE
   - `.env.example` line 98 (DATABASE_URL with real password `[LOVEtupac90!]`) — replace with placeholder
   - `docs/CREDENTIAL_ROTATION_GUIDE.md` lines 14, 20 — remove specific key prefix references

2. **Purge git history** of all committed secrets using `git filter-repo` or BFG. Verified clean so far: `.env`, `.env.local`, `.env.production` were **never** committed (confirmed via `git log --all`). But secrets in `SECURITY_CHECKLIST.md`, `docs/HONEST_AUDIT_REPORT.md`, `.env.example`, and `docs/CREDENTIAL_ROTATION_GUIDE.md` **are** in the current tree and must be purged from history after redaction.

3. **Fix `.vercelignore` line 30:** Remove `!.env.production`. This un-ignore directive would ship local `.env.production` (with real OAuth credentials per SECURITY_CHECKLIST.md lines 87–91) to Vercel build context.

4. **Fix `.dockerignore`:** Add exclusions for `.env.production*`, `.env.production.staging.template`, `.vercel/`, `supabase/.temp/`, `.devcontainer/`, `docs/`, and `.env.example` template files.

5. **Fix `validate-no-secrets.mjs`:** Remove `.example`, `.template`, `SECURITY_CHECKLIST.md`, `HONEST_AUDIT_REPORT.md`, and `CREDENTIAL_ROTATION_GUIDE.md` from the `EXCLUDED_FILES` array (lines 17–30). These exclusions defeated the scanner's purpose. Additionally add DATABASE_URL password patterns to `PATTERNS`.

6. **Fix `check-env-exposure.mjs`:** Remove the `entry.name.startsWith('.')` skip on line 116 so `.env*` files are actually scanned. Wire it into CI.

7. **Fix CI `oauth-check` job:** `scripts/verify-oauth-config.mjs` reads local `.env` (line 49) which doesn't exist in CI. Either: (a) create `.env` from `.env.example` template in CI, or (b) change the script to read from environment variables instead of a local file.

8. **Rotate at provider** all credentials that were ever real: Google OAuth client secret, Facebook app secret, Supabase service role key, Stripe live keys, and all credentials documented in `SECURITY_CHECKLIST.md` (status: none confirmed rotated as of 2026-09-24).

9. **Fix or remove `k6` dependency** — `"k6": "^0.0.0"` (package.json line 138). Use the standalone k6 binary or `npx` in CI instead.

10. **Upgrade Dockerfile** from Node 20 (EOL) to Node 22 LTS.

11. **Fix stale docs:** Update `docs/RELEASE_GUIDE.md` to document the actual GitHub Actions release flow. Update `docs/testing.md` with correct coverage thresholds and correct command (`npm run test:unit -- --coverage`).

12. **Remove `service.ts` references:** `tsconfig.worker.json` line 14 and `eslint.config.js` line 20 reference a non-existent file.

13. **Fix `.gitignore`:** Remove `yarn.lock` from ignore list (project uses npm; this is stale) and remove the overly-broad `Dockerfile.*` glob with negation that's fragile.

## Positive Highlights (keep these)

- Comprehensive test suite: 40 unit + 11 e2e + integration + 4 k6 load scripts
- Coverage gates enforced in CI (branches ≥75%, functions ≥80%, lines ≥85%, statements ≥85%)
- Health endpoint (`api/health.ts` — 187 lines) with timing-safe token comparison, trace IDs, conditional internal checks
- Telemetry endpoint (`api/telemetry.ts`) with origin whitelist, payload validation, size limits
- Rate limiter (`supabase/functions/_shared/rate-limiter.ts`) with fail-closed behavior
- Idempotency middleware for payments
- Security headers everywhere: CSP, HSTS, X-Frame-Options, COOP/COEP/CORP
- Network policies, non-root containers, read-only filesystems in K8s draft
- CodeQL, TruffleHog, and Gitleaks configured in CI
- Dependabot configured
- `WASEL_ENV_DIR` external env loading pattern documented and implemented
- RBAC audit script exists
