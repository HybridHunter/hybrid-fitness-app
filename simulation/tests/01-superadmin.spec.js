/*
 * Persona: SUPER ADMIN (platform owner).
 * Journey: log in → super admin panel → create a fully-seeded gym (demo data)
 * → verify registry. Saves creds + store fixture for all later personas.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { newPersona, login, clickIfVisible } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');
const SUPER = { email: 'Hunter@HybridFitnessGym.com', password: '13RichSquared11!!' };

test.describe('super admin journey', () => {
  test.beforeAll(() => setScenario('01-superadmin'));
  test.afterAll(() => { flush(); store.save(); });

  test('super admin creates a demo-seeded gym', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'superadmin');

    const ok = await login(page, SUPER.email, SUPER.password);
    if (!ok) {
      reportFlow('superadmin', 'login', 'Super admin login failed entirely.');
      await context.close();
      return;
    }
    await expect(page).toHaveURL(/super-admin/);
    await checkNotBlank(page, 'superadmin', '/super-admin');

    // Open the create-location form ("+ Create New Location")
    const opened = await clickIfVisible(page, 'Create New Location');
    if (!opened) {
      reportFlow('superadmin', 'create-gym', 'SIM-GAP: could not find the "+ Create New Location" button on the super admin panel.', { simGap: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'superadmin-panel.png'), fullPage: true });
      await context.close();
      return;
    }

    // Fill the form by exact placeholders (from SuperAdminPanel.js)
    const fillPh = async (ph, value) => {
      try { await page.locator(`input[placeholder="${ph}"]`).first().fill(value, { timeout: 2500 }); return true; } catch { return false; }
    };
    const f1 = await fillPh('Iron Athletics', 'Sim Gym');
    await fillPh('John Smith', 'Sim Admin');
    const f2 = await fillPh('admin', 'simadmin');
    const f3 = await fillPh('securepassword', 'simpass123');
    await fillPh('admin@gym.com', 'simadmin@simgym.io');
    if (!f1 || !f2 || !f3) {
      reportFlow('superadmin', 'create-gym', `SIM-GAP: create-location form fields not fillable (gymName:${f1} username:${f2} password:${f3}).`, { simGap: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'superadmin-create-form.png'), fullPage: true });
    }

    // Tick all the seed-data checkboxes
    for (const cb of ['Load demo data', 'exercise', 'progression']) {
      const label = page.locator(`label:has-text("${cb}")`).first();
      try { await label.click({ timeout: 1500 }); } catch {}
    }

    // Submit ("Create Location" — distinct from the "+ Create New Location" opener)
    const submitted = await clickIfVisible(page, 'Create Location', { settle: 2000 });
    if (!submitted) {
      reportFlow('superadmin', 'create-gym', 'SIM-GAP: could not submit create-location form.', { simGap: true });
    }
    await page.waitForTimeout(2500);

    // Find the created gym in the mock store regardless of UI confirmation
    const created = store.dump().find(r => r.key === 'hf_gym_info' && r.value?.gymName === 'Sim Gym');
    if (!created) {
      reportFlow('superadmin', 'create-gym', 'Create-location flow did not persist hf_gym_info for the new gym.');
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'superadmin-after-submit.png'), fullPage: true });
      await context.close();
      return;
    }
    const gymId = created.gym_id;

    // Demo data present?
    const members = store.get(gymId, 'hf_members');
    if (!Array.isArray(members) || members.length === 0) {
      reportFlow('superadmin', 'create-gym', `Demo data checkbox did not seed hf_members for ${gymId}.`);
    }

    // Registry updated?
    const registry = store.get('__super__', 'hf_gyms_registry');
    if (!Array.isArray(registry) || !registry.find(g => g.gymId === gymId)) {
      reportFlow('superadmin', 'registry', 'Newly created gym missing from __super__/hf_gyms_registry.');
    }

    fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
    fs.writeFileSync(CREDS_FILE, JSON.stringify({
      gymId,
      admin: { username: 'simadmin', password: 'simpass123' },
      superAdmin: SUPER,
      demoClient: { email: 'sarah@example.com', pin: '1234' },
    }, null, 2));

    await context.close();
  });
});
