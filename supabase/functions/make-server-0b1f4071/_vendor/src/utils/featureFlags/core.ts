// GENERATED FILE — DO NOT EDIT.
// Vendored from src/utils/featureFlags/core.ts
// by scripts/prepare-edge-bundles.mjs so that this function is a closed,
// self-contained module graph. Edit the source of truth instead.
/**
 * Wasel Feature Flags — isomorphic evaluation engine.
 *
 * This module is the single source of truth for flag definitions and
 * evaluation. It must stay free of React, `window`, and Vite-only globals so
 * that `npm run edge:sync` can vendor a byte-identical copy into the Deno edge
 * bundle. Client-only concerns (React hooks, window context) live in
 * ../featureFlags.ts.
 */

type RuntimeEnvRecord = Record<string, unknown>;

/**
 * Runtime-agnostic environment lookup.
 *
 * Vite replaces `import.meta.env` with a static object, so the first branch is
 * a build-time constant on the client. Deno has no `import.meta.env`, so the
 * lookup falls through to `Deno.env`. Accessing `Deno` through
 * `globalThis` keeps this file type-safe for the browser tsconfig.
 */
export function readRuntimeEnv(key: string): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: RuntimeEnvRecord }).env;
  if (viteEnv) {
    const value = viteEnv[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  const deno = (globalThis as unknown as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
  const fromDeno = deno?.env?.get?.(key);
  return typeof fromDeno === 'string' ? fromDeno : undefined;
}

export type TargetingOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than';

export interface TargetingRule {
  attribute: string;           // e.g., 'userId', 'role', 'country', 'custom.plan'
  operator: TargetingOperator;
  values: string[];            // Values to match against
  weight?: number;             // Optional weight for weighted rollout (0-100)
}

export interface RolloutConfig {
  percentage: number;          // 0-100: percentage of users to enable
  sticky: boolean;             // true = same user always gets same variant (hash-based)
  salt?: string;               // Optional salt for hash consistency across deployments
}

export interface KillSwitch {
  enabled: boolean;            // true = feature is killed globally
  reason?: string;             // Human-readable reason for kill
  killedAt?: string;           // ISO timestamp
  killedBy?: string;           // User/automation that triggered kill
}

export interface FeatureFlagDefinition {
  key: string;
  description: string;
  envKey: string;
  defaultValue: boolean;
  category: 'operational' | 'experimental' | 'integration' | 'ui';

  // --- New targeting/rollout fields ---
  rollout?: RolloutConfig;           // Gradual rollout configuration
  targeting?: TargetingRule[];       // User/role targeting rules (ALL must match)
  killSwitch?: KillSwitch;           // Emergency kill switch
  serverOnly?: boolean;              // true = evaluate only on server (edge functions)
  clientOnly?: boolean;              // true = evaluate only on client (no server sync)
}

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    key: 'twoFactorAuth',
    description: 'Enable two-factor authentication for all users',
    envKey: 'VITE_ENABLE_TWO_FACTOR_AUTH',
    defaultValue: false,
    category: 'operational',
    // Roll out to 25% of users, sticky by userId
    rollout: { percentage: 25, sticky: true, salt: '2fa-v1' },
  },
  {
    key: 'enforceTwoFactorAuth',
    description: 'Require two-factor authentication (cannot be disabled by users)',
    envKey: 'VITE_ENFORCE_TWO_FACTOR_AUTH',
    defaultValue: false,
    category: 'operational',
    // Target only high-privilege roles
    targeting: [
      { attribute: 'role', operator: 'in', values: ['admin', 'finance', 'trust', 'support', 'operator'] },
    ],
  },
  {
    key: 'emailNotifications',
    description: 'Enable email notifications',
    envKey: 'VITE_ENABLE_EMAIL_NOTIFICATIONS',
    defaultValue: true,
    category: 'integration',
  },
  {
    key: 'smsNotifications',
    description: 'Enable SMS notifications',
    envKey: 'VITE_ENABLE_SMS_NOTIFICATIONS',
    defaultValue: true,
    category: 'integration',
  },
  {
    key: 'whatsAppNotifications',
    description: 'Enable WhatsApp notifications',
    envKey: 'VITE_ENABLE_WHATSAPP_NOTIFICATIONS',
    defaultValue: true,
    category: 'integration',
  },
  {
    key: 'demoData',
    description: 'Enable demo data mode',
    envKey: 'VITE_ENABLE_DEMO_DATA',
    defaultValue: false,
    category: 'operational',
    // Target specific users by ID
    targeting: [
      { attribute: 'userId', operator: 'in', values: ['demo-user-1', 'demo-user-2'] },
    ],
  },
  {
    key: 'syntheticTrips',
    description: 'Enable synthetic trip generation',
    envKey: 'VITE_ENABLE_SYNTHETIC_TRIPS',
    defaultValue: false,
    category: 'experimental',
    // 10% rollout for testing
    rollout: { percentage: 10, sticky: true, salt: 'synthetic-v1' },
  },
  {
    key: 'directSupabaseFallback',
    description: 'Allow direct Supabase queries when edge functions are unavailable',
    envKey: 'VITE_ALLOW_DIRECT_SUPABASE_FALLBACK',
    defaultValue: false,
    category: 'operational',
    // Kill switch example - can be toggled in emergency
    killSwitch: { enabled: false, reason: 'Edge functions stable' },
  },
  {
    key: 'captchaAuth',
    description: 'Enable CAPTCHA during authentication',
    envKey: 'VITE_AUTH_CAPTCHA_PROVIDER',
    defaultValue: false,
    category: 'operational',
    // Target specific countries
    targeting: [
      { attribute: 'country', operator: 'in', values: ['SA', 'AE', 'QA'] },
    ],
  },
  // --- New flags for demonstration ---
  {
    key: 'newRideMatchingAlgorithm',
    description: 'Use new ML-based ride matching algorithm',
    envKey: 'VITE_NEW_RIDE_MATCHING_ALGORITHM',
    defaultValue: false,
    category: 'experimental',
    rollout: { percentage: 5, sticky: true, salt: 'matching-v2' },
    targeting: [
      { attribute: 'role', operator: 'equals', values: ['driver'] },
    ],
  },
  {
    key: 'enhancedWalletUI',
    description: 'Enable enhanced wallet dashboard UI',
    envKey: 'VITE_ENHANCED_WALLET_UI',
    defaultValue: false,
    category: 'ui',
    rollout: { percentage: 50, sticky: true },
  },
  {
    key: 'corporateSelfServe',
    description: 'Enable corporate self-serve onboarding',
    envKey: 'VITE_CORPORATE_SELF_SERVE',
    defaultValue: false,
    category: 'operational',
    targeting: [
      { attribute: 'role', operator: 'equals', values: ['corporate'] },
      { attribute: 'plan', operator: 'in', values: ['enterprise', 'pro'] },
    ],
  },
  {
    key: 'busRealTimeTracking',
    description: 'Enable real-time bus tracking on map',
    envKey: 'VITE_BUS_REAL_TIME_TRACKING',
    defaultValue: false,
    category: 'experimental',
    rollout: { percentage: 30, sticky: true, salt: 'bus-tracking-v1' },
  },
  {
    key: 'packageInsurance',
    description: 'Enable package insurance option',
    envKey: 'VITE_PACKAGE_INSURANCE',
    defaultValue: false,
    category: 'integration',
    targeting: [
      { attribute: 'role', operator: 'in', values: ['user', 'corporate', 'package_agent'] },
    ],
  },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]['key'];

/**
 * Context passed to feature flag evaluation.
 * On client: derived from auth state, location, etc.
 * On server: derived from JWT claims, request headers, etc.
 */
export interface EvaluationContext {
  userId?: string;
  role?: string;
  email?: string;
  country?: string;
  plan?: string;
  customAttributes?: Record<string, string>;
  sessionId?: string;
  timestamp?: number;
}

/**
 * Result of feature flag evaluation.
 */
export interface EvaluationResult {
  enabled: boolean;
  flag: FeatureFlagDefinition;
  reason: 'env' | 'default' | 'rollout' | 'targeting' | 'kill_switch' | 'server_only' | 'client_only';
  matchedTargeting?: TargetingRule;
  rolloutBucket?: number;  // 0-99, user's bucket for this flag
}

/**
 * Simple hash function for consistent bucketing.
 * Returns 0-99.
 * @internal Exported for testing
 */
export function hashToBucket(input: string, salt?: string): number {
  let hash = 0;
  const str = salt ? `${salt}:${input}` : input;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Check if a targeting rule matches the context.
 * @internal Exported for testing
 */
export function matchesTargetingRule(rule: TargetingRule, context: EvaluationContext): boolean {
  let value: string | undefined;

  // Handle nested attributes like 'custom.plan'
  if (rule.attribute.startsWith('custom.')) {
    const customKey = rule.attribute.slice(7);
    value = context.customAttributes?.[customKey];
  } else {
    value = (context as Record<string, string | undefined>)[rule.attribute];
  }

  if (value === undefined || value === null) {
    return false;
  }

  const checkValues = rule.values.map(v => v.toLowerCase());
  const checkValue = value.toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return checkValues.includes(checkValue);
    case 'not_equals':
      return !checkValues.includes(checkValue);
    case 'contains':
      return checkValues.some(v => checkValue.includes(v));
    case 'not_contains':
      return !checkValues.some(v => checkValue.includes(v));
    case 'in':
      return checkValues.includes(checkValue);
    case 'not_in':
      return !checkValues.includes(checkValue);
    case 'greater_than':
      return checkValues.some(v => parseFloat(checkValue) > parseFloat(v));
    case 'less_than':
      return checkValues.some(v => parseFloat(checkValue) < parseFloat(v));
    default:
      return false;
  }
}

/**
 * Check if all targeting rules match (AND logic).
 * @internal Exported for testing
 */
export function matchesAllTargeting(rules: TargetingRule[], context: EvaluationContext): boolean {
  return rules.every(rule => matchesTargetingRule(rule, context));
}

/**
 * Read flag value from environment.
 * @internal Exported for testing
 */
export function readEnvFlag(definition: FeatureFlagDefinition): { value: boolean; source: 'env' | 'default' } {
  const raw = readRuntimeEnv(definition.envKey);
  if (typeof raw !== 'string') {
    return { value: definition.defaultValue, source: 'default' };
  }

  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { value: definition.defaultValue, source: 'default' };
  }

  const value = normalized === 'true' || normalized === '1' || normalized === 'yes';
  return { value, source: 'env' };
}

/**
 * Core feature flag evaluation function.
 * Can be used on both client and server (Deno).
 */
export function evaluateFeatureFlag(
  key: FeatureFlagKey,
  context: EvaluationContext = {},
  options: { isServer?: boolean } = {}
): EvaluationResult {
  const flag = FEATURE_FLAGS.find(entry => entry.key === key);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${key}`);
  }

  const { isServer = false } = options;

  // 1. Check kill switch first (highest priority)
  if (flag.killSwitch?.enabled) {
    return {
      enabled: false,
      flag,
      reason: 'kill_switch',
    };
  }

  // 2. Check server/client only restrictions
  if (flag.serverOnly && !isServer) {
    return {
      enabled: false,
      flag,
      reason: 'server_only',
    };
  }
  if (flag.clientOnly && isServer) {
    return {
      enabled: false,
      flag,
      reason: 'client_only',
    };
  }

  // 3. Read from environment
  const { value: envValue, source } = readEnvFlag(flag);

  // If env explicitly set (not default), use it unless targeting/rollout applies
  // Note: env=true + targeting means "enabled by default, but can be targeted"
  // env=false + targeting means "disabled by default, but can be targeted on"
  if (source === 'env' && !flag.targeting && !flag.rollout) {
    return {
      enabled: envValue,
      flag,
      reason: 'env',
    };
  }

  // 4. Check targeting rules (if defined)
  if (flag.targeting && flag.targeting.length > 0) {
    const matches = matchesAllTargeting(flag.targeting, context);
    if (matches) {
      // Targeting matched - return enabled (or envValue if explicitly set)
      return {
        enabled: envValue, // Use env value as base, targeting just gates access
        flag,
        reason: 'targeting',
        matchedTargeting: flag.targeting.find(r => matchesTargetingRule(r, context)),
      };
    }
    // Targeting didn't match - fall through to rollout or default
  }

  // 5. Check rollout (if defined)
  if (flag.rollout && flag.rollout.percentage > 0) {
    const bucketKey = context.userId || context.sessionId || 'anonymous';
    const bucket = hashToBucket(bucketKey, flag.rollout.salt);
    const inRollout = bucket < flag.rollout.percentage;

    return {
      enabled: inRollout,
      flag,
      reason: 'rollout',
      rolloutBucket: bucket,
    };
  }

  // 6. Fall back to environment/default value
  return {
    enabled: envValue,
    flag,
    reason: source,
  };
}

/**
 * Get feature flag with full evaluation result.
 */
export function getFeatureFlag(key: FeatureFlagKey, context?: EvaluationContext): EvaluationResult {
  return evaluateFeatureFlag(key, context);
}

/**
 * Get all enabled feature flags for a context.
 */
export function getEnabledFeatureFlags(context?: EvaluationContext): EvaluationResult[] {
  return FEATURE_FLAGS
    .map(flag => evaluateFeatureFlag(flag.key, context))
    .filter(result => result.enabled);
}

/**
 * Get feature flag description.
 */
export function getFeatureFlagDescription(key: FeatureFlagKey): string {
  const flag = FEATURE_FLAGS.find(entry => entry.key === key);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${key}`);
  }
  return flag.description;
}

/**
 * Get all feature flag definitions (for admin UI).
 */
export function getAllFeatureFlags(): readonly FeatureFlagDefinition[] {
  return FEATURE_FLAGS;
}

/**
 * Kill switch management (for admin/ops).
 * In production, this would persist to a database/Redis.
 */
export const killSwitchStore = new Map<string, KillSwitch>();

export function setKillSwitch(key: FeatureFlagKey, killSwitch: KillSwitch): void {
  const flag = FEATURE_FLAGS.find(f => f.key === key);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${key}`);
  }
  // Update in-memory (in production, persist to DB)
  killSwitchStore.set(key, { ...killSwitch, killedAt: new Date().toISOString() });
  // Note: FEATURE_FLAGS is readonly, so we can't mutate it directly
  // In production, use a mutable config store
}

export function clearKillSwitch(key: FeatureFlagKey): void {
  killSwitchStore.delete(key);
}

export function getKillSwitch(key: FeatureFlagKey): KillSwitch | undefined {
  return killSwitchStore.get(key);
}

/**
 * Audit log entry for feature flag evaluation.
 */
export interface FlagAuditEntry {
  timestamp: string;
  flagKey: FeatureFlagKey;
  context: EvaluationContext;
  result: EvaluationResult;
  environment: 'client' | 'server';
}

/**
 * Log feature flag evaluation for audit/debugging.
 * In production, send to observability backend.
 */
export function auditFlagEvaluation(entry: FlagAuditEntry): void {
  if (readRuntimeEnv('DEV') === 'true' || readRuntimeEnv('MODE') === 'development') {
    console.debug('[FeatureFlag]', entry);
  }
  // In production: send to logging service
  // await fetch('/api/feature-flags/audit', { method: 'POST', body: JSON.stringify(entry) });
}

/**
 * Evaluate with audit logging.
 */
export function evaluateFeatureFlagWithAudit(
  key: FeatureFlagKey,
  context: EvaluationContext = {},
  options: { isServer?: boolean; environment?: 'client' | 'server' } = {}
): EvaluationResult {
  const result = evaluateFeatureFlag(key, context, options);
  auditFlagEvaluation({
    timestamp: new Date().toISOString(),
    flagKey: key,
    context,
    result,
    environment: options.environment || (options.isServer ? 'server' : 'client'),
  });
  return result;
}
