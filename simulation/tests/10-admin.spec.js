/*
 * Persona: GYM ADMIN.
 * Journey: log in → visit every staff route (crash/blank detection) → core
 * flows: add a member, create a staff (coach) account, send a test message.
 */
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { seedGym } = require('../lib/seed');
const { newPersona, login, visitRoute, clickIfVisible, STAFF_ROUTES } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

test.describe('gym admin journey', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('10-admin');
    store.load(); // rehydrate from previous specs if a fresh worker
    creds = loadCreds();
    if (!creds || !store.get(creds.gymId, 'hf_users')) {
      const gymId = seedGym(store);
      creds = { gymId, admin: { username: 'simadmin', password: 'simpass123' }, demoClient: { email: 'sarah@example.com', pin: '1234' }, seeded: true };
      fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
      fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
    }
  });
  test.afterAll(() => { flush(); store.save(); });

  test('admin logs in and every staff route renders', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'admin');
    const ok = await login(page, creds.admin.username, creds.admin.password);
    if (!ok) {
      reportFlow('admin', 'login', `Gym admin login failed for ${creds.admin.username} (gym ${creds.gymId}).`);
      await context.close();
      test.skip(true, 'admin cannot log in');
      return;
    }
    for (const route of STAFF_ROUTES) {
      await visitRoute(page, 'admin', creds.gymId, route);
    }
    await context.close();
  });

  test('admin adds a member through the UI', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'admin');
    if (!(await login(page, creds.admin.username, creds.admin.password))) { await context.close(); return; }
    await page.goto(`/gym/${creds.gymId}/members`);
    await page.waitForTimeout(1500);

    const opened = await clickIfVisible(page, 'Add Client');
    if (!opened) {
      reportFlow('admin', 'add-member', 'SIM-GAP: no "+ Add Client" button found on /members.', { simGap: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'members-page.png'), fullPage: true });
      await context.close();
      return;
    }
    // Fill the Add Client modal (fields have labels, not placeholders)
    const fillByLabel = async (labelText, val) => {
      try {
        await page.locator(`div:has(> label:has-text("${labelText}")) input`).first().fill(val, { timeout: 2500 });
        return true;
      } catch { return false; }
    };
    await fillByLabel('First Name', 'Testy');
    await fillByLabel('Last Name', 'McSimface');
    await fillByLabel('Email', 'testy@simgym.io');
    // Fill ALL date inputs (dob is required; startDate may come first in the form)
    const dateInputs = page.locator('input[type="date"]');
    const nDates = await dateInputs.count();
    for (let i = 0; i < nDates; i++) {
      await dateInputs.nth(i).fill('1990-05-05').catch(() => {});
    }
    // PIN auto-generates when left empty (E9 fix). Submit via the modal's "Add Client" button (the last one).
    let saved = false;
    try {
      await page.locator('button:has-text("Add Client")').last().click({ timeout: 5000 });
      saved = true;
    } catch {}
    await page.waitForTimeout(1500);

    const members = store.get(creds.gymId, 'hf_members');
    const found = Array.isArray(members) && members.find(m => m.firstName === 'Testy');
    if (saved && !found) {
      reportFlow('admin', 'add-member', 'Add-member form submitted but the new member never persisted to hf_members.');
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'add-member-fail.png'), fullPage: true });
    }
    await checkNotBlank(page, 'admin', 'members after add');
    await context.close();
  });

  test('admin creates a coach account in settings', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'admin');
    if (!(await login(page, creds.admin.username, creds.admin.password))) { await context.close(); return; }
    await page.goto(`/gym/${creds.gymId}/settings`);
    await page.waitForTimeout(1500);
    await checkNotBlank(page, 'admin', '/settings');

    // Users tab → inline "Add User" form (placeholders from SettingsView.js)
    try { await page.getByText('Users', { exact: true }).first().click({ timeout: 5000 }); } catch {}
    await page.waitForTimeout(800);
    const fillPh = async (ph, val) => { try { await page.locator(`input[placeholder="${ph}"]`).first().fill(val, { timeout: 2500 }); return true; } catch { return false; } };
    const n1 = await fillPh('Coach Jane', 'UI Coach');
    const n2 = await fillPh('jane@gym.com', 'uicoach@simgym.io');
    const n3 = await fillPh('Enter password', 'uicoach123');
    if (!n1 || !n2 || !n3) {
      reportFlow('admin', 'create-coach', `SIM-GAP: Add User form fields not found in Settings → Users (name:${n1} email:${n2} pw:${n3}).`, { simGap: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'settings-page.png'), fullPage: true });
    } else {
      await page.locator('button:has-text("Add User")').last().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const users = store.get(creds.gymId, 'hf_users');
      if (!Array.isArray(users) || !users.find(u => u.username === 'uicoach@simgym.io')) {
        reportFlow('admin', 'create-coach', 'Created staff account did not persist to hf_users in the backend (new coach could not log in from another device).');
      }
    }
    await context.close();
  });
});
