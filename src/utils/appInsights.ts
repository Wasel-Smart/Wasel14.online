/**
 * Application Insights Configuration
 *
 * Sets up Azure Application Insights for performance monitoring, exception tracking,
 * and user analytics. This enables observability for production deployments.
 */

import {
    ApplicationInsights,
    DistributedTracingModes,
} from '@microsoft/applicationinsights-web';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

let appInsights: ApplicationInsights | null = null;

// Unfilled template values shipped in .env/.env.production and in the Vercel
// project. Initialising the SDK with one of these still patches XMLHttpRequest
// and fetch, so the app looks "instrumented" while every beacon fails.
const PLACEHOLDER_MARKERS = [
    'paste_your',
    '_here',
    'set_in_secret_manager',
    'set_local_dev_value',
    'your_connection_string',
    'your_instrumentation_key',
    'example.com',
];

/**
 * A connection string is only usable if it really looks like one:
 * `InstrumentationKey=<guid>` and a region-qualified `<region>.in.applicationinsights.azure.com`
 * host. Anything else is either a placeholder or a paste accident.
 */
function isUsableConnectionString(value: string | undefined): value is string {
    if (!value) { return false; }

    const normalized = value.trim();
    if (!normalized) { return false; }

    const lower = normalized.toLowerCase();
    if (PLACEHOLDER_MARKERS.some(marker => lower.includes(marker))) { return false; }
    if (!lower.includes('instrumentationkey=')) { return false; }

    return /[a-z0-9-]+\.in\.applicationinsights\.azure\.com/i.test(normalized);
}

function isUsableInstrumentationKey(value: string | undefined): value is string {
    if (!value) { return false; }

    const normalized = value.trim();
    if (!normalized) { return false; }

    return !PLACEHOLDER_MARKERS.some(marker => normalized.toLowerCase().includes(marker));
}

export function initializeAppInsights(): void {
    // Prefer connection string (modern); fall back to instrumentation key (legacy).
    const connectionString = import.meta.env.VITE_APP_INSIGHTS_CONNECTION_STRING as string | undefined;
    const instrumentationKey = import.meta.env.VITE_APP_INSIGHTS_KEY as string | undefined;

    const usableConnectionString = isUsableConnectionString(connectionString) ? connectionString : undefined;
    const usableInstrumentationKey =
        !usableConnectionString && isUsableInstrumentationKey(instrumentationKey) ? instrumentationKey : undefined;

    if (!usableConnectionString && !usableInstrumentationKey) {
        if (import.meta.env.DEV) {
            console.warn(
                '[AppInsights] Skipped: VITE_APP_INSIGHTS_CONNECTION_STRING is unset or still a template placeholder.',
            );
        }
        return;
    }

    try {
        appInsights = new ApplicationInsights({
            config: {
                ...(usableConnectionString ? { connectionString: usableConnectionString } : { instrumentationKey: usableInstrumentationKey }),
                enableAutoRouteTracking: true,
                enableAjaxErrorStatusText: true,
                // The SDK otherwise injects `request-id` and `traceparent` on every
                // cross-origin fetch. Supabase Edge Functions reject preflights
                // containing headers outside their allowlist, which turned every
                // auth and profile call into a network failure.
                disableAjaxTracking: true,
                distributedTracingMode: DistributedTracingModes.AI,
                maxAjaxCallsPerView: 500,
                maxMessageLimit: 10000,
                disableExceptionTracking: false,
                loggingLevelConsole: import.meta.env.DEV ? 1 : 0,
            },
        });

        appInsights.loadAppInsights();
        appInsights.trackPageView();

        // Wire real Web Vitals into App Insights as custom metrics.
        onCLS(({ value }) => appInsights?.trackMetric({ name: 'web_vital_CLS', average: value }));
        onFCP(({ value }) => appInsights?.trackMetric({ name: 'web_vital_FCP', average: value }));
        onINP(({ value }) => appInsights?.trackMetric({ name: 'web_vital_INP', average: value }));
        onLCP(({ value }) => appInsights?.trackMetric({ name: 'web_vital_LCP', average: value }));
        onTTFB(({ value }) => appInsights?.trackMetric({ name: 'web_vital_TTFB', average: value }));

        window.addEventListener('unhandledrejection', (event) => {
            if (appInsights) {
                const exception = event.reason instanceof Error
                    ? event.reason
                    : new Error(String(event.reason ?? 'Unhandled promise rejection'));
                appInsights.trackException({ exception, severityLevel: 2 });
            }
        });

        window.addEventListener('error', (event) => {
            if (appInsights) {
                appInsights.trackException({
                    exception: event.error instanceof Error ? event.error : new Error(event.message),
                    severityLevel: 2,
                });
            }
        });

    } catch {
        // Initialization failure is non-fatal; telemetry will be unavailable.
    }
}

export function getAppInsights(): ApplicationInsights | null {
    return appInsights;
}

/**
 * Track custom events for business metrics
 */
export function trackCustomEvent(name: string, properties?: Record<string, string | number>) {
    appInsights?.trackEvent({ name, properties });
}

/**
 * Track page views with custom properties
 */
export function trackPageView(name: string, properties?: Record<string, string | number>) {
    appInsights?.trackPageView({ name, properties });
}

/**
 * Track exceptions
 */
export function trackException(error: Error | unknown, severityLevel: 0 | 1 | 2 | 3 = 2) {
    const exception = error instanceof Error ? error : new Error(String(error));
    appInsights?.trackException({ exception, severityLevel });
}

/**
 * Track performance metrics
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string | number>) {
    appInsights?.trackEvent({
        name: `metric_${name}`,
        properties: {
            value: String(value),
            ...properties,
        },
    });
}
