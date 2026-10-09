import { test } from '@playwright/test';
import { seedDemoSession } from '../../e2e/helpers/session';

test('debug page state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wasel-language', 'en'));
  await seedDemoSession(page);
  await page.goto('/app/packages', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  const buttons = await page.locator('button').all();
  for (const b of buttons) {
    const text = (await b.textContent())?.trim();
    if (text) {console.log('BTN:', JSON.stringify(text));}
  }
  const bodyText = await page.locator('body').innerText();
  console.log('BODY:', bodyText.substring(0, 800));
});