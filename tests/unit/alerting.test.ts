import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { alerting, AlertSeverity, stopAlertingCleanup } from '@/utils/alerting';

afterAll(() => {
  stopAlertingCleanup();
});

afterEach(() => {
  alerting.clearOldAlerts(0);
});

describe('alerting rules and alert lifecycle', () => {
  it('fires each built-in threshold rule when its metric crosses the boundary', () => {
    const timestamp = Date.now();
    alerting.checkMetric({ metric: 'error_rate', value: 0.11, timestamp });
    alerting.checkMetric({ metric: 'api_latency_p95', value: 3_500, timestamp });
    alerting.checkMetric({ metric: 'memory_usage_percent', value: 95, timestamp });
    alerting.checkMetric({ metric: 'booking_success_rate', value: 0.5, timestamp });
    alerting.checkMetric({ metric: 'payment_failure_rate', value: 0.2, timestamp });

    expect(alerting.getAlerts()).toHaveLength(8);
    expect(alerting.getStats().unacknowledged).toBe(8);
  });

  it('evaluates matching rules, observes cooldowns, and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = alerting.subscribe(listener);
    const id = `unit-latency-${Date.now()}`;
    alerting.addRule({
      id,
      name: 'Unit latency',
      metric: id,
      condition: value => value > 10,
      severity: AlertSeverity.WARNING,
      message: 'Latency is high',
      cooldownMs: 60_000,
    });

    alerting.checkMetric({ metric: id, value: 5, timestamp: Date.now() });
    expect(alerting.getAlerts()).toHaveLength(0);
    alerting.checkMetric({ metric: id, value: 20, timestamp: Date.now() });
    alerting.checkMetric({ metric: id, value: 30, timestamp: Date.now() });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      severity: AlertSeverity.WARNING,
      message: 'Latency is high',
      acknowledged: false,
    });
    unsubscribe();
    alerting.removeRule(id);
  });

  it('filters, acknowledges, counts, and clears alerts', () => {
    const id = `unit-error-${Date.now()}`;
    alerting.addRule({
      id,
      name: 'Unit failure',
      metric: id,
      condition: value => value > 0,
      severity: AlertSeverity.ERROR,
      message: 'Failure detected',
      cooldownMs: 0,
    });
    alerting.checkMetric({ metric: id, value: 1, timestamp: Date.now() });

    const alert = alerting.getAlerts({ severity: AlertSeverity.ERROR, limit: 1 })[0];
    expect(alert).toBeDefined();
    if (!alert) {throw new Error('Expected an alert to be recorded');}
    alerting.acknowledgeAlert(alert.id);

    expect(alerting.getAlerts({ acknowledged: true })).toContainEqual(expect.objectContaining({ id: alert.id }));
    expect(alerting.getAlerts({ acknowledged: false })).not.toContainEqual(expect.objectContaining({ id: alert.id }));
    expect(alerting.getStats().bySeverity[AlertSeverity.ERROR]).toBeGreaterThan(0);
    alerting.clearOldAlerts(0);
    expect(alerting.getAlerts()).toHaveLength(0);
    alerting.removeRule(id);
  });
});
