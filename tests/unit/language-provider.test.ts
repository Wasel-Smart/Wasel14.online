import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from '../../src/contexts/LanguageContext';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(LanguageProvider, null, children);

const flushStorageWrite = () => new Promise(resolve => setTimeout(resolve, 10));

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('defaults to Arabic / RTL and applies it to <html>', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('ar');
    expect(result.current.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('starts in English only when "en" was saved', () => {
    localStorage.setItem('wasel-language', 'en');

    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(result.current.dir).toBe('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('toggleLanguage flips language, direction, <html> attributes and persists', async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.toggleLanguage();
    });

    expect(result.current.language).toBe('en');
    expect(result.current.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    await flushStorageWrite();
    expect(localStorage.getItem('wasel-language')).toBe('en');

    act(() => {
      result.current.toggleLanguage();
    });

    expect(result.current.language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('t() returns the key itself when no translation exists in either language', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    expect(result.current.t('definitely.not.a.real.key')).toBe('definitely.not.a.real.key');
  });

  it('useLanguage throws outside the provider', () => {
    expect(() => renderHook(() => useLanguage())).toThrow(/LanguageProvider/);
  });
});
