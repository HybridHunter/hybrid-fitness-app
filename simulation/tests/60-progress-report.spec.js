/*
 * Feature: WEEKLY PROGRESS REPORTS.
 * Coach writes a structured report on a client's profile, pushes it to the
 * client's app and emails it. Client sees a notification banner on home,
 * opens the celebratory viewer (marking it seen), and finds it in the
 * Progress tab history.
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

  test('coach pushes + emails a report; client gets banner, views it, sees history', async ({ browser }) => {
    const members = store.get(creds.gymId, 'hf_members') || [];
    const sarah = members.find(m => m.email === creds.demoClient.email);
    expect(sarah, 'demo client exists in hf_members').toBeTruthy();

    // ── Staff side: create, push to app, then email ──
    const staff = await newPersona(browser, 'coach@report');
    if (!(await login(staff.page, creds.admin.username, creds.admin.password))) { test.skip(true, 'admin login broken'); return; }
    await staff.page.goto(`/gym/${creds.gymId}/members/${sarah.id}`);
    await staff.page.waitForTimeout(1500);
    await checkNotBlank(staff.page, 'coach@report', 'member profile');

    await staff.page.locator('button:has-text("Progress Reports")').first().click();
    await staff.page.waitForTimeout(800);
    await staff.page.locator('button:has-text("New Report")').first().click();
    await staff.page.waitForTimeout(600);

    // AI voice-memo path: type a transcript (headless browsers have no mic) and generate
    const memoBox = staff.page.locator('textarea[placeholder*="memo" i]').first();
    if (await memoBox.isVisible().catch(() => false)) {
      await memoBox.fill('Abigail had a great week, made every session and PRed her squat. Water was low on the weekend again. Next week keep three sessions and track water daily.');
      await staff.page.locator('button:has-text("Generate Report")').click();
      await staff.page.waitForTimeout(2000);
      const goalVal = await staff.page.locator('textarea[placeholder*="working toward" i]').inputValue();
      const winsVal = await staff.page.locator('textarea[placeholder*="Hit all 3" i]').inputValue();
      if (!goalVal || !winsVal.includes('MOCK_AI_WIN')) {
        reportFlow('coach@report', 'ai-memo', `AI memo generation did not populate the report fields (goal:"${goalVal.slice(0, 30)}" wins:"${winsVal.slice(0, 30)}").`);
      }
    } else {
      reportFlow('coach@report', 'ai-memo', 'SIM-GAP: voice memo panel/transcript box not found in the report editor.', { simGap: true });
    }

    const fill = async (hint, val) => staff.page.locator(`textarea[placeholder*="${hint}" i]`).fill(val);
    await fill('working toward', 'Lose 20 lbs by December and deadlift bodyweight');
    await fill('Hit all 3', 'Made all 3 sessions\nPR on goblet squat');
    await fill('constructive', 'Water intake still low on weekends');
    await fill('specific and doable', 'Drink 80oz water daily\nBook Saturday session');

    // Push to the client's app
    await staff.page.locator('button:has-text("Push to App")').click();
    await staff.page.waitForTimeout(1500);

    let reports = store.get(creds.gymId, 'hf_progress_reports') || [];
    let delivered = reports.find(r => r.memberId === sarah.id && r.status === 'delivered');
    if (!delivered) {
      reportFlow('coach@report', 'push-to-app', 'Push to App did not persist a delivered report.');
    } else if (!(delivered.via || []).includes('app')) {
      reportFlow('coach@report', 'push-to-app', 'Delivered report missing via:app channel.');
    }

    // Also email it (reopen the delivered report)
    const emailsBefore = outbox.emails.length;
    await staff.page.locator('button', { hasText: /^View$/ }).first().click();
    await staff.page.waitForTimeout(600);
    await staff.page.locator(`button:has-text("Email to ${sarah.firstName}")`).click();
    await staff.page.waitForTimeout(2500);
    const sent = outbox.emails.slice(emailsBefore).find(e => (e.subject || '').includes('Progress Report'));
    if (!sent) {
      reportFlow('coach@report', 'send-report', 'Report email never reached the outbox.');
    } else if (!/deadlift bodyweight/i.test(sent.html || '')) {
      reportFlow('coach@report', 'send-report', 'Report email is missing the report content.');
    }
    await staff.context.close();

    // ── Client side: home banner → viewer → seen → history ──
    const client = await newPersona(browser, 'client@report', { mobile: true });
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(2000);

    // Notification banner on home
    const homeText = await client.page.locator('#root').innerText();
    if (!/Progress Report is ready/i.test(homeText)) {
      reportFlow('client@report', 'home-banner', 'New-report notification banner not shown on the portal home page.');
    } else {
      await client.page.locator('text=Progress Report is ready').first().click();
      await client.page.waitForTimeout(1200);
      const viewerText = await client.page.locator('#root').innerText();
      if (!/deadlift bodyweight/i.test(viewerText) || !/mission/i.test(viewerText)) {
        reportFlow('client@report', 'view-report', 'Celebratory viewer did not render the report content.');
      }
      await client.page.locator('button:has-text("Close")').first().click();
      await client.page.waitForTimeout(1200);

      // Banner should be gone now that it's seen
      const homeAfter = await client.page.locator('#root').innerText();
      if (/Progress Report is ready/i.test(homeAfter)) {
        reportFlow('client@report', 'seen-tracking', 'Banner still shows after the report was viewed (seenAt not persisted).');
      }
      // Seen flag persisted to the backend?
      reports = store.get(creds.gymId, 'hf_progress_reports') || [];
      const seen = reports.find(r => r.memberId === sarah.id && r.seenAt);
      if (!seen) {
        reportFlow('client@report', 'seen-tracking', 'seenAt not persisted to hf_progress_reports.');
      }
    }

    // History under the Progress tab
    await client.page.locator('button:has-text("Progress")').last().click();
    await client.page.waitForTimeout(1500);
    const progressText = await client.page.locator('#root').innerText();
    if (!/Progress Reports/i.test(progressText) || !/Week of/i.test(progressText)) {
      reportFlow('client@report', 'history', 'Report history not visible under the Progress tab.');
    } else if (!/Viewed/i.test(progressText)) {
      reportFlow('client@report', 'history', 'History does not show the viewed state for a seen report.');
    }
    await client.context.close();
  });
});
