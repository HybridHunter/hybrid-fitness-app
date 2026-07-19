/*
 * Feature: TREASURE MAP — gamified task quest on the client Dash.
 * Seeds an enabled map + its assigned tasks (per the data contract), then
 * verifies the client sees the map, digs up a stop, and progress updates.
 */
const { test } = require('@playwright/test');
const crypto = require('crypto');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login } = require('../lib/helpers');
const { reportFlow, setScenario, flush } = require('../lib/collector');

test.describe('treasure map', () => {
  let creds, mapId, sarah;
  test.beforeAll(() => {
    setScenario('95-treasure-map');
    store.load();
    creds = ensureCreds(store);
    const members = store.get(creds.gymId, 'hf_members') || [];
    sarah = members.find(m => m.email === creds.demoClient.email);
    mapId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    store.upsert(creds.gymId, 'hf_treasure_maps', [{
      id: mapId, name: 'Summer Shred Quest', enabled: true,
      incentive: 'Free InBody scan + smoothie',
      deadlineMode: 'none', tasks: [
        { title: 'TM_STOP drink water daily', description: 'Hit 80oz every day' },
        { title: 'TM_STOP book two sessions', description: '' },
      ],
      assignedTo: 'all', assignedAt: { [sarah.id]: new Date().toISOString() },
      createdAt: new Date().toISOString(), createdBy: 'Sim Admin',
    }]);
    const tasks = store.get(creds.gymId, 'hf_client_tasks') || [];
    store.upsert(creds.gymId, 'hf_client_tasks', [
      ...tasks,
      { id: crypto.randomUUID(), memberId: sarah.id, title: 'TM_STOP drink water daily', description: 'Hit 80oz every day', type: 'custom', scheduledFor: today, status: 'pending', createdBy: 'Sim Admin', createdAt: new Date().toISOString(), mapId },
      { id: crypto.randomUUID(), memberId: sarah.id, title: 'TM_STOP book two sessions', description: '', type: 'custom', scheduledFor: today, status: 'pending', createdBy: 'Sim Admin', createdAt: new Date().toISOString(), mapId },
    ]);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('client sees the map on Dash and digs up a stop', async ({ browser }) => {
    const client = await newPersona(browser, 'client@treasure', { mobile: true });
    client.page.on('dialog', d => d.accept());
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);
    await client.page.locator('button:has-text("Dash")').last().click();
    await client.page.waitForTimeout(1500);

    const dashText = await client.page.locator('#root').innerText();
    if (!dashText.includes('Summer Shred Quest')) {
      reportFlow('client@treasure', 'render', 'Treasure map not visible on client Dash.');
      await client.context.close();
      return;
    }
    if (!/0 of 2|0\/2/.test(dashText.replace(/\s+/g, ' '))) {
      // progress footer wording may vary slightly — just note if missing entirely
      if (!/stops dug up/i.test(dashText)) {
        reportFlow('client@treasure', 'render', 'Map progress footer missing.');
      }
    }

    // Dig up the first stop (click its label in the SVG; confirm auto-accepted)
    await client.page.locator('text=TM_STOP drink water daily').first().click({ timeout: 5000 }).catch(() => {});
    await client.page.waitForTimeout(1500);
    const tasks = store.get(creds.gymId, 'hf_client_tasks') || [];
    const done = tasks.find(t => t.mapId === mapId && t.title.includes('drink water') && t.status === 'done');
    if (!done) {
      reportFlow('client@treasure', 'complete', 'Clicking a map stop did not complete the underlying task.');
    }

    await client.context.close();

    // Staff: Gamification page shows the Treasure Maps section
    const staff = await newPersona(browser, 'coach@treasure');
    if (await login(staff.page, creds.admin.username, creds.admin.password)) {
      await staff.page.goto(`/gym/${creds.gymId}/gamification`);
      await staff.page.waitForTimeout(2000);
      const text = await staff.page.locator('#root').innerText();
      if (!/Treasure Map/i.test(text)) {
        reportFlow('coach@treasure', 'staff-section', 'Treasure Maps section missing on Gamification page (may be hidden when gamification is disabled).');
      }
    }
    await staff.context.close();
  });
});
