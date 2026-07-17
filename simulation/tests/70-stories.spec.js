/*
 * Feature: STORIES — client posts a story from the portal home; it broadcasts
 * to the whole location (staff sees it on the Community feed) for 24h.
 */
const { test, expect } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login } = require('../lib/helpers');
const { reportFlow, setScenario, flush } = require('../lib/collector');

test.describe('stories', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('70-stories');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('client creates a story; staff sees and views it', async ({ browser }) => {
    // ── Client posts a text story from home ──
    const client = await newPersona(browser, 'client@story', { mobile: true });
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);

    const createTile = client.page.locator('text=Create').first();
    try {
      await createTile.click({ timeout: 5000 });
    } catch {
      reportFlow('client@story', 'create', 'SIM-GAP: Create story tile not found on portal home.', { simGap: true });
      await client.context.close();
      return;
    }
    await client.page.waitForTimeout(800);
    const input = client.page.locator('input[placeholder*="Type your story" i]');
    if (!(await input.isVisible().catch(() => false))) {
      reportFlow('client@story', 'create', 'Story composer did not open from the Create tile.');
      await client.context.close();
      return;
    }
    await input.fill('SIM_STORY: Crushed my workout today!');
    await client.page.locator('button:has-text("Share to")').click();
    await client.page.waitForTimeout(1500);

    const stories = store.get(creds.gymId, 'hf_stories') || [];
    const mine = stories.find(s => (s.text || '').includes('SIM_STORY'));
    if (!mine) {
      reportFlow('client@story', 'create', 'Story never persisted to hf_stories.');
      await client.context.close();
      return;
    }
    await client.context.close();

    // ── Staff sees it on the Community feed ──
    const staff = await newPersona(browser, 'coach@story');
    if (!(await login(staff.page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken'); return; }
    await staff.page.goto(`/gym/${creds.gymId}/community`);
    await staff.page.waitForTimeout(2000);
    const text = await staff.page.locator('#root').innerText();
    if (!text.includes('SIM_STORY') && !text.includes('Sarah')) {
      reportFlow('coach@story', 'broadcast', "Client's story not visible in the staff Community stories bar.");
    } else {
      // Open the story viewer
      await staff.page.locator('text=SIM_STORY').first().click({ timeout: 5000 }).catch(() => {});
      await staff.page.waitForTimeout(1000);
      const viewer = await staff.page.locator('#root').innerText();
      if (!viewer.includes('SIM_STORY')) {
        reportFlow('coach@story', 'viewer', 'Story viewer did not open/render for staff.');
      }
      // View tracked?
      const after = (store.get(creds.gymId, 'hf_stories') || []).find(s => (s.text || '').includes('SIM_STORY'));
      if (after && !(after.views || []).length) {
        reportFlow('coach@story', 'views', 'Story view was not recorded in views[].');
      }
    }
    await staff.context.close();
  });
});
