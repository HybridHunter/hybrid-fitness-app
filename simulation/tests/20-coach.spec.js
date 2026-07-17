/*
 * Persona: COACH.
 * Journey: log in with a coach account → verify the coach experience: dashboard,
 * workout builder (build + save a workout), command view, schedule, check-in.
 */
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { newPersona, login, visitRoute, clickIfVisible } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

test.describe('coach journey', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('20-coach');
    store.load();
    creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    // Use the coach the admin created via the UI when it exists; otherwise seed one.
    const users = store.get(creds.gymId, 'hf_users');
    const existing = Array.isArray(users) && users.find(u => u.role === 'coach');
    if (existing) {
      creds.coach = { username: existing.username, password: existing.password };
    } else {
      store.upsert(creds.gymId, 'hf_users', [...(Array.isArray(users) ? users : []), { id: 'u_coach_sim', username: 'simcoach', password: 'coachpass123', role: 'coach', memberId: null, displayName: 'Sim Coach', email: 'simcoach@simgym.io' }]);
      creds.coach = { username: 'simcoach', password: 'coachpass123' };
    }
  });
  test.afterAll(() => { flush(); store.save(); });

  test('coach logs in and core coach routes render', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'coach');
    const ok = await login(page, creds.coach.username, creds.coach.password);
    if (!ok) {
      reportFlow('coach', 'login', 'Coach account (present in backend hf_users) cannot log in from a fresh device.');
      await context.close();
      return;
    }
    for (const route of ['', 'coaching', 'build', 'workouts', 'programs', 'library', 'matrix', 'members', 'assessments', 'command', 'schedule', 'checkin', 'community', 'messages', 'accountability', 'help']) {
      await visitRoute(page, 'coach', creds.gymId, route);
    }
    await context.close();
  });

  test('coach builds and saves a workout', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'coach');
    if (!(await login(page, creds.coach.username, creds.coach.password))) { await context.close(); return; }
    await page.goto(`/gym/${creds.gymId}/build`);
    await page.waitForTimeout(1500);
    await checkNotBlank(page, 'coach', '/build');

    // Name the workout, put an exercise in the first slot (required for save), then save
    await page.locator('input[placeholder="Workout Name..."]').fill('Sim Workout A').catch(() => {});
    const pickerOpened = await clickIfVisible(page, 'Add exercise');
    if (pickerOpened) {
      // Pick the first exercise in the picker (click any exercise-looking row)
      const candidates = ['Goblet Squat', 'Squat', 'Push-Up', 'Deadlift', 'Press'];
      let picked = false;
      for (const name of candidates) {
        try {
          await page.getByText(name, { exact: false }).last().click({ timeout: 2000 });
          picked = true;
          break;
        } catch {}
      }
      if (!picked) reportFlow('coach', 'save-workout', 'SIM-GAP: exercise picker opened but no known exercise found to click.', { simGap: true });
      await page.waitForTimeout(800);
    } else {
      reportFlow('coach', 'save-workout', 'SIM-GAP: no "+ Add exercise" slot button found in /build.', { simGap: true });
    }
    const saved = await clickIfVisible(page, 'Save Workout');
    await page.waitForTimeout(1500);
    if (saved && pickerOpened) {
      const workouts = store.get(creds.gymId, 'hf_w');
      if (!Array.isArray(workouts) || !workouts.find(w => w.name === 'Sim Workout A')) {
        reportFlow('coach', 'save-workout', 'Workout with an exercise saved but nothing persisted to hf_w.');
      }
    }
    await context.close();
  });
});
