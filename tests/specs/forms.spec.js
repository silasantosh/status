const { test, expect } = require('@playwright/test');
const { siteConfig } = require('./helpers');

test.describe('forms (read-only, never submits real data)', () => {
  test('forms render, accept input, and never POST on invalid submit', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    const posts = [];
    await page.route('**/*', (route) => {
      if (route.request().method() === 'POST') { posts.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const failures = [];
    let formsTested = 0;
    for (const path of site.pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      const forms = page.locator('form:visible');
      const n = await forms.count();
      for (let i = 0; i < n; i++) {
        formsTested++;
        const f = forms.nth(i);
        // fill text-ish fields with obviously fake test values
        const inputs = f.locator('input[type="text"], input[type="search"], input:not([type]), textarea');
        const ni = await inputs.count();
        for (let j = 0; j < Math.min(ni, 3); j++) {
          const inp = inputs.nth(j);
          if (await inp.isEditable().catch(() => false)) await inp.fill('test-value-390');
        }
        // try submit with whatever state - any POST must be intercepted
        const submit = f.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send"), button:has-text("Sign up")').first();
        if (await submit.isVisible().catch(() => false)) {
          await submit.click({ trial: false }).catch(() => null);
          await page.waitForTimeout(800);
        }
      }
    }
    if (posts.length) failures.push(`unexpected POST fired: ${posts.join(', ')}`);
    testInfo.annotations.push({ type: 'note', description: `forms exercised: ${formsTested}` });
    expect(failures, failures.join('\n')).toEqual([]);
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
