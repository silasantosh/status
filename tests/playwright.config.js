// @ts-check
const { defineConfig } = require('@playwright/test');
const sites = require('./sites');
const only = (process.env.SITES || 'ic,inlearn,inmeet,inmedia').split(',');

module.exports = defineConfig({
  testDir: './specs',
  timeout: 45000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['html', { open: 'never' }], ['json', { outputFile: 'results/results.json' }], ['list']],
  use: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    screenshot: 'only-on-failure',
    navigationTimeout: 45000,
    actionTimeout: 15000,
  },
  projects: only.filter((s) => sites[s]).map((s) => ({
    name: s,
    use: { baseURL: sites[s].base },
    metadata: { site: s, config: sites[s] },
  })),
});
