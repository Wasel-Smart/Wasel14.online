import { beforeEach, describe, expect, it } from 'vitest';
import type * as NodeFs from 'node:fs';
import type * as NodeVm from 'node:vm';

/**
 * Regression tests for /public/initial-locale.js.
 *
 * The script runs synchronously in <head> before the app bundle. Its rule MUST
 * match LanguageProvider (Arabic default; only a saved "en" selects English) and
 * it must set <html lang/dir> before first paint, otherwise Arabic visitors get
 * an LTR flash and a layout flip when React mounts.
 */

async function readPublicFile(relativePath: string): Promise<string> {
  // Same computed-specifier trick as tests/setup.ts: a static `node:` import is
  // rewritten by Vite for the jsdom graph and breaks the whole suite.
  const specifier = ['node', 'fs'].join(':');
  const fs = (await import(/* @vite-ignore */ specifier)) as typeof NodeFs;
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, 'utf8');
}

type LocaleWindow = Window & { __wasel_initial_locale?: string };

async function runInitialLocale(source: string): Promise<void> {
  // `new Function` / `eval` are banned by the lint config, so execute the real
  // script in a vm context seeded with the jsdom globals it touches.
  const specifier = ['node', 'vm'].join(':');
  const vm = (await import(/* @vite-ignore */ specifier)) as typeof NodeVm;
  vm.runInNewContext(source, { window, document, localStorage });
}

describe('initial-locale.js', () => {
  let source = '';

  beforeEach(async () => {
    source = await readPublicFile('public/initial-locale.js');
    localStorage.clear();
    delete (window as LocaleWindow).__wasel_initial_locale;
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('defaults to Arabic / RTL when nothing is stored (matches LanguageProvider)', async () => {
    await runInitialLocale(source);

    expect((window as LocaleWindow).__wasel_initial_locale).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('uses English / LTR only when "en" is explicitly saved', async () => {
    localStorage.setItem('wasel-language', 'en');

    await runInitialLocale(source);

    expect((window as LocaleWindow).__wasel_initial_locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('falls back to Arabic for unknown stored values', async () => {
    localStorage.setItem('wasel-language', 'fr');

    await runInitialLocale(source);

    expect((window as LocaleWindow).__wasel_initial_locale).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
