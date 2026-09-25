/**
 * Wasel Feature Flags — Deno/Edge Function Entry Point
 *
 * Re-exports from the canonical feature flags implementation.
 * The actual implementation lives in src/utils/featureFlags.ts
 * and is shared between frontend (React) and backend (Deno edge functions).
 *
 * Note: This file imports the TypeScript source directly.
 * In production, you may want to build a separate Deno bundle.
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
  auditFlagEvaluation,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type TargetingRule,
  type TargetingOperator,
  type RolloutConfig,
  type KillSwitch,
  type EvaluationContext,
  type EvaluationResult,
  type FlagAuditEntry,
} from '../src/utils/featureFlags.ts';

// Deno-specific: Server-side context builder
export function buildServerContext(
  jwtClaims: Record<string, unknown>,
  requestHeaders: Headers
): EvaluationContext {
  const customAttributes: Record<string, string> = {};

  // Extract custom claims from JWT
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

// Re-export FEATURE_FLAGS for server-side access
export { FEATURE_FLAGS } from '../src/utils/featureFlags.ts';