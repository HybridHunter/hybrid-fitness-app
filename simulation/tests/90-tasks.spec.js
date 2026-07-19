/*
 * Feature: CLIENT TASKS.
 * Coach assigns a custom task + a community-engagement task from the member
 * profile. Client sees both on Dash (with nav badge), completes the custom
 * one, and the community task auto-completes when they make a post.
 */
const { test, expect } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

test.describe('client tasks', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('90-tasks');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('coach assigns tasks; client completes them on Dash', async ({ browser }) => {
    const members = store.get(creds.gymId, 'hf_members') || [];
    const sarah = members.find(m => m.email === creds.demoClient.email);
    expect(sarah, 'demo client exists').toBeTruthy();

    // ── Staff: assign a custom task and a community task ──
    const staff = await newPersona(browser, 'coach@tasks');
    if (!(await login(staff.page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken'); return; }
    await staff.page.goto(`/gym/${creds.gymId}/members/${sarah.id}`);
    await staff.page.waitForTimeout(1500);
    await staff.page.locator('button:has-text("Tasks")').first().click();
    await staff.page.waitForTimeout(800);

    // Custom task
    await staff.page.locator('button:has-text("+ Assign Task")').click();
    await staff.page.waitForTimeout(500);
    await staff.page.locator('input[placeholder="e.g. Watch your form video"]').fill('SIM_TASK drink 80oz water');
    await staff.page.locator('button', { hasText: /^Assign Task$/ }).click();
    await staff.page.waitForTimeout(1200);

    // Community engagement task
    await staff.page.locator('button:has-text("+ Assign Task")').click();
    await staff.page.waitForTimeout(500);
    await staff.page.locator('input[placeholder="e.g. Watch your form video"]').fill('SIM_TASK share your win');
    // Switch type to community post
    const typeSelect = staff.page.locator('select').filter({ hasText: 'Custom' }).first();
    await typeSelect.selectOption({ label: /communit/i }).catch(async () => {
      await typeSelect.selectOption('community_post').catch(() => {});
    });
    await staff.page.locator('textarea[placeholder="What should they post about?"]').fill('Post about your biggest win this week').catch(() => {});
    await staff.page.locator('button', { hasText: /^Assign Task$/ }).click();
    await staff.page.waitForTimeout(1500);

    const tasks = store.get(creds.gymId, 'hf_client_tasks') || [];
    const custom = tasks.find(t => t.title.includes('drink 80oz'));
    const community = tasks.find(t => t.title.includes('share your win'));
    if (!custom) reportFlow('coach@tasks', 'assign', 'Custom task did not persist to hf_client_tasks.');
    if (!community) reportFlow('coach@tasks', 'assign', 'Community task did not persist.');
    else if (community.type !== 'community_post') reportFlow('coach@tasks', 'assign', `Community task saved with wrong type "${community.type}".`);
    await staff.context.close();
    if (!custom) return;

    // ── Client: sees tasks on Dash, completes them ──
    const client = await newPersona(browser, 'client@tasks', { mobile: true });
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);
    await client.page.locator('button:has-text("Dash")').last().click();
    await client.page.waitForTimeout(1500);

    const dashText = await client.page.locator('#root').innerText();
    if (!dashText.includes('SIM_TASK drink 80oz water')) {
      reportFlow('client@tasks', 'dash-list', 'Assigned task not visible on the client Dash.');
      await client.context.close();
      return;
    }

    // Complete the custom task
    await client.page.locator('button:has-text("Mark Done")').first().click();
    await client.page.waitForTimeout(1500);
    let after = store.get(creds.gymId, 'hf_client_tasks') || [];
    if (!after.find(t => t.id === custom.id && t.status === 'done')) {
      reportFlow('client@tasks', 'complete', 'Mark Done did not persist status=done.');
    }

    // Community task: use its "Make a Post" button (opens the home composer) — should auto-complete
    const composerOpened = await client.page.locator('button:has-text("Make a Post")').first().click({ timeout: 4000 }).then(() => true).catch(() => false);
    await client.page.waitForTimeout(1500);
    const postBox = client.page.locator('textarea').first();
    if (composerOpened && await postBox.isVisible().catch(() => false)) {
      await postBox.fill('SIM_POST biggest win: hit every session!');
      await client.page.locator('button:has-text("Post")').first().click({ timeout: 4000 }).catch(() => {});
      await client.page.waitForTimeout(1800);
      after = store.get(creds.gymId, 'hf_client_tasks') || [];
      const c = after.find(t => t.id === community?.id);
      if (community && (!c || c.status !== 'done')) {
        reportFlow('client@tasks', 'auto-complete', 'Community post did not auto-complete the community_post task.');
      }
    } else {
      reportFlow('client@tasks', 'auto-complete', 'SIM-GAP: could not open the home feed composer to post.', { simGap: true });
    }
    await client.context.close();
  });
});
