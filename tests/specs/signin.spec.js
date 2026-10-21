const { test, expect } = require('@playwright/test');
const { siteConfig } = require('./helpers');

test.describe('sign-in path (stops at form render, no login attempts)', () => {
  test('account/sign-in page renders a sign-in control', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    test.skip(!site.accountPath, 'no account page known for this site');
    const resp = await page.goto(site.accountPath, { waitUntil: 'domcontentloaded' });
    expect(resp.status()).toBeLessThan(400);
    const control = page.locator('button:has-text("Sign in"), button:has-text("passkey"), button:has-text("Log in"), a:has-text("Sign in"), input[type="password"], button:has-text("Continue"), button:has-text("fingerprint"), #fingerprint').first();
    await expect(control, 'a sign-in/passkey control is visible').toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `results/shots/${testInfo.project.name}-signin.png` });
    // STOP here: no credentials, no login attempt.
  });
});
