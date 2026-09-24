import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const logs = [];
  page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  const requests = [];
  page.on('request', req => requests.push(req.url()));
  const responses = [];
  page.on('response', res => responses.push(res.url() + ' -> ' + res.status()));

  await page.addInitScript(() => {
    localStorage.setItem('wasel-language', 'en');
    localStorage.setItem('wasel_user_session', JSON.stringify({
      id: 'demo-e2e-user', name: 'Demo Rider', email: 'demo.rider@example.test',
      phone: '+96279XXXXXXX', role: 'both', balance: 145.75, rating: 4.8, trips: 18,
      verified: true, sanadVerified: true, verificationLevel: 'level_3', walletStatus: 'active',
      driverStatus: 'approved', joinedAt: '2026-03-01', emailVerified: true, phoneVerified: true,
      twoFactorEnabled: false, trustScore: 92, backendMode: 'local',
    }));
  });

  try {
    await page.goto('http://127.0.0.1:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('=== DOM LOADED ===');
    await page.waitForTimeout(5000);
    console.log('=== waited 5s ===');

    const title = await page.title();
    console.log('Title:', title);

    const headerText = await page.$eval('header', el => el && el.textContent?.substring(0, 300));
    console.log('Header:', headerText);

    const drDemoCount = await page.getByRole('button', { name: /DR Demo/i }).count();
    const signInCount = await page.getByRole('button', { name: /sign in/i }).count();
    console.log('DR Demo buttons:', drDemoCount);
    console.log('Sign in buttons:', signInCount);

    await page.screenshot({ path: 'probe-screenshot.png', fullPage: true });
    console.log('Screenshot saved');
  } catch (e) {
    console.log('=== NAVIGATION ERROR ===');
    console.log(String(e));
    await page.screenshot({ path: 'probe-error.png', fullPage: true });
  }

  console.log('=== CONSOLE LOGS ===');
  logs.slice(0, 80).forEach(l => console.log(l));
  console.log('=== PAGE ERRORS ===');
  errors.slice(0, 30).forEach(e => console.log(e));
  console.log('=== REQUESTS ===');
  requests.slice(0, 80).forEach(r => console.log(r));
  console.log('=== RESPONSES (non-200) ===');
  responses.filter(r => !r.match(/-> 200$/) && !r.match(/-> 304$/)).slice(0, 40).forEach(r => console.log(r));

  await browser.close();
})().catch(e => {
  console.error('SCRIPT ERROR:', e);
  process.exit(1);
});
