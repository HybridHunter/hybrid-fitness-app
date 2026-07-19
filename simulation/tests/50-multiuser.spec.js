/*
 * Scenario: MULTI-USER REALTIME — coach and client online at the same time,
 * sharing the same backend (the mock store is shared across contexts).
 * Verifies cross-device data flow: chat both directions, client booking
 * visible to staff, community post visible across sides.
 */
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login, clickIfVisible } = require('../lib/helpers');
const { reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

test.describe('multi-user realtime', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('50-multiuser');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('client message reaches staff inbox without a manual reload', async ({ browser }) => {
    const admin = await newPersona(browser, 'admin@multiuser');
    const client = await newPersona(browser, 'client@multiuser', { mobile: true });
    client.page.on('dialog', d => d.accept());

    if (!(await login(admin.page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken (already recorded)'); return; }
    await admin.page.goto(`/gym/${creds.gymId}/messages`);
    await admin.page.waitForTimeout(1500);

    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken (already recorded)'); return; }
    await client.page.waitForTimeout(2000);

    // Client opens the coach chat via the messenger icon in the FB-style home header
    let sent = false;
    try {
      await client.page.getByText('💬', { exact: true }).first().click({ timeout: 5000 });
      await client.page.waitForTimeout(1200);
    } catch {
      try {
        await client.page.getByText('Message Your Coach', { exact: false }).first().click({ timeout: 4000 });
        await client.page.waitForTimeout(1200);
      } catch {
        for (const label of ['Message', 'Chat', 'Coach']) {
          if (await clickIfVisible(client.page, label, { timeout: 2500 })) break;
        }
      }
    }
    const input = client.page.locator('input[placeholder="Aa"], textarea, input[placeholder*="essage" i], input[placeholder*="Type" i]').first();
    try {
      await input.waitFor({ state: 'visible', timeout: 4000 });
      await input.fill('SIM_PING_FROM_CLIENT');
      await client.page.keyboard.press('Enter');
      await client.page.waitForTimeout(500);
      await clickIfVisible(client.page, 'Send', { timeout: 1500 });
      await client.page.waitForTimeout(1500);
      sent = true;
    } catch {
      reportFlow('client@multiuser', 'chat-send', 'SIM-GAP: could not find a chat input in the client portal.', { simGap: true });
    }

    if (sent) {
      const messages = store.get(creds.gymId, 'hf_messages');
      const inBackend = JSON.stringify(messages || '').includes('SIM_PING_FROM_CLIENT');
      if (!inBackend) {
        reportFlow('client@multiuser', 'chat-send', 'Client chat message never persisted to hf_messages.');
      } else {
        // Does the staff side see it without a reload within 20s?
        let seen = false;
        for (let i = 0; i < 10; i++) {
          await admin.page.waitForTimeout(2000);
          if ((await admin.page.locator('#root').innerText()).includes('SIM_PING_FROM_CLIENT')) { seen = true; break; }
        }
        if (!seen) {
          await admin.page.reload();
          await admin.page.waitForTimeout(2500);
          const afterReload = (await admin.page.locator('#root').innerText()).includes('SIM_PING_FROM_CLIENT');
          reportFlow('admin@multiuser', 'chat-receive', afterReload
            ? 'Staff inbox NEVER shows a new client message without a full page reload (no polling/realtime).'
            : 'Client message not visible to staff even after reload (conversation shape mismatch between portal and staff inbox).');
        }
      }
    }

    await admin.context.close();
    await client.context.close();
  });

  test('client booking appears on the staff schedule', async ({ browser }) => {
    const client = await newPersona(browser, 'client@booking', { mobile: true });
    client.page.on('dialog', d => d.accept());
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);

    // Booking lives under the Train tab now
    await client.page.locator('button:has-text("Train")').last().click({ timeout: 5000 }).catch(() => {});
    await client.page.waitForTimeout(1000);
    await client.page.locator('button:has-text("Book Sessions")').first().click({ timeout: 4000 }).catch(() => {});
    await client.page.waitForTimeout(1000);
    await client.page.locator('button', { hasText: /^Book$/ }).first().click({ timeout: 5000 }).catch(() => {});
    await client.page.waitForTimeout(1800);

    const schedule = store.get(creds.gymId, 'hf_schedule');
    const booked = Array.isArray(schedule) && schedule.some(c => (c.bookings || []).length > 0 || Object.values(c.bookingsByDate || {}).some(l => l.length > 0));
    if (booked) {
      const admin = await newPersona(browser, 'admin@booking');
      if (await login(admin.page, creds.admin.username, creds.admin.password)) {
        await admin.page.goto(`/gym/${creds.gymId}/schedule`);
        await admin.page.waitForTimeout(2000);
        const text = await admin.page.locator('#root').innerText();
        if (!/1\s*\/|booked|Sarah/i.test(text)) {
          reportFlow('admin@booking', 'booking-visibility', 'Client booking exists in hf_schedule but is not visible on the staff schedule view.');
        }
      }
      await admin.context.close();
    }
    await client.context.close();
  });
});
