import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState, type ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type * as ReactRouter from 'react-router';

const routerNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useNavigate: () => routerNavigate };
});

import { useIframeSafeNavigate, type SafeNavigate } from '@/hooks/useIframeSafeNavigate';

function Probe({ onRender }: { onRender: (navigate: SafeNavigate) => void }) {
  const navigate = useIframeSafeNavigate();
  const [, setTick] = useState(0);
  onRender(navigate);
  return (
    <button type="button" onClick={() => setTick((t) => t + 1)}>
      rerender
    </button>
  );
}

function renderInRouter(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('useIframeSafeNavigate', () => {
  beforeEach(() => {
    routerNavigate.mockClear();
  });

  it('returns a stable reference across re-renders', () => {
    const seen: SafeNavigate[] = [];
    const utils = renderInRouter(
      <Probe
        onRender={(navigate) => {
          seen.push(navigate);
        }}
      />,
    );

    expect(seen.length).toBeGreaterThan(0);

    act(() => {
      utils.getByRole('button', { name: 'rerender' }).click();
    });
    act(() => {
      utils.getByRole('button', { name: 'rerender' }).click();
    });

    // Regression: an unmemoized closure changed identity on every render, which
    // re-ran any effect listing `navigate` in its dependencies — including the
    // OAuth callback effect that performs the one-time PKCE code exchange.
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('prefixes legacy bare app routes with /app', () => {
    function Go() {
      const navigate = useIframeSafeNavigate();
      return (
        <button type="button" onClick={() => navigate('/my-trips')}>
          go
        </button>
      );
    }

    const utils = renderInRouter(<Go />);
    act(() => {
      utils.getByRole('button', { name: 'go' }).click();
    });

    expect(routerNavigate).toHaveBeenCalledWith('/app/my-trips', undefined);
  });

  it('leaves already-namespaced and external paths alone', () => {
    function Go() {
      const navigate = useIframeSafeNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/app/find-ride')}>app</button>
          <button type="button" onClick={() => navigate('https://example.com')}>ext</button>
        </>
      );
    }

    const utils = renderInRouter(<Go />);
    act(() => {
      utils.getByRole('button', { name: 'app' }).click();
    });
    act(() => {
      utils.getByRole('button', { name: 'ext' }).click();
    });

    expect(routerNavigate).toHaveBeenNthCalledWith(1, '/app/find-ride', undefined);
    expect(routerNavigate).toHaveBeenNthCalledWith(2, 'https://example.com', undefined);
  });
});
