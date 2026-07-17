/*
 * Persona + navigation helpers shared by all journey specs.
 */
const { attachMocks } = require('./mockBackend');
const { attachCollectors, checkNotBlank } = require('./collector');

/** Create a fresh simulated user: new context with mocks + collectors. */
async function newPersona(browser, persona, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    ...(opts.contextOptions || {}),
  });
  await attachMocks(context, opts);
  const page = await context.newPage();
  attachCollectors(page, persona);
  return { context, page };
}

/** Dismiss the onboarding tour overlay if it's covering the app. */
async function dismissTour(page) {
  try {
    const skip = page.locator('button:has-text("Skip Tour")').first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
    }
  } catch {}
}

/** Log in through the real login form. */
async function login(page, email, password) {
  await page.goto('/login');
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  const submit = page.locator('button[type="submit"]');
  if (await submit.count()) {
    await submit.first().click();
  } else {
    await inputs.nth(1).press('Enter'); // submit the form directly
  }
  // Wait for navigation away from /login (or an error to show)
  await page.waitForTimeout(3000);
  await dismissTour(page);
  return !page.url().includes('/login');
}

/** Visit a gym route and verify it renders. */
async function visitRoute(page, persona, gymId, route) {
  const url = `/gym/${gymId}/${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200); // allow cloud fetches + render
  await dismissTour(page);
  return checkNotBlank(page, persona, url);
}

/** All staff routes defined in src/App.js. */
const STAFF_ROUTES = [
  '', 'coaching', 'business', 'build', 'workouts', 'programs', 'library', 'matrix',
  'members', 'assessments', 'command', 'stations', 'remote-workouts', 'schedule',
  'checkin', 'billing', 'analytics', 'gamification', 'accountability', 'content',
  'shop', 'messages', 'email', 'community', 'classroom', 'events', 'resources',
  'waivers', 'settings', 'automations', 'integrations', 'migration', 'subscription',
  'onboarding', 'feedback', 'help',
];

/** Click a button by visible text if it exists; returns whether it was clicked. */
async function clickIfVisible(page, text, opts = {}) {
  const btn = page.locator(`button:has-text("${text}"), [role="button"]:has-text("${text}")`).first();
  try {
    await btn.waitFor({ state: 'visible', timeout: opts.timeout ?? 3000 });
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(opts.settle ?? 600);
    return true;
  } catch { return false; }
}

/** Fill the first input matching a placeholder fragment. */
async function fillByPlaceholder(page, fragment, value) {
  const input = page.locator(`input[placeholder*="${fragment}" i], textarea[placeholder*="${fragment}" i]`).first();
  try {
    await input.waitFor({ state: 'visible', timeout: 3000 });
    await input.fill(String(value));
    return true;
  } catch { return false; }
}

module.exports = { newPersona, login, visitRoute, clickIfVisible, fillByPlaceholder, dismissTour, STAFF_ROUTES };
