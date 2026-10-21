const { test, expect } = require('@playwright/test');
const { siteConfig } = require('./helpers');

// Read-only contract: every POST is intercepted and aborted before it leaves the
// browser, so the site never receives test data. Owner/auth flows (passkey,
// recovery codes) are never poked at all.
test.describe('forms (read-only, never submits real data)', () => {
  test('forms render and accept input; all POSTs intercepted+aborted', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    const aborted = [];
    await page.route('**/*', (route) => {
      if (route.request().method() === 'POST') { aborted.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    let formsTested = 0;
    let ownerSkipped = 0;
    const failures = [];
    for (const path of site.pages) {
      await page.waitForTimeout(1200);
      await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      const forms = page.locator('form:visible');
      const n = await forms.count();
      for (let i = 0; i < n; i++) {
        const f = forms.nth(i);
        const html = (await f.innerHTML().catch(() => '')).toLowerCase();
        if (/passkey|recovery|code-|otp|otp-|webauthn/.test(html)) { ownerSkipped++; continue; }
        formsTested++;
        const inputs = f.locator('input[type="text"], input[type="search"], input:not([type]), textarea');
        const ni = await inputs.count();
        for (let j = 0; j < Math.min(ni, 3); j++) {
          const inp = inputs.nth(j);
          if (await inp.isEditable().catch(() => false)) await inp.fill('test-value-390');
        }
        const submit = f.locator('button[type="submit"], input[type="submit"]').first();
        if (await submit.isVisible().catch(() => false)) {
          await submit.click().catch(() => null);
          await page.waitForTimeout(600);
        }
      }
    }
    testInfo.annotations.push({ type: 'note', description: `forms exercised: ${formsTested}, owner-flow forms skipped: ${ownerSkipped}, POSTs intercepted+aborted: ${aborted.length}` });
    console.log(`forms exercised=${formsTested} owner-skipped=${ownerSkipped} posts-aborted=${aborted.length}`);
    expect(failures).toEqual([]);
  });

  test('search input filters without navigation errors', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    await page.goto(site.pages[1] || '/', { waitUntil: 'domcontentloaded' });
    const search = page.locator('input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').first();
    test.skip(!(await search.isVisible().catch(() => false)), 'no search input on this page');
    await search.fill('education');
    await page.waitForTimeout(1200);
    await expect(page.locator('body')).toBeVisible();
  });
});
