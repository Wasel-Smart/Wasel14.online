import { test, expect } from '@playwright/test';

const BARE_ROUTES = [
  '/bus',
  '/find-ride',
  '/offer-ride',
  '/packages',
  '/mobility-os',
  '/wallet',
  '/profile',
  '/trust',
  '/settings',
  '/schedule',
  '/my-trips',
  '/driver',
  '/notifications',
];

test('bare legacy paths resolve to a real page, not the 404 error card', async ({ page }) => {
  for (const route of BARE_ROUTES) {
    await page.goto(route);
    await page.waitForSelector('#main-content', { timeout: 20000 });
    await page.waitForTimeout(800);
    console.log(`${route} -> ${page.url()}`);
    await expect(page.getByText('This page could not be loaded')).toHaveCount(0);
  }
});

test('every bottom nav tab opens its page', async ({ page }) => {
  await page.goto('/app');
  await page.waitForSelector('nav[aria-label]', { timeout: 20000 });

  const targets = ['Find Ride', 'Offer Ride', 'Packages', 'Bus'];
  for (const label of targets) {
    await page.getByRole('button', { name: label, exact: true }).last().click();
    await page.waitForTimeout(900);
    const url = page.url();
    console.log(`bottom nav ${label} -> ${url}`);
    expect(url).toContain('/app/');
    expect(url).not.toContain('This page');
    await expect(page.getByText('This page could not be loaded')).toHaveCount(0);
  }
});

test('home quick action copy is translated, not raw keys', async ({ page }) => {
  await page.goto('/app');
  await page.waitForSelector('#main-content', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('homeSections.');
  expect(body).not.toContain('busFallbackKicker');
  expect(body).not.toContain('homeHeroSection.');
});
