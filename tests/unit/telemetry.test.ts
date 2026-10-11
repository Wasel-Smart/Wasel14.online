import { describe, it, expect } from 'vitest';
import {
  telemetry,
  exportSpanToOtlp,
  trackPageView,
  trackUserAction,
  type TraceSpan,
} from '@/platform/telemetry';

// ─── TelemetryCollector ───────────────────────────────────────────────────────

describe('telemetry.recordMetric', () => {
  it('accepts a metric without throwing', () => {
    expect(() => telemetry.recordMetric('test.metric', 1, 'count', { tag: 'val' })).not.toThrow();
  });

  it('accepts overloaded signature with tags as second arg', () => {
    expect(() => telemetry.recordMetric('test.metric2', 42, { env: 'test' })).not.toThrow();
  });

  it('accepts metric with no tags', () => {
    expect(() => telemetry.recordMetric('test.metric3', 0)).not.toThrow();
  });
});

describe('telemetry.startSpan / endSpan', () => {
  it('startSpan returns a non-empty string spanId', () => {
    const spanId = telemetry.startSpan('test.span');
    expect(typeof spanId).toBe('string');
    expect(spanId.length).toBeGreaterThan(0);
    telemetry.endSpan(spanId, 'ok');
  });

  it('endSpan with ok status does not throw', () => {
    const spanId = telemetry.startSpan('test.span.ok');
    expect(() => telemetry.endSpan(spanId, 'ok')).not.toThrow();
  });

  it('endSpan with error status does not throw', () => {
    const spanId = telemetry.startSpan('test.span.error');
    expect(() => telemetry.endSpan(spanId, 'error')).not.toThrow();
  });

  it('endSpan with unknown spanId does not throw', () => {
    expect(() => telemetry.endSpan('nonexistent-span-id', 'ok')).not.toThrow();
  });

  it('startSpan accepts attributes', () => {
    const spanId = telemetry.startSpan('test.span.attrs', {
      topic: 'rides.requested',
      messageId: 'msg-123',
    });
    expect(typeof spanId).toBe('string');
    telemetry.endSpan(spanId, 'ok');
  });
});

describe('telemetry.recordSLO', () => {
  it('records SLO metrics without throwing', () => {
    expect(() => telemetry.recordSLO('matching-worker', 'process', 150, true)).not.toThrow();
    expect(() => telemetry.recordSLO('payment-worker', 'process', 500, false)).not.toThrow();
  });
});

describe('telemetry.recordAPICall', () => {
  it('records API call metrics without throwing', () => {
    expect(() => telemetry.recordAPICall('/v1/bookings', 'POST', 200, 120)).not.toThrow();
  });

  it('records 5xx errors without throwing', () => {
    expect(() => telemetry.recordAPICall('/v1/rides', 'GET', 500, 50)).not.toThrow();
  });

  it('records 4xx without throwing', () => {
    expect(() => telemetry.recordAPICall('/v1/packages', 'POST', 400, 30)).not.toThrow();
  });
});

describe('telemetry.configure', () => {
  it('accepts configuration without throwing', () => {
    expect(() =>
      telemetry.configure({
        endpoint: 'https://otel.example.com',
        serviceName: 'wasel-web',
        environment: 'test',
      }),
    ).not.toThrow();
  });

  it('accepts minimal configuration', () => {
    expect(() =>
      telemetry.configure({ endpoint: 'https://otel.example.com' }),
    ).not.toThrow();
  });
});

describe('telemetry.stopAutoFlush', () => {
  it('does not throw when called', () => {
    expect(() => telemetry.stopAutoFlush()).not.toThrow();
  });
});

// ─── exportSpanToOtlp ─────────────────────────────────────────────────────────

describe('exportSpanToOtlp', () => {
  it('returns without throwing when OTEL endpoint is not configured', async () => {
    const span: TraceSpan = {
      traceId: 'trace-abc123',
      spanId: 'span-def456',
      name: 'test.operation',
      startTime: Date.now() - 100,
      endTime: Date.now(),
      attributes: { service: 'wasel-web', env: 'test' },
      status: 'ok',
    };
    await expect(exportSpanToOtlp(span)).resolves.toBeUndefined();
  });

  it('handles span with error status', async () => {
    const span: TraceSpan = {
      traceId: 'trace-err',
      spanId: 'span-err',
      name: 'failing.operation',
      startTime: Date.now() - 50,
      endTime: Date.now(),
      attributes: {},
      status: 'error',
    };
    await expect(exportSpanToOtlp(span)).resolves.toBeUndefined();
  });

  it('handles span with parentSpanId', async () => {
    const span: TraceSpan = {
      traceId: 'trace-parent',
      spanId: 'span-child',
      parentSpanId: 'span-parent',
      name: 'child.operation',
      startTime: Date.now() - 10,
      endTime: Date.now(),
      attributes: {},
      status: 'ok',
    };
    await expect(exportSpanToOtlp(span)).resolves.toBeUndefined();
  });
});

// ─── trackPageView / trackUserAction ─────────────────────────────────────────

describe('trackPageView', () => {
  it('records without throwing', () => {
    expect(() => trackPageView('/app/find-ride')).not.toThrow();
    expect(() => trackPageView('/app/packages')).not.toThrow();
  });
});

describe('trackUserAction', () => {
  it('records without throwing', () => {
    expect(() => trackUserAction('book_ride', { corridor: 'amman-aqaba' })).not.toThrow();
    expect(() => trackUserAction('send_package')).not.toThrow();
  });
});
