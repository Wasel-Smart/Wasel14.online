import { describe, expect, it } from 'vitest';
import { routeFallback } from '../../src/locales/chunks/routeFallback';
import { translations } from '../../src/locales/translations';

describe('routeFallback copy', () => {
  const enKeys = Object.keys(routeFallback.en).sort();
  const arKeys = Object.keys(routeFallback.ar).sort();

  it('has identical keys in English and Arabic', () => {
    expect(arKeys).toEqual(enKeys);
  });

  it('has no empty strings', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const [key, value] of Object.entries(routeFallback[lang])) {
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('Arabic values are actually Arabic (no untranslated English copy)', () => {
    const arabic = /[\u0600-\u06FF]/;
    for (const [key, value] of Object.entries(routeFallback.ar)) {
      expect(arabic.test(value), key).toBe(true);
    }
  });

  it('is registered in the merged translation table for both languages', () => {
    for (const key of enKeys) {
      expect((translations.en as Record<string, unknown>)[key], `en.${key}`).toBe(
        (routeFallback.en as Record<string, string>)[key],
      );
      expect((translations.ar as Record<string, unknown>)[key], `ar.${key}`).toBe(
        (routeFallback.ar as Record<string, string>)[key],
      );
    }
  });
});
