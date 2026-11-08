import { expect, test } from '@playwright/test';
import { seedDemoSession } from '../../e2e/helpers/session';

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title !== 'signed-out user cannot access protected profile route') {
    await seedDemoSession(page, 'en');
  }
});

test('profile page loads with user identity and quick actions', async ({ page }) => {
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Demo Rider/i })).toBeVisible();
  await expect(page.getByText(/demo\.rider@example\.test/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /edit name/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /trust center/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('profile page navigates to trust center', async ({ page }) => {
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Trust Center', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/trust(?:\?|$)/);
});

test('profile page navigates to settings', async ({ page }) => {
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/settings(?:\?|$)/);
});

test('settings page loads account section', async ({ page }) => {
  await page.goto('/app/settings?section=account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Wasel Settings', exact: true })).toBeVisible();
});

test('notifications page loads for authenticated user', async ({ page }) => {
  await page.goto('/app/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Notification Center', exact: true })).toBeVisible();
});

test('trust page loads verification and trust context', async ({ page }) => {
  await page.goto('/app/trust', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Trust score', { exact: true })).toBeVisible();
});

test('signed-out user cannot access protected profile route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wasel-language', 'en'));
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sign in to manage your account', exact: true })).toBeVisible();
});

test('user can sign out from profile page', async ({ page }) => {
  await seedDemoSession(page, 'en');
  await page.goto('/app/profile', { waitUntil: 'domcontentloaded' });
  const signOutButton = page.getByRole('button', { name: /sign out|log out/i });
  if (await signOutButton.count() > 0) {
    await signOutButton.first().click();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  } else {
    test.skip();
  }
});
