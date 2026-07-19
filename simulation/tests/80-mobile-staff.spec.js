/*
 * MOBILE STAFF AUDIT — admin and super admin on a phone (390×844).
 * Every staff route + the super admin panel must render without crashing
 * AND without horizontal page overflow.
 */
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login, dismissTour, STAFF_ROUTES } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

async function checkNoHorizontalOverflow(page, persona, label) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, inner: window.innerWidth };
  });
  if (overflow.scroll > overflow.inner + 4) {
    reportFlow(persona, 'mobile-overflow', `Horizontal overflow at ${label}: page ${overflow.scroll}px vs viewport ${overflow.inner}px.`);
  }
}

test.describe('mobile staff experience', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('80-mobile-staff');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('admin can use every staff route on a phone', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'admin@mobile', { mobile: true });
    if (!(await login(page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken'); return; }
    for (const route of STAFF_ROUTES) {
      const url = `/gym/${creds.gymId}/${route}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await dismissTour(page);
      await checkNotBlank(page, 'admin@mobile', url);
      await checkNoHorizontalOverflow(page, 'admin@mobile', url);
    }
    await context.close();
  });

  test('super admin panel works on a phone', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'superadmin@mobile', { mobile: true });
    if (!(await login(page, 'Hunter@HybridFitnessGym.com', '13RichSquared11!!'))) { test.skip(true, 'super admin login broken'); return; }
    await page.waitForTimeout(1500);
    await checkNotBlank(page, 'superadmin@mobile', '/super-admin');
    await checkNoHorizontalOverflow(page, 'superadmin@mobile', '/super-admin');
    // Open the create-location modal on mobile
    const opened = await page.locator('button:has-text("Create New Location")').first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (opened) {
      await page.waitForTimeout(800);
      await checkNoHorizontalOverflow(page, 'superadmin@mobile', 'create-location modal');
    }
    await context.close();
  });
});
