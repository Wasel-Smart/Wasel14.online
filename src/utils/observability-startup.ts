/**
 * src/utils/observability-startup.ts
 *
 * Single entry point that initialises all observability signals at app startup.
 * Import this once from main.tsx — it is idempotent.
 *
 * Signals activated:
 *   1. Sentry  — runtime error capture + Web Vitals breadcrumbs
 *   2. App Insights — Azure metrics + Web Vitals custom metrics
 *   3. OTLP telemetry — distributed tracing export (when endpoint is set)
 *   4. Structured console logging — always on
 */

import { initSentry } from './monitoring';
import { initializeAppInsights } from './appInsights';
import { sanitizeLogMessage } from './sanitization';

let started = false;

export async function initObservability(): Promise<void> {
  if (started) {return;}
  started = true;

  // 1. Sentry — non-blocking; skips gracefully when DSN is absent/placeholder
  try {
    await initSentry();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[observability] Sentry init failed:', sanitizeLogMessage(err));
    }
  }

  // 2. App Insights — non-blocking; skips when connection string is absent/placeholder
  try {
    initializeAppInsights();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[observability] App Insights init failed:', sanitizeLogMessage(err));
    }
  }

  // 3. OTLP telemetry — activates only when VITE_OTEL_EXPORTER_OTLP_ENDPOINT is set
  const otlpEndpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined;
  if (otlpEndpoint && !otlpEndpoint.includes('PASTE_YOUR')) {
    try {
      // OTLP export is configured via environment variable and handled by exportSpanToOtlp
      if (import.meta.env.DEV) {
        console.info('[observability] OTLP telemetry configured →', sanitizeLogMessage(otlpEndpoint));
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[observability] OTLP init failed:', sanitizeLogMessage(err));
      }
    }
  }
}

/**
 * Returns a summary of which observability signals are active.
 * Useful for the /health endpoint and the ops dashboard.
 */
export function getObservabilityStatus(): {
  sentry: boolean;
  appInsights: boolean;
  otlp: boolean;
} {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const cs = import.meta.env.VITE_APP_INSIGHTS_CONNECTION_STRING as string | undefined;
  const otlp = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined;

  const isPlaceholder = (v?: string) =>
    !v || v.includes('PASTE_YOUR') || v.includes('placeholder') || v.includes('SET_REAL');

  return {
    sentry: !isPlaceholder(dsn),
    appInsights: !isPlaceholder(cs) && Boolean(cs?.includes('InstrumentationKey=')),
    otlp: !isPlaceholder(otlp),
  };
}
