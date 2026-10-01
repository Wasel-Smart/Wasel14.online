import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { PWAInstallPrompt } from './components/mobile/PWAInstallPrompt';
import { AppErrorBoundary } from './components/system/ErrorBoundary';

import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { C, F } from './utils/wasel-ds';

import { validateRuntimeConfiguration } from './utils/env';
import { DEFAULT_QUERY_OPTIONS } from './utils/performance/cacheStrategy';
import { waselRouter } from './router';
import { initSentry, logger as monitoringLogger, trackDomainEvent } from './utils/monitoring';
import { initPerformanceMonitoring } from './utils/performance';
import { warmUpServer } from './services/core';
import { domainEventBus } from './platform/event-bus';

function scheduleWhenIdle(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleCallback = idleWindow.requestIdleCallback(callback, { timeout: 4_000 });
    return () => idleWindow.cancelIdleCallback?.(idleCallback);
  }

  const timeout = window.setTimeout(callback, 2_500);
  return () => window.clearTimeout(timeout);
}

/* ---------------------------
   BRAND TOASTER
   Uses design-system tokens + brand font stack (Plus Jakarta Sans / Cairo)
   and follows the active language direction so Arabic toasts render RTL.
---------------------------*/
function BrandToaster() {
  const { dir } = useLanguage();

  return (
    <Toaster
      position="bottom-center"
      theme="dark"
      dir={dir}
      toastOptions={{
        style: {
          background: C.cardSolid,
          border: '1px solid rgba(0,229,255,0.25)',
          color: C.text,
          fontFamily: F,
        },
      }}
    />
  );
}

/* ---------------------------
   PROVIDERS WRAPPER
---------------------------*/
function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        {children}
        <BrandToaster />
      </AuthProvider>
    </LanguageProvider>
  );
}

/* ---------------------------
   BACKGROUND BOOTSTRAP (NON-BLOCKING)
---------------------------*/
function AppRuntimeCoordinator() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let cancelScheduledWork = () => {};

    const run = async () => {
      try {
        const validation = validateRuntimeConfiguration();

        if (typeof navigator !== 'undefined') {
          if (import.meta.env.DEV) {
            console.info('[Wasel] Online:', navigator.onLine);
          }
        }

        cancelScheduledWork = scheduleWhenIdle(() => {
          void (async () => {
            if (cancelled) {return;}

            try {
              void initSentry();
              initPerformanceMonitoring();

              validation.issues.forEach(issue => {
                if (issue.severity === 'error') {
                  monitoringLogger.error(issue.message);
                } else {
                  monitoringLogger.warning(issue.message);
                }
              });

              warmUpServer();

              const stopEvents = domainEventBus.subscribeAll(event => {
                trackDomainEvent(event);
              });

              cleanup = () => {
                stopEvents?.();
              };
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn('[Runtime deferred tasks failed]', e);
              }
            }
          })();
        });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[Runtime bootstrap failed]', e);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      cancelScheduledWork();
      cleanup?.();
    };
  }, []);

  return null;
}

/* ---------------------------
   QUERY CLIENT (stable instance)
---------------------------*/
const queryClient = new QueryClient({
  defaultOptions: DEFAULT_QUERY_OPTIONS,
});

/* ---------------------------
   ROUTER (isolated from providers)
---------------------------*/
const Router = () => <RouterProvider router={waselRouter} />;

/* ---------------------------
   APP
---------------------------*/
export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Providers */}
        <AppProviders>
          {/* Router stays stable → fixes navigation lag */}
          <Router />
          <AppRuntimeCoordinator />
        </AppProviders>

        <PWAInstallPrompt />
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
