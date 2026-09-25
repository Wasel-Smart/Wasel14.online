# Legacy Route Migration Map

This document maps legacy routes to their new canonical paths. Used for:
- Redirect configuration (Vercel, APIM, nginx)
- Client-side navigation updates
- SEO migration
- Analytics tracking

## Legacy → New Route Mapping

| Legacy Route | New Route | Status | Notes |
|--------------|-----------|--------|-------|
| `/auth` | `/app/auth` | ✅ Active | Auth flow entry |
| `/dashboard` | `/app` | ✅ Active | Redirects to app shell |
| `/home` | `/app` | ✅ Active | Redirects to app shell |
| `/find-ride` | `/app/find-ride` | ✅ Active | Find rides page |
| `/offer-ride` | `/app/offer-ride` | ✅ Active | Offer rides page |
| `/post-ride` | `/app/offer-ride` | ✅ Active | Alias for offer-ride |
| `/my-trips` | `/app/my-trips` | ✅ Active | User's trips |
| `/booking-requests` | `/app/my-trips?tab=rides` | ✅ Active | Redirects with tab |
| `/live-trip` | `/app/live-trip` | ✅ Active | Live tracking |
| `/routes` | `/app/routes` | ✅ Active | Popular routes |
| `/bus` | `/app/bus` | ✅ Active | Bus booking |
| `/packages` | `/app/packages` | ✅ Active | Package delivery |
| `/awasel/send` | `/app/packages` | ✅ Active | Legacy Awasel brand |
| `/awasel/track` | `/app/packages` | ✅ Active | Legacy Awasel brand |
| `/raje3` | `/app/raje3` | ✅ Active | Return matching |
| `/services/raje3` | `/app/raje3` | ✅ Active | Legacy services prefix |
| `/services/corporate` | `/app/services/corporate` | ✅ Active | Corporate (RBAC: corporate:read) |
| `/services/school` | `/app/services/school` | ✅ Active | School transport (RBAC: school:read) |
| `/innovation-hub` | `/app/innovation-hub` | ✅ Active | Operations (RBAC: operations:read) |
| `/analytics` | `/app/analytics` | ✅ Active | Analytics (RBAC: analytics:read) |
| `/mobility-os` | `/app/mobility-os` | ✅ Active | Mobility OS (RBAC: operations:read) |
| `/ai-intelligence` | `/app/ai-intelligence` | ✅ Active | Operations (RBAC: operations:read) |
| `/wallet` | `/app/wallet` | ✅ Active | Wallet dashboard |
| `/plus` | `/app/plus` | ✅ Active | Wasel Plus |
| `/payments` | `/app/wallet` | ✅ Active | Redirects to wallet |
| `/profile` | `/app/profile` | ✅ Active | User profile |
| `/settings` | `/app/settings` | ✅ Active | User settings |
| `/notifications` | `/app/notifications` | ✅ Active | Notifications center |
| `/driver` | `/app/driver` | ✅ Active | Driver dashboard |
| `/privacy` | `/app/privacy` | ✅ Active | Privacy policy |
| `/terms` | `/app/terms` | ✅ Active | Terms of service |
| `/legal/privacy` | `/app/privacy` | ✅ Active | Redirects to privacy |
| `/legal/terms` | `/app/terms` | ✅ Active | Redirects to terms |
| `/moderation` | `/app/moderation` | ✅ Active | Moderation (RBAC: trust:moderate) |
| `/schedule` | `/app/schedule` | ✅ Active | Schedule management |

## Routes to Deprecate (No Direct Replacement)

| Legacy Route | Reason | Alternative |
|--------------|--------|-------------|
| `/raje3` (old) | Replaced by `/app/raje3` | Use new path |
| `/services/*` prefix | Flattened to `/app/services/*` | Use new paths |

## Redirect Strategy

### Client-Side (React Router)
- Handled by `LEGACY_APP_ALIASES` in `wasel-routes.tsx`
- Uses `RedirectToPreserveQuery` to maintain query params

### Server-Side (Vercel)
```json
// vercel.json redirects
{
  "source": "/find-ride",
  "destination": "/app/find-ride",
  "permanent": false
}
```

### Server-Side (APIM)
```xml
<!-- APIM inbound policy -->
<rewrite-uri template="/app/{path}" copy-unmatched-params="true" />
```

## SEO Considerations

- All legacy routes return 302 (temporary) redirects
- Canonical URLs use `/app/*` pattern
- Update sitemap.xml with new URLs
- Submit new URLs to Google Search Console

## Analytics Tracking

Track legacy route usage:
```typescript
// In RedirectToPreserveQuery component
useEffect(() => {
  trackNavigation(`legacy:${legacyPath}`, `/app${legacyPath}`);
}, []);
```

## Rollback Plan

If issues arise:
1. Revert `LEGACY_APP_ALIASES` to full list
2. Update Vercel redirects
3. Monitor 404s in Sentry
4. Communicate to users via in-app banner

## Last Updated

- Date: 2026-09-25
- Author: Platform Team
- Related PR: #xxx