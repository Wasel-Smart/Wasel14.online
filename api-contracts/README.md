# Wasel API Contracts

OpenAPI 3.0 specifications for all Wasel edge functions.

## Services

| Service | Spec File | Base Path | Description |
|---------|-----------|-----------|-------------|
| Booking Service | `booking-service.openapi.yaml` | `/functions/v1/booking-service` | Trip bookings, cancellations, driver acceptance |
| Trip Service | `trip-service.openapi.yaml` | `/functions/v1/trip-service` | Trip search, creation, management |
| Package Service | `package-service.openapi.yaml` | `/functions/v1/package-service` | Package delivery, tracking, delivery confirmation |
| Wallet Service | `wallet-service.openapi.yaml` | `/functions/v1/wallet-service` | Wallet balance, transactions, PIN, transfers, withdrawals |

## Shared Components

All services share:
- **Authentication**: Bearer token (Supabase JWT)
- **Rate Limiting**: In-memory (general) + DB-backed (sensitive ops)
- **CORS**: Origin validation against allowlist
- **Error Format**: `{ "error": "message" }`
- **Version Header**: `X-Api-Version: v1`

## Rate Limits

| Operation | Tier | Limit | Window |
|-----------|------|-------|--------|
| General API | In-memory | 100 req | 60 sec |
| Wallet withdraw | DB-backed | 3 req | 60 min |
| Wallet send | DB-backed | 10 req | 60 min |
| OTP/Auth | DB-backed | 5 req | 5 min |

## Usage

```bash
# Validate specs
npx @redocly/openapi-cli lint api-contracts/*.openapi.yaml

# Generate TypeScript client
npx openapi-typescript api-contracts/booking-service.openapi.yaml -o src/api/booking-service.ts

# Generate server stubs
npx @openapi-generator/maven-plugin generate -i api-contracts/booking-service.openapi.yaml -g nodejs-express-server
```

## CI Integration

Add to GitHub Actions:
```yaml
- name: Validate OpenAPI specs
  run: npx @redocly/openapi-cli lint api-contracts/*.openapi.yaml

- name: Check breaking changes
  run: npx @redocly/openapi-cli breaking api-contracts/booking-service.openapi.yaml --base=main
```