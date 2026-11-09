import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdates } from '../../src/hooks/useOptimisticUpdates';

interface TestData {
  name: string;
  email: string;
  age: number;
}

const makeData = (): TestData => ({ name: 'Alice', email: 'alice@example.com', age: 30 });

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('initialises with provided data', () => {
    const data = makeData();
    const { result } = renderHook(() =>
      useOptimisticUpdates({ data, onUpdate: vi.fn().mockResolvedValue({ error: null }) }),
    );
    expect(result.current.optimisticData).toEqual(data);
    expect(result.current.hasPendingUpdates).toBe(false);
  });

  it('applies optimistic update immediately', async () => {
    const data = makeData();
    const onUpdate = vi.fn().mockResolvedValue({ error: null });
    const { result } = renderHook(() => useOptimisticUpdates({ data, onUpdate }));

    act(() => {
      result.current.applyOptimisticUpdate('name', 'Bob');
    });

    expect(result.current.optimisticData.name).toBe('Bob');
    expect(result.current.isPending('name')).toBe(true);
    expect(result.current.hasPendingUpdates).toBe(true);
  });

  it('clears pending state on successful update', async () => {
    const data = makeData();
    const onUpdate = vi.fn().mockResolvedValue({ error: null });
    const { result } = renderHook(() => useOptimisticUpdates({ data, onUpdate }));

    await act(async () => {
      result.current.applyOptimisticUpdate('name', 'Bob');
      await Promise.resolve();
    });

    expect(result.current.isPending('name')).toBe(false);
    expect(result.current.hasPendingUpdates).toBe(false);
  });

  it('rolls back on update error', async () => {
    const data = makeData();
    const onRollback = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue({ error: new Error('failed') });
    const { result } = renderHook(() =>
      useOptimisticUpdates({ data, onUpdate, onRollback }),
    );

    await act(async () => {
      result.current.applyOptimisticUpdate('name', 'Bob');
      await Promise.resolve();
    });

    expect(result.current.optimisticData.name).toBe('Alice');
    expect(onRollback).toHaveBeenCalledWith('name', 'Alice');
  });

  it('rolls back on update exception', async () => {
    const data = makeData();
    const onRollback = vi.fn();
    const onUpdate = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useOptimisticUpdates({ data, onUpdate, onRollback }),
    );

    await act(async () => {
      result.current.applyOptimisticUpdate('email', 'new@example.com');
      await Promise.resolve();
    });

    expect(result.current.optimisticData.email).toBe('alice@example.com');
    expect(onRollback).toHaveBeenCalledWith('email', 'alice@example.com');
  });

  it('auto-rolls back after rollbackDelay', async () => {
    const data = makeData();
    const onRollback = vi.fn();
    // Never resolves — simulates a hung request
    const onUpdate = vi.fn().mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      useOptimisticUpdates({ data, onUpdate, onRollback, rollbackDelay: 1000 }),
    );

    act(() => {
      result.current.applyOptimisticUpdate('age', 99);
    });

    expect(result.current.optimisticData.age).toBe(99);

    await act(async () => {
      vi.advanceTimersByTime(1001);
    });

    expect(result.current.optimisticData.age).toBe(30);
  });

  it('getPendingUpdate returns the pending update', () => {
    const data = makeData();
    const onUpdate = vi.fn().mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOptimisticUpdates({ data, onUpdate }));

    act(() => {
      result.current.applyOptimisticUpdate('name', 'Charlie');
    });

    const pending = result.current.getPendingUpdate('name');
    expect(pending).toBeDefined();
    expect(pending?.value).toBe('Charlie');
    expect(pending?.field).toBe('name');
  });

  it('isPending returns false for untouched field', () => {
    const data = makeData();
    const onUpdate = vi.fn().mockResolvedValue({ error: null });
    const { result } = renderHook(() => useOptimisticUpdates({ data, onUpdate }));
    expect(result.current.isPending('age')).toBe(false);
  });
});
