/*
 * Persona: CLIENT (gym member on their phone).
 * Journey: log in with member email + PIN → client portal → walk every tab in
 * the bottom nav / visible navigation → book a session → community.
 */
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { store } = require('../lib/mockBackend');
const { ensureCreds } = require('../lib/seed');
const { newPersona, login, clickIfVisible } = require('../lib/helpers');
const { checkNotBlank, reportFlow, setScenario, flush } = require('../lib/collector');

const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

test.describe('client journey (mobile)', () => {
  let creds;
  test.beforeAll(() => {
    setScenario('30-client');
    store.load();
    creds = ensureCreds(store);
  });
  test.afterAll(() => { flush(); store.save(); });

  test('client logs in with email + PIN and explores the portal', async ({ browser }) => {
    const { context, page } = await newPersona(browser, 'client', { mobile: true });
    const ok = await login(page, creds.demoClient.email, creds.demoClient.pin);
    if (!ok) {
      reportFlow('client', 'login', `Member ${creds.demoClient.email} with PIN cannot log in to the client portal.`);
      await context.close();
      return;
    }
    await page.waitForTimeout(2000);
    await checkNotBlank(page, 'client', 'portal home');

    // Walk the portal navigation: click every distinct nav element we can find.
    const navItems = page.locator('nav button, [class*="nav" i] button, [style*="fixed"] button');
    const count = Math.min(await navItems.count(), 12);
    for (let i = 0; i < count; i++) {
      try {
        const label = (await navItems.nth(i).innerText().catch(() => ''))?.trim().slice(0, 20) || `nav#${i}`;
        await navItems.nth(i).click({ timeout: 3000 });
        await page.waitForTimeout(1200);
        await checkNotBlank(page, 'client', `portal nav "${label}"`);
      } catch { /* nav item vanished — fine */ }
    }

    // Book a session: go to the Book tab, then tap a session's exact "Book" button
    try { await page.getByText('Book a Session', { exact: false }).first().waitFor({ timeout: 2000 }); } catch {
      // Booking lives under the Train tab now — tap Train, then the Book segment
      await page.locator('button:has-text("Train")').last().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.locator('button:has-text("Book Sessions")').first().click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    const bookBtn = page.locator('button', { hasText: /^Book$/ }).first();
    let booked = false;
    try { await bookBtn.click({ timeout: 5000 }); booked = true; } catch {
      reportFlow('client', 'book-session', 'SIM-GAP: no exact "Book" session button visible on the Book tab (may be no sessions today/this week).', { simGap: true });
      await page.screenshot({ path: path.join(__dirname, '..', 'report', 'client-book-tab.png'), fullPage: true });
    }
    if (booked) {
      await page.waitForTimeout(1800);
      const schedule = store.get(creds.gymId, 'hf_schedule');
      const anyBooking = Array.isArray(schedule) && schedule.some(c => (c.bookings || []).length > 0);
      if (!anyBooking) {
        reportFlow('client', 'book-session', 'Client tapped a session Book button but no booking persisted to hf_schedule.');
      }
    }
    await context.close();
  });
});
