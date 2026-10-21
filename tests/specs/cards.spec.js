const { test, expect } = require('@playwright/test');
const { siteConfig } = require('./helpers');

test.describe('card standard', () => {
  test('job cards: main source button + 6 icon tiles + counts', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    test.skip(!site.cards, 'no card UI on this site');
    const c = site.cards;
    await page.goto(c.listPath, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(c.rowSel, { timeout: 30000 });
    const row = page.locator(c.rowSel).first();
    await expect(row.locator(c.sourceSel).first(), 'main Official source button').toBeVisible();
    const tiles = await row.locator(`[${c.tileAttr}]`).evaluateAll((els, attr) => els.map((e) => e.getAttribute(attr)), c.tileAttr);
    for (const want of c.expectedTiles) {
      // Report tile is a KNOWN missing tile on live IC (preview pending) - expected failure, will trip when fixed.
      if (want === 'report' && testInfo.project.name === 'ic') test.fail(true, 'Report tile missing on live IC - known gap, preview pending');
      expect(tiles, `tile "${want}" in [${tiles}]`).toContain(want);
    }
    // counts on chips under the tiles
    const countNodes = await row.locator('text=/^\\d+$/').count();
    expect(countNodes, 'numeric count chips under tiles').toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `results/shots/${testInfo.project.name}-cards.png` });
  });
});
