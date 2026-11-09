import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as MonitoringModule from '../../src/utils/monitoring';

// Mock Sentry before importing monitoring
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  startInactiveSpan: vi.fn(() => ({ end: vi.fn() })),
}));

// Reset module state between tests
let monitoring: typeof MonitoringModule;

describe('monitoring', () => {
  beforeEach(async () => {
    vi.resetModules();
    monitoring = await import('../../src/utils/monitoring');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('skips init when DSN is empty', async () => {
      const { init } = await import('@sentry/react');
      await monitoring.initSentry();
      expect(init).not.toHaveBeenCalled();
    });

    it('skips init when DSN is a placeholder', async () => {
      vi.stubEnv('VITE_SENTRY_DSN', '<SET_REAL_SENTRY_DSN>');
      const { init } = await import('@sentry/react');
      await monitoring.initSentry();
      expect(init).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('does not throw when called multiple times', async () => {
      await expect(monitoring.initSentry()).resolves.toBeUndefined();
      await expect(monitoring.initSentry()).resolves.toBeUndefined();
    });
  });

  describe('logger', () => {
    it('logger.error does not throw', () => {
      expect(() => monitoring.logger.error('test error', new Error('x'))).not.toThrow();
    });

    it('logger.warning does not throw', () => {
      expect(() => monitoring.logger.warning('test warning')).not.toThrow();
    });

    it('logger.info does not throw', () => {
      expect(() => monitoring.logger.info('test info')).not.toThrow();
    });

    it('logger.metric does not throw', () => {
      expect(() => monitoring.logger.metric('api.latency', 120, { status: '200' })).not.toThrow();
    });

    it('logger.addBreadcrumb does not throw', () => {
      expect(() => monitoring.logger.addBreadcrumb('nav', 'navigation')).not.toThrow();
    });

    it('logger.startTransaction returns finish function', () => {
      const txn = monitoring.logger.startTransaction('test-txn', 'test.op');
      expect(txn).toHaveProperty('finish');
      expect(() => txn.finish()).not.toThrow();
    });
  });

  describe('trackAPICall', () => {
    it('does not throw for normal call', () => {
      expect(() => monitoring.trackAPICall('/v1/rides', 'GET', 200, 200)).not.toThrow();
    });

    it('does not throw for slow call (> 3000ms)', () => {
      expect(() => monitoring.trackAPICall('/v1/rides', 'POST', 4000, 200)).not.toThrow();
    });
  });

  describe('trackUserAction', () => {
    it('does not throw', () => {
      expect(() => monitoring.trackUserAction('ride_booked', { rideId: 'r1' })).not.toThrow();
    });
  });

  describe('trackNavigation', () => {
    it('does not throw', () => {
      expect(() => monitoring.trackNavigation('/app', '/app/find-ride')).not.toThrow();
    });
  });

  describe('trackDomainEvent', () => {
    it('does not throw for a valid domain event envelope', () => {
      expect(() =>
        monitoring.trackDomainEvent({
          id: 'evt-1',
          type: 'RideRequested',
          traceId: 'trace-1',
          producer: 'ride-matching-service',
          occurredAt: new Date().toISOString(),
          payload: {} as never,
        }),
      ).not.toThrow();
    });
  });

  describe('usePerformanceMonitoring', () => {
    it('returns a cleanup function', () => {
      const cleanup = monitoring.usePerformanceMonitoring('TestComponent');
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });
  });
});
