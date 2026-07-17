/*
 * Persona: STATION TABLET (unauthenticated gym iPad).
 * Journey: open /station/:id cold (no localStorage — like a freshly
 * bookmarked iPad) and verify it can reach its gym's data at all.
 */
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { newPersona } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

test.describe('station display', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('40-station');
    store.load();
    creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    // Seed a station for the gym (as StationSetup would)
    const stations = store.get(creds.gymId, 'hf_stations');
    if (!Array.isArray(stations) || stations.length === 0) {
      store.upsert(creds.gymId, 'hf_stations', [
        { id: 'st1', name: 'Station 1', memberId: null, workoutId: null, assignedMembers: [] },
      ]);
    }
  });
  test.afterAll(() => { flush(); store.save(); });

  test('fresh tablet opens station URL', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'station');
    await page.goto('/station/st1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const rendered = await checkNotBlank(page, 'station', '/station/st1');
    if (rendered) {
      const text = await page.locator('#root').innerText();
      if (/not found|no station/i.test(text)) {
        reportFlow('station', 'cold-open', 'Fresh tablet (no hf_gym_id in localStorage) cannot resolve its station — station URL carries no gym/tenant.', { note: text.slice(0, 120) });
      }
    }
    await context.close();
  });
});
