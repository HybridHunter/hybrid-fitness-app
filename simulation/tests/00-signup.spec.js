/*
 * Persona: PROSPECT → new gym owner.
 * Journey: landing page → register → 4-step signup → gym created.
 * Then: try to log in as that new admin from a *fresh browser* (new device),
 * which is what a real customer would do.
 */
const { test, expect } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { newPersona, login } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

test.describe('signup journey', () => {
  test.beforeAll(() => setScenario('00-signup'));
  test.afterAll(() => { flush(); store.save(); });

  test('prospect signs up and new admin can log in from a fresh device', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'prospect');

    // Landing page renders
    await page.goto('/landing');
    await checkNotBlank(page, 'prospect', '/landing');

    // Signup wizard
    await page.goto('/register');
    await checkNotBlank(page, 'prospect', '/register');

    // Step 1 — gym info
    await page.locator('input[placeholder*="CrossFit" i]').fill('Signup Test Gym');
    await page.locator('input[placeholder*="owner@" i]').fill('owner@signuptest.io');
    await page.locator('button:has-text("Next")').click();

    // Step 2 — admin account
    await page.locator('input[placeholder*="John Smith" i]').fill('Signup Admin');
    await page.locator('input[placeholder*="johnsmith" i]').fill('signupadmin');
    const pws = page.locator('input[type="password"]');
    await pws.nth(0).fill('signup123');
    await pws.nth(1).fill('signup123');
    await page.locator('button:has-text("Next")').click();

    // Step 3 — plan (professional preselected)
    await page.locator('button:has-text("Next")').click();

    // Step 4 — confirm
    await page.locator('button:has-text("Create My Gym")').click();
    await expect(page.locator('text=Your Gym is Ready!')).toBeVisible({ timeout: 15000 });

    // Extract the created gym id from the success screen
    const gymId = (await page.locator('span[style*="monospace"]').first().innerText()).trim();
    expect(gymId).toBeTruthy();

    // Inspect what signup actually wrote to the backend
    const users = store.get(gymId, 'hf_users');
    if (typeof users === 'string') {
      reportFlow('prospect', 'signup', `CRITICAL: signup wrote hf_users for ${gymId} as a JSON *string* (double-stringified), not an array. Cross-device login and super-admin listing will not recognize this gym's users.`);
    }
    const registry = store.get('__super__', 'hf_gyms_registry');
    if (typeof registry === 'string') {
      reportFlow('prospect', 'signup', 'CRITICAL: signup wrote __super__/hf_gyms_registry as a JSON string — registry consumers expecting an array will break.');
    }

    await context.close();

    // New device: fresh context, same backend — can the new admin log in?
    const fresh = await newPersona(browser, 'new-admin-fresh-device');
    const ok = await login(fresh.page, 'signupadmin', 'signup123');
    if (!ok) {
      reportFlow('new-admin-fresh-device', 'login-after-signup', 'Admin created via public signup CANNOT log in from a fresh device (login falls through all lookups).');
    } else {
      await checkNotBlank(fresh.page, 'new-admin-fresh-device', 'post-login home');
    }
    await fresh.context.close();
  });
});
