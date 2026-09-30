/**
 * Wasel Feature Flags — Deno/Edge Function Entry Point (make-server)
 *
 * Re-exports from the canonical feature flag engine.
 * The implementation lives in src/utils/featureFlags/core.ts and is shared
 * between frontend (React) and backend (Deno edge functions).
 *
 * `npm run edge:sync` vendors that module into this function directory and
 * rewrites the specifier below, because `supabase functions deploy` uploads
 * only the files under supabase/functions/make-server-0b1f4071/.
 */

export {
  evaluateFeatureFlag,
  evaluateFeatureFlagWithAudit,
  getFeatureFlag,
  getEnabledFeatureFlags,
  getFeatureFlagDescription,
  getAllFeatureFlags,
  setKillSwitch,
  clearKillSwitch,
  getKillSwitch,
  readRuntimeEnv,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type TargetingRule,
  type TargetingOperator,
  type RolloutConfig,
  type KillSwitch,
  type EvaluationContext,
  type EvaluationResult,
  type FlagAuditEntry,
  FEATURE_FLAGS,
} from '../_vendor/src/utils/featureFlags/core.ts';

import {
  FEATURE_FLAGS,
  evaluateFeatureFlag,
  type EvaluationContext,
  type FeatureFlagKey,
} from '../_vendor/src/utils/featureFlags/core.ts';

// Deno-specific: Server-side context builder
export function buildServerContext(
  jwtClaims: Record<string, unknown>,
  requestHeaders: Headers
): EvaluationContext {
  const customAttributes: Record<string, string> = {};

  if (jwtClaims.custom) {
    for (const [key, value] of Object.entries(jwtClaims.custom as Record<string, unknown>)) {
      customAttributes[key] = String(value);
    }
  }

  return {
    userId: jwtClaims.sub as string,
    role: jwtClaims.role as string,
    email: jwtClaims.email as string,
    country: (jwtClaims.country as string) || requestHeaders.get('x-user-country') || undefined,
    plan: (jwtClaims.plan as string) || requestHeaders.get('x-user-plan') || undefined,
    customAttributes,
    sessionId: requestHeaders.get('x-session-id') || undefined,
    timestamp: Date.now(),
  };
}

// Deno-specific: Middleware for feature flag injection
export function featureFlagsMiddleware(
  context: EvaluationContext,
  flags?: FeatureFlagKey[]
): Record<FeatureFlagKey, boolean> {
  const keys = flags || FEATURE_FLAGS.map(f => f.key) as FeatureFlagKey[];
  const results = keys.map(key => evaluateFeatureFlag(key, context, { isServer: true }));
  return Object.fromEntries(results.map(r => [r.flag.key, r.enabled])) as Record<FeatureFlagKey, boolean>;
}
