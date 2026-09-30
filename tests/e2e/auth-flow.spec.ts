import { test, expect } from '@playwright/test';
import { seedDemoSession } from '../../e2e/helpers/session';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wasel-language', 'en'));
});

// The landing hero heading. Keep in sync with HomeHeroSection.tsx.
const LANDING_HEADING = /shared routes that reduce travel cost/i;

// `load` also waits for third-party fonts/images, which can stall for a minute
// on a cold Vite dev server. The title and the heading assertions below are what
// actually prove the app rendered, so wait for DOM content only.
const GOTO = { waitUntil: 'domcontentloaded' } as const;

test('landing page loads and contains Wasel branding @smoke', async ({ page }) => {
  await page.goto('/', GOTO);
  await expect(page).toHaveTitle(/wasel/i);
});

test('unauthenticated /app renders the public landing surface @smoke', async ({ page }) => {
  await page.goto('/app', GOTO);
  await expect(page.getByRole('heading', { name: LANDING_HEADING })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
});

test('auth page renders email and password fields @smoke', async ({ page }) => {
  await page.goto('/app/auth');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  // Use textbox role to avoid matching the "Show password" toggle button
  await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
});

test('submitting empty auth form shows validation feedback', async ({ page }) => {
  await page.goto('/app/auth');
  await page.getByRole('button', { name: /submit sign in/i }).click();
  await expect(page.getByText(/please enter/i).first()).toBeVisible();
});

test('register tab renders create account button', async ({ page }) => {
  await page.goto('/app/auth?tab=register');
  // Actual button aria-label is "Submit sign up", not "Submit create account"
  await expect(page.getByRole('button', { name: /submit sign up/i })).toBeVisible();
});

test('authenticated user receives the signed-in landing surface @smoke', async ({ page }) => {
  await seedDemoSession(page, 'en');
  await page.goto('/app', GOTO);
  await expect(page.getByRole('heading', { name: LANDING_HEADING })).toBeVisible();
  // Use the avatar button which has a stable name "DR Demo"
  await expect(page.getByRole('button', { name: /DR Demo/i })).toBeVisible();
});

test('unknown route renders 404 with navigation link', async ({ page }) => {
  await page.goto('/app/this-route-does-not-exist-xyz');
  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByRole('link', { name: /back|home|wasel/i })).toBeVisible();
});
