import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

const PAGES = [
  { name: 'home', url: '/', heading: /Wasel|movement|daily/i },
  { name: 'find-ride', url: '/app/find-ride', heading: /find ride|find a ride|ابحث/i },
  { name: 'offer-ride', url: '/app/offer-ride', heading: /offer ride|اعرض مشوار/i },
  { name: 'wallet', url: '/app/wallet', heading: /wallet|المحفظة/i },
  { name: 'trips', url: '/app/my-trips', heading: /trips|مشاوير/i },
  { name: 'auth', url: '/auth', heading: /sign in|welcome|تسجيل الدخول/i },
];

for (const page of PAGES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`Visual Regression: ${page.name} @${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('matches baseline screenshot', async ({ page: p }) => {
        await p.goto(page.url, { waitUntil: 'domcontentloaded' });
        await expect(p.locator('main').first()).toBeVisible();
        await expect(p.getByRole('heading', { name: page.heading }).first()).toBeVisible();
        await p.waitForTimeout(500);
        await expect(p).toHaveScreenshot(`${page.name}-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
      });
    });
  }
}
