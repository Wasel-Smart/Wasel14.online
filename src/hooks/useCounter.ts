import { useState, useRef, useCallback, useEffect } from 'react';

interface CounterState {
  count: number;
  lastUpdated: number;
}

export function useCounter(initialValue = 0) {
  const [state, setState] = useState<CounterState>({ count: initialValue, lastUpdated: 0 });

  const countRef = useRef(initialValue);
  const listenersRef = useRef<Set<(state: CounterState) => void>>(new Set());

  useEffect(() => {
    const id = setTimeout(() => {
      // Reset the ref as well as the rendered state. Leaving countRef untouched
      // makes getRefValue()/increment()/decrement() keep counting from the old
      // value, so they silently disagree with the number on screen.
      countRef.current = initialValue;
      setState({ count: initialValue, lastUpdated: Date.now() });
    }, 0);
    return () => clearTimeout(id);
  }, [initialValue]);

  const increment = useCallback(() => {
    const newCount = countRef.current + 1;
    countRef.current = newCount;
    setState({
      count: newCount,
      lastUpdated: Date.now(),
    });
    listenersRef.current.forEach(listener =>
      listener({ count: newCount, lastUpdated: Date.now() }),
    );
  }, []);

  const decrement = useCallback(() => {
    const newCount = countRef.current - 1;
    countRef.current = newCount;
    setState({
      count: newCount,
      lastUpdated: Date.now(),
    });
    listenersRef.current.forEach(listener =>
      listener({ count: newCount, lastUpdated: Date.now() }),
    );
  }, []);

  const reset = useCallback(
    (value = initialValue) => {
      countRef.current = value;
      setState({
        count: value,
        lastUpdated: Date.now(),
      });
      listenersRef.current.forEach(listener => listener({ count: value, lastUpdated: Date.now() }));
    },
    [initialValue],
  );

  const getState = useCallback(() => state, [state]);
  const getRefValue = useCallback(() => countRef.current, []);

  const subscribe = useCallback((listener: (state: CounterState) => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  return {
    count: state.count,
    lastUpdated: state.lastUpdated,
    increment,
    decrement,
    reset,
    getState,
    getRefValue,
    subscribe,
  };
}

export default useCounter;
