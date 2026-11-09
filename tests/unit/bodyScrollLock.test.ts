import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockBodyScroll, resetBodyScrollLock } from '@/utils/bodyScrollLock';

function setStandaloneMode(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches })),
  });
}

afterEach(() => {
  resetBodyScrollLock();
  setStandaloneMode(false);
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  const root = document.getElementById('root');
  if (root) {
    root.style.overflow = '';
    root.style.paddingRight = '';
    root.remove();
  }
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
});

describe('body scroll locks', () => {
  it('supports nested locks and restores prior body styles once all locks release', () => {
    setStandaloneMode(false);
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 900 });
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '4px';

    const releaseFirst = lockBodyScroll();
    const releaseSecond = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('124px');

    releaseFirst();
    expect(document.body.style.overflow).toBe('hidden');
    releaseSecond();
    releaseSecond();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingRight).toBe('4px');
  });

  it('locks the app root in standalone mode and can hard-reset leaked locks', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.style.overflow = 'auto';
    document.body.appendChild(root);
    setStandaloneMode(true);

    const release = lockBodyScroll();
    expect(root.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('');
    resetBodyScrollLock();
    expect(root.style.overflow).toBe('auto');
    release();
  });

  it('recognizes the platform standalone flag', () => {
    setStandaloneMode(false);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    const release = lockBodyScroll();
    expect(root.style.overflow).toBe('hidden');
    release();
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
  });
});
