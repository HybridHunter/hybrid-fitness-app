const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  timeout: 120000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'report/results.json' }]],
  outputDir: 'report/artifacts',
  use: {
    baseURL: 'http://localhost:3100',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'PORT=3100 BROWSER=none FAST_REFRESH=false npm start',
    cwd: '..',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 300000,
  },
});
