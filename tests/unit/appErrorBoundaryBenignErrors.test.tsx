/**
 * tests/unit/appErrorBoundaryBenignErrors.test.tsx
 *
 * Regression coverage for the AppErrorBoundary re-throw loop.
 *
 * Previously getDerivedStateFromError returned `{ hasError: false }` for the
 * four benign cross-origin iframe / postMessage abort patterns. That makes
 * React re-render the exact children that just threw, so a recurring abort
 * re-threw forever and froze the app. Benign noise is now absorbed upstream by
 * installBenignRuntimeErrorFilter() (window capture-phase 'error' +
 * 'unhandledrejection'), and the boundary treats anything it still sees as a
 * real error.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  AppErrorBoundary,
  installBenignRuntimeErrorFilter,
  isBenignRuntimeError,
} from '@/components/system/ErrorBoundary';

const BENIGN_MESSAGE = 'message port was destroyed';

// Upper bound on how often the child is allowed to throw. The child stops
// throwing once the cap is reached so a regressed (looping) boundary fails the
// assertion instead of hanging the test run forever.
const MAX_THROWS = 25;

// A counter object rather than a module-level binding: the child has to bump it
// during render, which is exactly what the loop-counting test needs to observe.
class ThrowCounter {
  count = 0;

  next(): number {
    this.count += 1;
    return this.count;
  }
}

function Thrower({ counter, message }: { counter: ThrowCounter; message: string }) {
  if (counter.next() <= MAX_THROWS) {
    throw new Error(message);
  }
  return <div data-testid="survived">survived</div>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppErrorBoundary benign cross-frame errors', () => {
  it('does not re-render children in a loop when a benign error is thrown', () => {
    // React logs every caught render error; silence it for this assertion.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const counter = new ThrowCounter();

    const { queryByTestId } = render(
      <AppErrorBoundary>
        <Thrower counter={counter} message={BENIGN_MESSAGE} />
      </AppErrorBoundary>,
    );

    // The recovery UI is shown instead of the children.
    expect(queryByTestId('survived')).toBeNull();

    // React renders the children one extra time while it recovers from the
    // caught error, so 2 is the floor. The point is that the count is bounded
    // by React's own recovery pass — on the old code it climbed to
    // MAX_THROWS, which is the loop.
    expect(counter.count).toBeLessThanOrEqual(2);
  });

  it('treats a real error as a real error and renders the recovery UI', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const counter = new ThrowCounter();

    const { getByRole } = render(
      <AppErrorBoundary>
        <Thrower counter={counter} message="Something genuinely broke" />
      </AppErrorBoundary>,
    );

    expect(counter.count).toBeLessThanOrEqual(2);
    expect(getByRole('button').textContent).toBeTruthy();
  });
});

describe('isBenignRuntimeError', () => {
  it.each([
    'IframeMessageAbortError',
    'message port was destroyed',
    'Message aborted',
    'setupMessageChannel',
  ])('recognises %s as benign', (message) => {
    expect(isBenignRuntimeError(new Error(message))).toBe(true);
    expect(isBenignRuntimeError(message)).toBe(true);
  });

  it('does not treat ordinary failures as benign', () => {
    expect(isBenignRuntimeError(new Error('TypeError: Failed to fetch'))).toBe(false);
  });
});

describe('installBenignRuntimeErrorFilter', () => {
  it('stops benign window errors from propagating and prevents their default', () => {
    const uninstall = installBenignRuntimeErrorFilter();
    try {
      const downstream = vi.fn();
      window.addEventListener('error', downstream);

      const child = document.createElement('div');
      document.body.appendChild(child);
      const benign = new ErrorEvent('error', {
        message: BENIGN_MESSAGE,
        cancelable: true,
        bubbles: true,
      });

      child.dispatchEvent(benign);

      expect(benign.defaultPrevented).toBe(true);
      expect(downstream).not.toHaveBeenCalled();

      window.removeEventListener('error', downstream);
      child.remove();
    } finally {
      uninstall();
    }
  });

  it('leaves non-benign window errors untouched', () => {
    const uninstall = installBenignRuntimeErrorFilter();
    try {
      const child = document.createElement('div');
      document.body.appendChild(child);
      const real = new ErrorEvent('error', {
        message: 'TypeError: Failed to fetch',
        cancelable: true,
        bubbles: true,
      });

      child.dispatchEvent(real);

      expect(real.defaultPrevented).toBe(false);

      child.remove();
    } finally {
      uninstall();
    }
  });

  it('prevents unhandled rejections with benign reasons', () => {
    const uninstall = installBenignRuntimeErrorFilter();
    try {
      const event = new Event('unhandledrejection', { cancelable: true }) as Event & {
        reason?: unknown;
      };
      event.reason = new Error('Message aborted');

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    } finally {
      uninstall();
    }
  });

  it('stops absorbing after teardown', () => {
    const uninstall = installBenignRuntimeErrorFilter();
    uninstall();

    const child = document.createElement('div');
    document.body.appendChild(child);
    const benign = new ErrorEvent('error', {
      message: BENIGN_MESSAGE,
      cancelable: true,
      bubbles: true,
    });

    child.dispatchEvent(benign);

    expect(benign.defaultPrevented).toBe(false);
    child.remove();
  });
});
