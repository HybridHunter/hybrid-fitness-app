/*
 * Bug collector — attaches listeners to a page and records everything that
 * looks broken: uncaught exceptions, console errors, failed network calls,
 * HTTP >= 400 responses, and blank screens. All findings accumulate in a
 * module-level list and are flushed to report/bugs.json at teardown.
 */
const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '..', 'report');
const BUGS_FILE = path.join(REPORT_DIR, 'bugs.json');

const bugs = [];
let currentScenario = 'unknown';

// Console noise that is not an app bug (React dev-mode chatter, aborted external calls).
const IGNORE_PATTERNS = [
  /Download the React DevTools/i,
  /webpack-dev-server/i,
  /\[HMR\]/i,
  /ERR_BLOCKED_BY_CLIENT/,   // our own external-request blocking
  /net::ERR_ABORTED/,
  /manifest\.json/i,
  /favicon/i,
  /Warning: /,               // React warnings — logged separately as minor
  /Failed to load resource/, // duplicate of requestfailed; mostly our blocked externals
];

function setScenario(name) { currentScenario = name; }

function record(bug) {
  const entry = { scenario: currentScenario, ts: new Date().toISOString(), ...bug };
  bugs.push(entry);
  // Console line so failures are visible live in the test output
  console.log(`  [BUG:${entry.type}] (${entry.persona || '?'}) ${String(entry.message).slice(0, 200)}`);
}

function isNoise(text) {
  return IGNORE_PATTERNS.some(re => re.test(text));
}

/**
 * Attach collectors to a page. `persona` labels who was simulated.
 */
function attachCollectors(page, persona) {
  page.on('pageerror', err => {
    record({ type: 'uncaught-exception', persona, url: page.url(), message: err.message, stack: (err.stack || '').split('\n').slice(0, 6).join('\n') });
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isNoise(text)) {
      if (/^Warning: /.test(text)) {
        record({ type: 'react-warning', severity: 'minor', persona, url: page.url(), message: text.slice(0, 300) });
      }
      return;
    }
    record({ type: 'console-error', persona, url: page.url(), message: text.slice(0, 500) });
  });
  page.on('requestfailed', req => {
    const failure = req.failure()?.errorText || '';
    if (isNoise(failure) || isNoise(req.url())) return;
    if (!req.url().startsWith('http://localhost')) return; // externals are blocked on purpose
    record({ type: 'request-failed', persona, url: page.url(), message: `${req.method()} ${req.url()} — ${failure}` });
  });
  page.on('response', res => {
    if (res.status() >= 400 && res.url().startsWith('http://localhost:3100')) {
      if (isNoise(res.url())) return;
      record({ type: 'http-error', persona, url: page.url(), message: `${res.status()} ${res.request().method()} ${res.url()}` });
    }
  });
}

/** Assert the app actually rendered something (not a white screen / crashed root). */
async function checkNotBlank(page, persona, label) {
  try {
    const state = await page.evaluate(() => {
      const root = document.getElementById('root');
      const overlay = document.getElementById('webpack-dev-server-client-overlay');
      return {
        empty: !root || root.children.length === 0 || root.innerText.trim().length === 0,
        overlay: !!overlay,
        text: root ? root.innerText.slice(0, 120) : '',
      };
    });
    if (state.overlay) {
      record({ type: 'crash-overlay', persona, url: page.url(), message: `Dev error overlay shown at ${label}` });
      await page.evaluate(() => document.getElementById('webpack-dev-server-client-overlay')?.remove());
    }
    if (state.empty) {
      record({ type: 'blank-screen', persona, url: page.url(), message: `Blank screen at ${label}` });
      return false;
    }
    return true;
  } catch (e) {
    record({ type: 'check-failed', persona, url: page.url(), message: `${label}: ${e.message}` });
    return false;
  }
}

/** Record a broken flow found by an explicit test assertion. */
function reportFlow(persona, flow, message, extra = {}) {
  record({ type: 'broken-flow', persona, flow, message, ...extra });
}

function flush() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(BUGS_FILE, 'utf8')); } catch {}
  fs.writeFileSync(BUGS_FILE, JSON.stringify([...existing, ...bugs], null, 1));
  bugs.length = 0;
}

module.exports = { attachCollectors, checkNotBlank, reportFlow, record, flush, setScenario, bugs, BUGS_FILE };
