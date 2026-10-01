import { describe, expect, it } from 'vitest';
import type * as NodeFs from 'node:fs';
import { C, GRAD } from '../../src/utils/wasel-ds';
import { WaselColors, WaselGlass, WaselGradients } from '../../src/tokens/wasel-tokens';

/**
 * Brand-consistency regression tests.
 *
 * Canonical palette (brand/BRAND_GUIDELINES.md):
 *   ink #081D39 · cyan #00E5FF · lime #72C70D · ember #FF8A0B
 */

async function readRepoFile(relativePath: string): Promise<string> {
  // Same computed-specifier trick as tests/setup.ts: a static `node:` import is
  // rewritten by Vite for the jsdom graph and breaks the whole suite.
  const specifier = ['node', 'fs'].join(':');
  const fs = (await import(/* @vite-ignore */ specifier)) as typeof NodeFs;
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, 'utf8');
}

describe('brand tokens (wasel-ds)', () => {
  it('exposes the four canonical brand colours', () => {
    expect(C.brandInk).toBe('#081D39');
    expect(C.brandBlue).toBe('#00E5FF');
    expect(C.brandGreen).toBe('#72C70D');
    expect(C.brandOrange).toBe('#FF8A0B');
  });

  it('uses brand cyan (not the deprecated blue) for borders', () => {
    for (const value of [C.border, C.borderHov, C.borderFaint, C.panel]) {
      expect(value.replace(/\s+/g, '')).toMatch(/^rgba\(0,229,255,/);
    }
  });

  it('contains no deprecated brand colours in any colour token', () => {
    const serialised = JSON.stringify(C).replace(/\s+/g, '').toLowerCase();
    expect(serialised).not.toContain('20,127,228');
    expect(serialised).not.toContain('#58ddff');
    expect(serialised).not.toContain('#147fe4');
  });
});

describe('design tokens (wasel-tokens)', () => {
  it('does not alias gold to a cyan', () => {
    expect(WaselColors.goldLight).not.toBe(C.blueLight);
    expect(WaselColors.goldLight).not.toBe(C.cyanDark);
  });

  it('glass surfaces and gradients stay on the navy/cyan brand palette', () => {
    const glass = JSON.stringify(WaselGlass).replace(/\s+/g, '');
    expect(glass).not.toContain('rgba(24,28,34');
    expect(glass).not.toContain('rgba(19,22,26');

    const gradients = JSON.stringify(WaselGradients).toLowerCase();
    expect(gradients).not.toContain('b88a52');
    expect(gradients).not.toContain('f7f1e8');
    expect(WaselGradients.constellation).toBe(GRAD);
  });
});

describe('first-paint colour consistency', () => {
  it('theme-color, critical.css and --background all use brand ink', async () => {
    const [html, critical, globals] = await Promise.all([
      readRepoFile('index.html'),
      readRepoFile('src/styles/critical.css'),
      readRepoFile('src/styles/globals.css'),
    ]);

    const themeColor = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i)?.[1];
    expect(themeColor?.toLowerCase()).toBe('#081d39');

    const criticalBackgrounds = [...critical.matchAll(/background:\s*(#[0-9a-fA-F]{6})/g)].map(m =>
      m[1]!.toLowerCase(),
    );
    expect(criticalBackgrounds.length).toBeGreaterThan(0);
    for (const bg of criticalBackgrounds) {
      expect(bg).toBe('#081d39');
    }

    expect(globals).toMatch(/--background:\s*#081d39/i);
  });

  it('ships SEO basics and the brand font stylesheet in index.html', async () => {
    const html = await readRepoFile('index.html');

    expect(html).toMatch(/<meta\s+name="description"/i);
    expect(html).toMatch(/<link\s+rel="canonical"/i);
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans/);
    expect(html).toMatch(/family=Cairo/);
  });
});
