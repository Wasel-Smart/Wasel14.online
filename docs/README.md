# Docs Index

This folder is the engineering handoff for Wasel: architecture, contracts, observability, testing, and release operations.

## Core platform docs

- [architecture.md](./architecture.md): bounded contexts, target topology, events, lifecycle states, and deployment posture
- [api-contract.md](./api-contract.md): versioning, response envelope, RBAC, and service surface
- [security-and-identity.md](./security-and-identity.md): auth posture, abuse controls, and secrets handling
- [observability.md](./observability.md): logs, metrics, tracing, SLOs, and failure triage
- [reliability-slos.md](./reliability-slos.md): service objectives, alert thresholds, and error-budget rules
- [scaling-and-tradeoffs.md](./scaling-and-tradeoffs.md): architectural rationale and scale assumptions
- [workers-and-queues.md](./workers-and-queues.md): async topology, queue ownership, and worker responsibilities
- [WIRING_ARCHITECTURE.md](./WIRING_ARCHITECTURE.md): connection points, fallback strategy, and environment configuration
- [testing.md](./testing.md): local verification and test-layer guidance
- [openapi/wasel-v1.yaml](./openapi/wasel-v1.yaml): OpenAPI scaffold for backend implementation and review

## Release and operations

- [READINESS_SCORECARD.md](./READINESS_SCORECARD.md): current readiness scores and the evidence needed to raise each one
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md): preview, staging and production release path
- [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md): incident response, rollback, maintenance
- [PRODUCTION_CUTOVER_CHECKLIST.md](./PRODUCTION_CUTOVER_CHECKLIST.md)
- [PRODUCTION_OPERATIONS_CHECKLIST.md](./PRODUCTION_OPERATIONS_CHECKLIST.md)
- [LAUNCH_REHEARSAL_CHECKLIST.md](./LAUNCH_REHEARSAL_CHECKLIST.md)
- [COMMUNICATIONS_DELIVERY_RUNBOOK.md](./COMMUNICATIONS_DELIVERY_RUNBOOK.md)
- [CREDENTIAL_ROTATION_GUIDE.md](./CREDENTIAL_ROTATION_GUIDE.md): the single rotation guide; tick items in `../SECURITY_CHECKLIST.md`
- [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)
- [oauth-setup-guide.md](./oauth-setup-guide.md) and [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)
- [VERCEL_ENV_AUTH_CHECKLIST.md](./VERCEL_ENV_AUTH_CHECKLIST.md)

## Product and test references

- [MOCK_ENGINE_LAUNCH_PACK.md](./MOCK_ENGINE_LAUNCH_PACK.md)
- [REAL_USER_TEST_MATRIX.md](./REAL_USER_TEST_MATRIX.md)

## Archive

Older point-in-time reports and duplicates live in [archive/](./archive/README.md).

## Suggested reading order

1. [architecture.md](./architecture.md)
2. [api-contract.md](./api-contract.md)
3. [security-and-identity.md](./security-and-identity.md)
4. [observability.md](./observability.md)
5. [testing.md](./testing.md)
6. [READINESS_SCORECARD.md](./READINESS_SCORECARD.md)
