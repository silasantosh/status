const { test, expect } = require('@playwright/test');
const { siteConfig, watchErrors } = require('./helpers');

const cfg = siteConfig({ project: { name: process.env.PW_SITE || '' } });

// CI egress IPs are sometimes challenged/blocked by site bot protection (HTTP 429 or 403).
// Those paths are reported as a note, not a failure: real browsers load them fine.
const PROTECTED = (s) => s === 429 || s === 403;

test.describe('smoke: main pages at 390x844', () => {
  test('every main page loads 200 with no page errors', async ({ page, request }, testInfo) => {
    const site = siteConfig(testInfo);
    const failures = [];
    const rateLimited = [];
    for (const path of site.pages) {
      const { pageErrors, consoleErrors } = watchErrors(page);
      await page.waitForTimeout(1200);
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch((e) => null);
      if (!resp) { failures.push(`${path}: navigation failed`); continue; }
      if (PROTECTED(resp.status())) { rateLimited.push(`${path} (${resp.status()})`); continue; }
      if (resp.status() >= 400) failures.push(`${path}: HTTP ${resp.status()}`);
      await page.waitForTimeout(1500);
      if (pageErrors.length) failures.push(`${path}: pageerror: ${pageErrors[0]}`);
      if (consoleErrors.length) failures.push(`${path}: console: ${consoleErrors[0]}`);
      const name = `${testInfo.project.name}${path.replace(/\//g, '_') || '_home'}`;
      await page.screenshot({ path: `results/shots/${name}.png`, fullPage: false });
    }
    if (rateLimited.length) {
      const note = `blocked by site protection from CI IPs (expected): ${rateLimited.join(', ')}`;
      testInfo.annotations.push({ type: 'note', description: note });
      console.warn(note);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('api health endpoint responds ok', async ({ request }, testInfo) => {
    const site = siteConfig(testInfo);
    test.skip(!site.apiHealth, 'no api health endpoint for this site');
    const resp = await request.get(site.apiHealth, { timeout: 20000 });
    expect(resp.status(), `${site.apiHealth} -> ${resp.status()}`).toBeLessThan(400);
  });

  test('nav discovery: same-origin links from home load', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const links = await page.evaluate(() => {
      const as = [...document.querySelectorAll('nav a[href^="/"], footer a[href^="/"]')];
      return [...new Set(as.map((a) => a.getAttribute('href').split('#')[0]))].filter(Boolean).slice(0, 12);
    });
    const failures = [];
    for (const href of links) {
      const resp = await page.goto(href, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!resp) { failures.push(`${href}: nav failed`); continue; }
      if (PROTECTED(resp.status())) { console.warn(`blocked by site protection from CI IPs (expected): ${href} (${resp.status()})`); continue; }
      if (resp.status() >= 400) failures.push(`${href}: ${resp.status()}`);
    }
    expect(failures, `broken nav links: ${failures.join(', ')}`).toEqual([]);
  });
});
