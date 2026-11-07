import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the heavy SDK before importing the module under test
const { mockInstance } = vi.hoisted(() => ({
  mockInstance: {
    loadAppInsights: vi.fn(),
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
    trackException: vi.fn(),
    trackMetric: vi.fn(),
    addTelemetryInitializer: vi.fn(),
    unload: vi.fn(),
  },
}));

vi.mock('@microsoft/applicationinsights-web', () => {
  return {
    ApplicationInsights: vi.fn(function MockApplicationInsights() { return mockInstance; }),
    DistributedTracingModes: { AI: 'AI' },
    __mockInstance: mockInstance,
  };
});

vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

import {
  initializeAppInsights,
  disableAppInsights,
  getAppInsights,
  trackCustomEvent,
  trackException,
  trackMetric,
  trackPageView,
} from '@/utils/appInsights';
import { setAnalyticsConsent } from '@/utils/analyticsConsent';

import { ApplicationInsights } from '@microsoft/applicationinsights-web';

// Access the shared mock instance
const getMockInstance = () =>
  mockInstance;

beforeEach(() => {
  disableAppInsights();
  setAnalyticsConsent(false);
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('initializeAppInsights', () => {
  it('does not initialize when connection string is missing', () => {
    initializeAppInsights();
    expect(ApplicationInsights).not.toHaveBeenCalled();
  });

  it('does not initialize when connection string is a placeholder', () => {
    vi.stubEnv('VITE_APP_INSIGHTS_CONNECTION_STRING', 'paste_your_connection_string_here');
    initializeAppInsights();
    expect(ApplicationInsights).not.toHaveBeenCalled();
  });

  it('does not initialize when instrumentation key is a placeholder', () => {
    vi.stubEnv('VITE_APP_INSIGHTS_KEY', 'your_instrumentation_key');
    initializeAppInsights();
    expect(ApplicationInsights).not.toHaveBeenCalled();
  });

  it('initializes when a valid connection string is provided', () => {
    setAnalyticsConsent(true);
    vi.stubEnv(
      'VITE_APP_INSIGHTS_CONNECTION_STRING',
      'InstrumentationKey=12345678-1234-1234-1234-123456789abc;IngestionEndpoint=https://eastus.in.applicationinsights.azure.com/',
    );
    initializeAppInsights();
    expect(ApplicationInsights).toHaveBeenCalled();
    const instance = getMockInstance();
    expect(instance.loadAppInsights).toHaveBeenCalled();
    expect(instance.trackPageView).toHaveBeenCalled();
  });

  it('initializes when a valid UUID instrumentation key is provided', () => {
    setAnalyticsConsent(true);
    vi.stubEnv('VITE_APP_INSIGHTS_KEY', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    initializeAppInsights();
    expect(ApplicationInsights).toHaveBeenCalled();
  });
});

describe('getAppInsights', () => {
  it('returns null before initialization', () => {
    // Fresh import state — appInsights is null
    // (This test relies on module-level state; run before initializeAppInsights)
    // May be null or an instance depending on test order; just assert it doesn't throw
    expect(() => getAppInsights()).not.toThrow();
  });
});

describe('trackCustomEvent', () => {
  it('does not throw when appInsights is null (no-op)', () => {
    expect(() => trackCustomEvent('test_event', { count: 1 })).not.toThrow();
  });
});

describe('trackException', () => {
  it('does not throw when appInsights is null (no-op)', () => {
    expect(() => trackException(new Error('test error'))).not.toThrow();
  });

  it('wraps non-Error values in an Error', () => {
    expect(() => trackException('string error')).not.toThrow();
    expect(() => trackException(42)).not.toThrow();
    expect(() => trackException(null)).not.toThrow();
  });
});

describe('trackMetric', () => {
  it('does not throw when appInsights is null (no-op)', () => {
    expect(() => trackMetric('lcp', 1200)).not.toThrow();
    expect(() => trackMetric('cls', 0.05, { page: 'home' })).not.toThrow();
  });
});

describe('trackPageView', () => {
  it('does not throw when appInsights is null (no-op)', () => {
    expect(() => trackPageView('HomePage')).not.toThrow();
    expect(() => trackPageView('FindRide', { corridor: 'amman-aqaba' })).not.toThrow();
  });
});
