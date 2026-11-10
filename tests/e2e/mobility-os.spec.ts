import { expect, test } from '@playwright/test';
import { seedDemoSession } from '../../e2e/helpers/session';

test.beforeEach(async ({ page }) => {
  await seedDemoSession(page, 'en');
});

function extractSeatAvailability(text: string): number {
  const match = text.match(/(\d+)\s+seats/i);
  if (!match) {
    throw new Error(`Could not parse seats from: ${text}`);
  }
  return Number(match[1]);
}

test('mobility os does not accept a capacity booking before payment is available', async ({ page }) => {
  await page.goto('/app/mobility-os', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  await expect(page.getByRole('heading', { name: /corridor capacity exchange for jordan/i })).toBeVisible();
  await expect(page.getByTestId('mobility-os-runtime-status')).toContainText(
    /(server-backed stream|local fallback runtime)/i,
  );
  await expect(page.getByTestId('mobility-os-selected-instrument')).toContainText(/.+(?:→|←|->).+/);
  await expect(page.getByText(/recent corridor events/i)).toHaveCount(0);
  await expect(page.getByText(/business model/i)).toHaveCount(0);
  await expect(page.getByText(/api and websocket shape/i)).toHaveCount(0);
  await expect(page.getByText(/seriousness, pattern, and operating posture/i)).toHaveCount(0);

  const availability = page.getByTestId('mobility-os-selected-availability');
  const seatsBefore = extractSeatAvailability(await availability.innerText());
  const submit = page.getByTestId('mobility-os-booking-submit');
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/bookings will open when payment authorization and confirmation are available/i)).toBeVisible();
  await expect(availability).toContainText(`${seatsBefore} seats`);
  await expect(page.getByTestId('mobility-os-runtime-chip')).toContainText(
    /(server-backed stream|local fallback runtime)/i,
  );
});
