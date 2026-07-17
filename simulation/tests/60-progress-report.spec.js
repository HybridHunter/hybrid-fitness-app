/*
 * Feature: WEEKLY PROGRESS REPORTS.
 * Coach writes a structured report on a client's profile (goal / wins /
 * improvements / action steps), emails it (mock outbox), and the client sees
 * and opens it in their portal profile.
 */
const { test, expect } = require('@playwright/test');
const { store, outbox } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

test.describe('weekly progress reports', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('60-progress-report');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('coach creates + emails a report; client reads it in the portal', async ({ browser }) => {
    const members = store.get(creds.gymId, 'hf_members') || [];
    const sarah = members.find(m => m.email === creds.demoClient.email);
    expect(sarah, 'demo client exists in hf_members').toBeTruthy();

    // ── Staff side: create and send the report ──
    const staff = await newPersona(browser, 'coach@report');
    if (!(await login(staff.page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken'); return; }
    await staff.page.goto(`/gym/${creds.gymId}/members/${sarah.id}`);
    await staff.page.waitForTimeout(1500);
    await checkNotBlank(staff.page, 'coach@report', 'member profile');

    await staff.page.locator('button:has-text("Progress Reports")').first().click();
    await staff.page.waitForTimeout(800);
    await staff.page.locator('button:has-text("New Report")').first().click();
    await staff.page.waitForTimeout(600);

    const fill = async (hint, val) => staff.page.locator(`textarea[placeholder*="${hint}" i]`).fill(val);
    await fill('working toward', 'Lose 20 lbs by December and deadlift bodyweight');
    await fill('Hit all 3', 'Made all 3 sessions\nPR on goblet squat');
    await fill('constructive', 'Water intake still low on weekends');
    await fill('specific and doable', 'Drink 80oz water daily\nBook Saturday session');

    const emailsBefore = outbox.emails.length;
    await staff.page.locator(`button:has-text("Email to ${sarah.firstName}")`).click();
    await staff.page.waitForTimeout(2500);

    // Email captured by the mock outbox?
    const sent = outbox.emails.slice(emailsBefore).find(e => (e.subject || '').includes('Progress Report'));
    if (!sent) {
      reportFlow('coach@report', 'send-report', 'Report email never reached the outbox (send failed).');
    } else if (!(sent.html || '').includes('deadlift bodyweight')) {
      reportFlow('coach@report', 'send-report', 'Report email is missing the report content.');
    }

    // Persisted as delivered?
    const reports = store.get(creds.gymId, 'hf_progress_reports') || [];
    const delivered = reports.find(r => r.memberId === sarah.id && r.status === 'delivered');
    if (!delivered) {
      reportFlow('coach@report', 'send-report', 'Report not persisted with status=delivered in hf_progress_reports.');
    }
    await staff.context.close();

    // ── Client side: see and open the report ──
    const client = await newPersona(browser, 'client@report', { mobile: true });
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);
    await client.page.locator('button:has-text("Profile")').last().click();
    await client.page.waitForTimeout(1500);

    const profileText = await client.page.locator('#root').innerText();
    if (!profileText.includes('Progress Reports')) {
      reportFlow('client@report', 'view-report', 'Delivered report card not visible on the client profile tab.');
    } else {
      await client.page.locator('text=Week of').first().click();
      await client.page.waitForTimeout(1000);
      const viewerText = await client.page.locator('#root').innerText();
      if (!/deadlift bodyweight/i.test(viewerText) || !/action steps/i.test(viewerText)) {
        reportFlow('client@report', 'view-report', 'Report viewer did not render the report content.');
      }
    }
    await client.context.close();
  });
});
