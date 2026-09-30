/**
 * Wasel Feature Flags — browser entry point.
 *
 * The flag definitions and evaluation engine live in ./featureFlags/core.ts so
 * the Deno edge bundle can vendor a byte-identical copy of the engine. This
 * module re-exports that engine and adds the client-only surface: React hooks
 * and the window-derived evaluation context.
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  evaluateFeatureFlag,
  evaluateFeatureFlagWithAudit,
  FEATURE_FLAGS,
  type EvaluationContext,
  type EvaluationResult,
  type FeatureFlagKey,
} from './featureFlags/core';

export * from './featureFlags/core';

/**
 * Client-side convenience function - uses auth context automatically.
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return evaluateFeatureFlag(key, getClientContext()).enabled;
}

/**
 * Get client-side evaluation context from auth/state.
 */
function getClientContext(): EvaluationContext {
  if (typeof window !== 'undefined') {
    try {
      const auth = (window as unknown as { __WASEL_AUTH__?: { userId?: string; role?: string } }).__WASEL_AUTH__;
      if (auth) {
        return {
          userId: auth.userId,
          role: auth.role,
        };
      }
    } catch {
      // Ignore
    }
  }
  return {};
}

function getUserMetadata(user: { user_metadata?: Record<string, unknown> } | null): Record<string, unknown> {
  return user?.user_metadata ?? {};
}

export function useFeatureFlag(key: FeatureFlagKey): EvaluationResult {
  const { user, profile } = useAuth();

  const userMeta = getUserMetadata(user);

  const context = useMemo((): EvaluationContext => ({
    userId: user?.id ?? undefined,
    role: profile?.role ?? undefined,
    email: user?.email ?? undefined,
    country: (userMeta.country as string) ?? undefined,
    plan: (userMeta.plan as string) ?? undefined,
    customAttributes: userMeta as Record<string, string>,
  }), [user, profile]);

  return useMemo(() => evaluateFeatureFlagWithAudit(key, context, { environment: 'client' }), [key, context]);
}

export function useFeatureFlagEnabled(key: FeatureFlagKey): boolean {
  const result = useFeatureFlag(key);
  return result.enabled;
}

export function useAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const { user, profile } = useAuth();

  const userMeta = getUserMetadata(user);

  const context = useMemo((): EvaluationContext => ({
    userId: user?.id ?? undefined,
    role: profile?.role ?? undefined,
    email: user?.email ?? undefined,
    country: (userMeta.country as string) ?? undefined,
    plan: (userMeta.plan as string) ?? undefined,
    customAttributes: userMeta as Record<string, string>,
  }), [user, profile]);

  return useMemo(() => {
    const results = FEATURE_FLAGS.map(flag => evaluateFeatureFlagWithAudit(flag.key, context, { environment: 'client' }));
    return Object.fromEntries(results.map(r => [r.flag.key, r.enabled])) as Record<FeatureFlagKey, boolean>;
  }, [context]);
}
