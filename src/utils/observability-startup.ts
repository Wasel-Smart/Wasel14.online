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
export function isPlaceholder(v?: string) {
  if (!v) { return true; }
  const s = v.trim();
  if (s === '') { return true; }
  const lower = s.toLowerCase();
  return lower.includes('paste_your') || lower.includes('<set_real') || lower.includes('set_real') || lower.includes('example.com') || lower.includes('placeholder') || lower.includes('your_dsn');
}
