# Edge Function Deployment Split Plan

## Current State
All edge functions are deployed as a single Deno function (`make-server-0b1f4071`).

## Target State
Each bounded context becomes independently deployable:

| Service | Directory | Deploy Command |
|---------|-----------|----------------|
| Booking Service | `supabase/functions/booking-service` | `supabase functions deploy booking-service` |
| Package Service | `supabase/functions/package-service` | `supabase functions deploy package-service` |
| Matching Worker | `supabase/functions/matching-worker` | `supabase functions deploy matching-worker` |
| Wallet Service | `supabase/functions/wallet-service` | `supabase functions deploy wallet-service` |
| Trip Service | `supabase/functions/trip-service` | `supabase functions deploy trip-service` |
| Trust Service | `supabase/functions/trust-service` | `supabase functions deploy trust-service` |
| Mobility Service | `supabase/functions/mobility-service` | `supabase functions deploy mobility-service` |
| Profile Service | `supabase/functions/profile-service` | `supabase functions deploy profile-service` |
| Phone Service | `supabase/functions/phone-service` | `supabase functions deploy phone-service` |
| Outbox Worker | `supabase/functions/outbox-worker` | `supabase functions deploy outbox-worker` |
| CLIQ Payments | `supabase/functions/cliq-payments` | `supabase functions deploy cliq-payments` |
| Stripe Payments | `supabase/functions/stripe-payments-v2` | `supabase functions deploy stripe-payments-v2` |
| GDPR Scheduler | `supabase/functions/gdpr-deletion-scheduler` | `supabase functions deploy gdpr-deletion-scheduler` |
| Webhooks | `supabase/functions/webhooks` | `supabase functions deploy webhooks` |
| Event Broker Proxy | `supabase/functions/event-broker-proxy` | `supabase functions deploy event-broker-proxy` |

## Migration Path
1. Each service already has its own `index.ts` entry point
2. Shared middleware lives in `supabase/functions/_shared/`
3. Deploy services independently as traffic grows
4. `make-server-0b1f4071` remains as fallback during transition
5. Update client service URLs in `src/services/core.ts` to point to individual endpoints
