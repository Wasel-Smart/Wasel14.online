/**
 * Performance Monitoring & Core Web Vitals
 *
 * Tracks:
 *  - LCP / CLS / INP / TTFB / FCP (web-vitals npm package)
 *  - Long Tasks (>50ms)
 *  - Layout shifts (CLS contributors)
 *  - Memory pressure (when available)
 *  - Route change timing
 */

import { logger } from './monitoring';

type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB' | 'FCP';

type WebVitalMetric = {
  name: WebVitalName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
};

type LongTaskEntry = PerformanceEntry & {
  duration: number;
  startTime: number;
};

const LCP_THRESHOLDS  = { good: 2500, poor: 4000 };
const CLS_THRESHOLDS  = { good: 0.1,  poor: 0.25 };
const INP_THRESHOLDS  = { good: 200,  poor: 500  };
const TTFB_THRESHOLDS = { good: 800,  poor: 1800 };
const FCP_THRESHOLDS  = { good: 1800, poor: 3000 };
const LONG_TASK_THRESHOLD = 50;

const listeners = new Set<(metric: WebVitalMetric) => void>();
const longTaskListeners = new Set<(task: LongTaskEntry) => void>();

export function subscribeToWebVitals(callback: (metric: WebVitalMetric) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function subscribeToLongTasks(callback: (task: LongTaskEntry) => void): () => void {
  longTaskListeners.add(callback);
  return () => longTaskListeners.delete(callback);
}

function ratingForThreshold(
  value: number,
  thresholds: { good: number; poor: number },
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) { return 'good'; }
  if (value <= thresholds.poor) { return 'needs-improvement'; }
  return 'poor';
}

function emitWebVital(metric: WebVitalMetric) {
  listeners.forEach((listener) => {
    try { listener(metric); } catch (error) {
      logger.error('Web vital listener failed', { error });
    }
  });
}

function initLongTaskObserver() {
  if (typeof PerformanceObserver === 'undefined') { return; }
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const task = entry as LongTaskEntry;
        longTaskListeners.forEach((listener) => {
          try { listener(task); } catch (error) {
            logger.error('Long task listener failed', { error });
          }
        });
        if (task.duration > LONG_TASK_THRESHOLD) {
          logger.warning('Long task detected', {
            duration: task.duration,
            startTime: task.startTime,
            name: task.name,
          });
        }
      });
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    // longtask not supported — fail silently.
  }
}

function initLayoutShiftObserver() {
  if (typeof PerformanceObserver === 'undefined') { return; }
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const entryValue = (entry as PerformanceEntry & { value?: number }).value;
        if (entryValue && entryValue > 0.01) {
          logger.warning('Layout shift detected', {
            value: entryValue,
            startTime: entry.startTime,
          });
        }
      });
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // layout-shift not supported — fail silently.
  }
}

function initMemoryObserver() {
  if (typeof performance === 'undefined' || !('memory' in performance)) { return; }
  const memory = (performance as Performance & {
    memory: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  const usedMB  = memory.usedJSHeapSize  / 1024 / 1024;
  const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
  const ratio   = usedMB / limitMB;
  if (ratio > 0.8) {
    logger.warning('High memory usage detected', {
      usedMB:  Math.round(usedMB),
      limitMB: Math.round(limitMB),
      ratio:   ratio.toFixed(2),
    });
  }
}

let _initialized = false;

export function initPerformanceMonitoring() {
  if (typeof window === 'undefined' || _initialized) { return; }
  _initialized = true;

  initLongTaskObserver();
  initLayoutShiftObserver();
  initMemoryObserver();

  // Import web-vitals from the npm package via dynamic import so it is
  // excluded from the synchronous critical-path bundle.
  // The previous implementation checked `'web-vitals' in window` which is
  // always false — the package is never attached to window — so all five
  // metrics were silently never collected.
  import('web-vitals').then(({ onLCP, onCLS, onINP, onTTFB, onFCP }) => {
    onLCP((m)  => emitWebVital({ name: 'LCP',  value: m.value, rating: ratingForThreshold(m.value, LCP_THRESHOLDS),  delta: m.delta, id: m.id }));
    onCLS((m)  => emitWebVital({ name: 'CLS',  value: m.value, rating: ratingForThreshold(m.value, CLS_THRESHOLDS),  delta: m.delta, id: m.id }));
    onINP((m)  => emitWebVital({ name: 'INP',  value: m.value, rating: ratingForThreshold(m.value, INP_THRESHOLDS),  delta: m.delta, id: m.id }));
    onTTFB((m) => emitWebVital({ name: 'TTFB', value: m.value, rating: ratingForThreshold(m.value, TTFB_THRESHOLDS), delta: m.delta, id: m.id }));
    onFCP((m)  => emitWebVital({ name: 'FCP',  value: m.value, rating: ratingForThreshold(m.value, FCP_THRESHOLDS),  delta: m.delta, id: m.id }));
  }).catch(() => { /* web-vitals unavailable — fail silently */ });
}

export function measureRouteChange(routeName: string) {
  if (typeof performance === 'undefined' || !('mark' in performance)) { return; }
  const startMark = `route-${routeName}-start`;
  const endMark   = `route-${routeName}-end`;
  try {
    performance.mark(startMark);
  } catch {
    return;
  }
  return () => {
    try {
      performance.mark(endMark);
      performance.measure(routeName, startMark, endMark);
      const measures = performance.getEntriesByName(routeName);
      const last = measures[measures.length - 1];
      if (last) {
        logger.info('Route change timing', { route: routeName, duration: last.duration });
      }
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(routeName);
    } catch {
      // Measurement failed — fail silently.
    }
  };
}
