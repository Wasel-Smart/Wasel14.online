import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWAInstallPrompt } from '../../src/components/mobile/PWAInstallPrompt';

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows only after the browser reports that installation is available', () => {
    render(<PWAInstallPrompt />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    });

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('hides when the browser reports that the app was installed', () => {
    render(<PWAInstallPrompt />);

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
