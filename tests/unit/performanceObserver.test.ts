import { afterEach, describe, expect, it, vi } from 'vitest';

type VitalMetric = { name: string; value: number; delta: number; id: string };
const mocks = vi.hoisted(() => ({
  vitalCallbacks: new Map<string, (metric: VitalMetric) => void>(),
  observerCallbacks: [] as Array<(list: PerformanceObserverEntryList) => void>,
}));

vi.mock('web-vitals', () => ({
  onCLS: (callback: (metric: VitalMetric) => void) => mocks.vitalCallbacks.set('CLS', callback),
  onFCP: (callback: (metric: VitalMetric) => void) => mocks.vitalCallbacks.set('FCP', callback),
  onINP: (callback: (metric: VitalMetric) => void) => mocks.vitalCallbacks.set('INP', callback),
  onLCP: (callback: (metric: VitalMetric) => void) => mocks.vitalCallbacks.set('LCP', callback),
  onTTFB: (callback: (metric: VitalMetric) => void) => mocks.vitalCallbacks.set('TTFB', callback),
}));

import {
  initPerformanceMonitoring,
  measureRouteChange,
  subscribeToLongTasks,
  subscribeToWebVitals,
} from '@/utils/performanceObserver';

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.vitalCallbacks.clear();
  mocks.observerCallbacks.length = 0;
});

describe('performance observers', () => {
  it('initializes browser observers once and broadcasts web vitals', () => {
    class FakeObserver {
      constructor(callback: (list: PerformanceObserverEntryList) => void) {
        mocks.observerCallbacks.push(callback);
      }
      observe() {}
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver);

    const vitalListener = vi.fn();
    const unsubscribe = subscribeToWebVitals(vitalListener);
    initPerformanceMonitoring();
    initPerformanceMonitoring();

    expect(mocks.vitalCallbacks.size).toBe(5);
    expect(mocks.observerCallbacks).toHaveLength(2);
    mocks.vitalCallbacks.get('LCP')?.({ name: 'LCP', value: 2000, delta: 10, id: 'metric-1' });
    mocks.vitalCallbacks.get('INP')?.({ name: 'INP', value: 900, delta: 5, id: 'metric-2' });
    expect(vitalListener).toHaveBeenCalledWith(expect.objectContaining({ name: 'LCP', rating: 'good' }));
    expect(vitalListener).toHaveBeenCalledWith(expect.objectContaining({ name: 'INP', rating: 'poor' }));
    unsubscribe();

    const longTaskListener = vi.fn();
    const unsubscribeLongTask = subscribeToLongTasks(longTaskListener);

    const task = { duration: 100, startTime: 1, name: 'script', entryType: 'longtask', toJSON: () => ({}) } as PerformanceEntry;
    const shift = { value: 0.2, startTime: 2, entryType: 'layout-shift', toJSON: () => ({}) } as unknown as PerformanceEntry;
    for (const callback of mocks.observerCallbacks) {
      callback({ getEntries: () => [task, shift] } as unknown as PerformanceObserverEntryList);
    }
    expect(longTaskListener).toHaveBeenCalledWith(task);
    unsubscribeLongTask();

    const finishRoute = measureRouteChange('unit-route');
    finishRoute?.();
    expect(() => measureRouteChange('fallback-route')?.()).not.toThrow();
  });
});
