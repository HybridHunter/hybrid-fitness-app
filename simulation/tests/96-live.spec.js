/*
 * Feature: LIVE STREAMING.
 * Simulates a broadcast by writing an active hf_live_stream row (as the GoLive
 * broadcaster would), then verifies a client sees the "LIVE now" banner on
 * Home and can open the viewer; then ends the stream and checks the banner
 * clears.
 */
const { test } = require('@playwright/test');
const crypto = require('crypto');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login } = require('../lib/helpers');
const { reportFlow, setScenario, flush } = require('../lib/collector');

// 1x1 black mp4-ish data URL is enough — the viewer only needs a string src;
// we're testing the banner/plumbing, not actual codec playback.
const FAKE_CHUNK = 'data:video/mp4;base64,AAAAHGZ0eXA=';

test.describe('live streaming', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('96-live');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('client sees a live banner and can open the viewer', async ({ browser }) => {
    // A coach is "live" — write the active stream row directly
    store.upsert(creds.gymId, 'hf_live_stream', {
      active: true, hostId: 'coach', hostName: 'Coach Mike', hostPhoto: '',
      title: 'SIM_LIVE morning mobility', seq: 1, chunk: FAKE_CHUNK,
      chunkAt: new Date().toISOString(), startedAt: new Date().toISOString(),
    });

    const client = await newPersona(browser, 'client@live', { mobile: true });
    if (!(await login(client.page, creds.demoClient.email, creds.demoClient.pin))) { test.skip(true, 'client login broken'); return; }
    await client.page.waitForTimeout(3000); // allow the live-status poll to land

    let homeText = await client.page.locator('#root').innerText();
    if (!/LIVE/.test(homeText) || !/Coach Mike/.test(homeText)) {
      reportFlow('client@live', 'banner', 'Live banner not shown on Home while a coach is broadcasting.');
      await client.context.close();
      return;
    }

    // Open the viewer
    await client.page.locator('text=Coach Mike').first().click({ timeout: 5000 }).catch(() => {});
    await client.page.waitForTimeout(1500);
    const viewerText = await client.page.locator('#root').innerText();
    if (!/SIM_LIVE morning mobility|LIVE/i.test(viewerText)) {
      reportFlow('client@live', 'viewer', 'Live viewer did not open / show the stream.');
    }
    // Close viewer
    await client.page.locator('button:has-text("✕"), button:has-text("Close")').first().click({ timeout: 4000 }).catch(() => {});

    // End the stream — banner should clear on the next poll
    store.upsert(creds.gymId, 'hf_live_stream', {
      active: false, hostId: 'coach', hostName: 'Coach Mike', title: 'SIM_LIVE morning mobility',
      seq: 1, endedAt: new Date().toISOString(),
    });
    // The app's global poller refreshes ~20s; nudge by reloading (a real client
    // would see it clear within a poll cycle).
    await client.page.reload();
    await client.page.waitForTimeout(3000);
    const afterText = await client.page.locator('#root').innerText();
    if (/Coach Mike is live|is live now/i.test(afterText)) {
      reportFlow('client@live', 'end', 'Live banner still shows after the stream ended.');
    }
    await client.context.close();
  });
});
