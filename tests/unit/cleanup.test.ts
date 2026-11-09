import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addEventListenerWithCleanup,
  addEventListenerWithCleanupDocument,
  cleanupLongLivedIntervals,
  cleanupRegistry,
  safeSetInterval,
  safeSetTimeout,
  useCleanup,
} from '@/utils/cleanup';

afterEach(() => {
  vi.useRealTimers();
  cleanupRegistry.runAll();
});

describe('cleanup helpers', () => {
  it('runs and unregisters named cleanup handlers', () => {
    const cleanup = vi.fn();
    cleanupRegistry.register('unit-run', cleanup);

    cleanupRegistry.run('unit-run');
    cleanupRegistry.run('missing');

    expect(cleanup).toHaveBeenCalledOnce();
    expect(cleanupRegistry.getPendingCount()).toBe(0);
  });

  it('runs all cleanups and reports long-lived registrations', () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();
    cleanupRegistry.register('unit-long', cleanup);
    vi.advanceTimersByTime(30_001);

    expect(cleanupRegistry.getLongLived().map(entry => entry.name)).toContain('unit-long');
    cleanupLongLivedIntervals();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(cleanupRegistry.getPendingCount()).toBe(0);
  });

  it('removes registered window and document listeners', () => {
    const windowListener = vi.fn();
    const documentListener = vi.fn();
    const cleanWindow = addEventListenerWithCleanup(window, 'resize', windowListener);
    const cleanDocument = addEventListenerWithCleanupDocument(document, 'visibilitychange', documentListener);

    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('visibilitychange'));
    cleanWindow();
    cleanDocument();
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(windowListener).toHaveBeenCalledOnce();
    expect(documentListener).toHaveBeenCalledOnce();
  });

  it('runs safe timers and composed cleanup callbacks', () => {
    vi.useFakeTimers();
    const intervalCallback = vi.fn();
    const timeoutCallback = vi.fn();
    const intervalId = safeSetInterval(intervalCallback, 100);
    safeSetTimeout(timeoutCallback, 100);
    const group = useCleanup();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const unregisterA = group.addCleanup(cleanupA);
    group.addCleanup(cleanupB);
    unregisterA();
    group.cleanup();
    expect(cleanupA).not.toHaveBeenCalled();
    expect(cleanupB).toHaveBeenCalledOnce();
    const composed = useCleanup();
    composed.runCleanup();

    vi.advanceTimersByTime(100);
    window.clearInterval(intervalId);
    expect(intervalCallback).toHaveBeenCalledOnce();
    expect(timeoutCallback).toHaveBeenCalledOnce();

    const registered = useCleanup();
    registered.addCleanup(() => {
      throw new Error('cleanup failed');
    });
    expect(() => registered.cleanup()).not.toThrow();
  });
});
