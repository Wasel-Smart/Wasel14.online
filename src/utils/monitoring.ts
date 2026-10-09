import type { DomainEventEnvelope } from '../domain/events';
import {
  init as sentryInit,
  addBreadcrumb,
  captureException,
  captureMessage,
  getCurrentScope,
  startInactiveSpan,
  browserTracingIntegration,
  replayIntegration,
} from '@sentry/react';
import { createCorrelationId, createStructuredLogEntry } from '../platform/observability';
import { sanitizeLogMessage } from './sanitization';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type SentryEvent = {
  user?: { id?: string };
  tags?: Record<string, string>;
  [key: string]: unknown;
};

let sentryInitialized = false;
let sentryInitializationStarted = false;

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) { return undefined; }
  return Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, sanitizeLogMessage(v)]),
  );
}

function writeConsole(
  level: 'info' | 'warning' | 'error',
  message: string,
  context?: Record<string, unknown>,
): void {
  const entry = createStructuredLogEntry(
    level,
    sanitizeLogMessage(message),
    'wasel-web',
    sanitizeContext(context),
  );
  const serialized = JSON.stringify(entry);
  const safeOutput = String(serialized).replace(/[\r\n]/g, ' '); // nosec CWE-117

  if (level === 'error') {
    console.error(safeOutput); // nosec CWE-117
    return;
  }
  if (level === 'warning') {
    console.warn(safeOutput); // nosec CWE-117
    return;
  }
  if (import.meta.env.DEV) {
    console.info(safeOutput); // nosec CWE-117
  }
}

export async function initSentry(): Promise<void> {
  if (sentryInitialized || sentryInitializationStarted) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE;

  if (!dsn) {
    if (import.meta.env.DEV) {
      writeConsole('warning', 'Sentry DSN is not configured; remote error capture is disabled.');
    }
    return;
  }

  sentryInitializationStarted = true;

  try {
    const integrations = [
      browserTracingIntegration(),
      replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ];

    sentryInit({
      dsn,
      environment,
      integrations,
      tracesSampleRate: environment === 'production' ? 0.1 : 1,
      replaysSessionSampleRate: environment === 'production' ? 0.05 : 0,
      replaysOnErrorSampleRate: 1.0,
      release: `wasel@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Failed to fetch',
      ],
      beforeSend(event: SentryEvent) {
        try {
          const raw = localStorage.getItem('wasel_local_user_v2');
          if (raw) {
            const userData = JSON.parse(raw) as unknown;
            if (
              userData !== null &&
              typeof userData === 'object' &&
              'id' in (userData as object) &&
              typeof (userData as Record<string, unknown>).id === 'string'
            ) {
              const id = (userData as Record<string, string>).id;
              if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
                event.user = { id };
              }
            }
          }
        } catch {
          // Ignore malformed local state.
        }

        const allowedLanguages = ['ar', 'en'];
        const allowedThemes = ['dark', 'light'];
        const lang = localStorage.getItem('wasel_language') || 'ar';
        const theme = localStorage.getItem('wasel_theme') || 'dark';

        event.tags = {
          ...event.tags,
          language: allowedLanguages.includes(lang) ? lang : 'ar',
          theme: allowedThemes.includes(theme) ? theme : 'dark',
        };

        return event;
      },
    });

    sentryInitialized = true;
    writeConsole('info', 'Sentry initialized.');

    const reportVital = (name: string, value: number) => {
      try {
        getCurrentScope().setMeasurement(name, value, name === 'CLS' ? '' : 'millisecond');
      } catch {
        // setMeasurement may not be available in all environments
      }
      logger.metric(`web_vital.${name}`, value, { name });
    };
    onCLS(({ value }) => reportVital('CLS', value));
    onFCP(({ value }) => reportVital('FCP', value));
    onINP(({ value }) => reportVital('INP', value));
    onLCP(({ value }) => reportVital('LCP', value));
    onTTFB(({ value }) => reportVital('TTFB', value));
  } catch (error) {
    sentryInitializationStarted = false;
    if (import.meta.env.DEV) {
      writeConsole('warning', 'Sentry initialization failed.', { error: sanitizeLogMessage(String(error)) }); // nosec CWE-117
    }
  }
}

export const logger = {
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const safeMessage = sanitizeLogMessage(message);
    writeConsole('error', safeMessage, context);
    if (sentryInitialized) {
      captureException(error || new Error(safeMessage), {
        level: 'error',
        tags: { type: 'application_error' },
        extra: context,
      });
    }
  },

  warning(message: string, context?: Record<string, unknown>): void {
    writeConsole('warning', sanitizeLogMessage(message), context);
    if (import.meta.env.PROD && sentryInitialized) {
      captureMessage(sanitizeLogMessage(message), {
        level: 'warning',
        tags: { type: 'application_warning' },
        extra: context,
      });
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    writeConsole('info', sanitizeLogMessage(message), context);
    if (import.meta.env.PROD && context?.important && sentryInitialized) {
      captureMessage(sanitizeLogMessage(message), {
        level: 'info',
        tags: { type: 'application_info' },
        extra: context,
      });
    }
  },

  metric(name: string, value: number, tags?: Record<string, string>): void {
    const safeName = sanitizeLogMessage(name);
    writeConsole('info', `metric:${safeName}`, { value, tags });
    if (sentryInitialized) {
      addBreadcrumb({
        category: 'metric',
        message: safeName,
        level: 'info',
        data: { value, ...tags },
      });
    }
  },

  startTransaction(name: string, op: string) {
    const requestId = createCorrelationId('txn');
    const startTime = Date.now();
    logger.addBreadcrumb(`Transaction:${sanitizeLogMessage(name)}`, 'performance', { op, requestId });
    if (sentryInitialized) {
      const span = startInactiveSpan({ name: sanitizeLogMessage(name), op });
      return {
        finish: () => {
          span.end();
          logger.metric(`txn.${sanitizeLogMessage(name)}.duration_ms`, Date.now() - startTime);
        },
      };
    }
    return { finish: () => { logger.metric(`txn.${sanitizeLogMessage(name)}.duration_ms`, Date.now() - startTime); } };
  },

  addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    if (sentryInitialized) {
      addBreadcrumb({ message, category, level: 'info', data });
    }
  },
};

export function trackAPICall(
  endpoint: string,
  method: string,
  duration: number,
  status: number,
): void {
  logger.addBreadcrumb(`API ${sanitizeLogMessage(method)} ${sanitizeLogMessage(endpoint)}`, 'api', {
    endpoint: sanitizeLogMessage(endpoint),
    method: sanitizeLogMessage(method),
    duration,
    status,
  });

  logger.metric('api.duration_ms', duration, {
    status: String(status),
  });

  if (duration > 3000) {
    logger.warning(`Slow API call: ${sanitizeLogMessage(method)} ${sanitizeLogMessage(endpoint)}`, {
      duration,
      status,
      endpoint: sanitizeLogMessage(endpoint),
    });
  }
}

export function trackUserAction(action: string, data?: Record<string, unknown>): void {
  logger.addBreadcrumb(action, 'user_action', data);
}

export function trackNavigation(from: string, to: string): void {
  logger.addBreadcrumb(
    `Navigation: ${sanitizeLogMessage(from)} -> ${sanitizeLogMessage(to)}`,
    'navigation',
    { from: sanitizeLogMessage(from), to: sanitizeLogMessage(to) },
  );
}

export function trackDomainEvent(event: DomainEventEnvelope): void {
  logger.addBreadcrumb(`DomainEvent:${event.type}`, 'domain_event', {
    eventId: event.id,
    traceId: event.traceId,
    producer: event.producer,
  });
}

export function usePerformanceMonitoring(componentName: string): () => void {
  const transaction = logger.startTransaction(componentName, 'component.render');
  return () => {
    transaction.finish();
  };
}
