const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { siteConfig } = require('./helpers');
const fs = require('fs');

test.describe('accessibility (axe-core)', () => {
  test('no critical violations on main pages', async ({ page }, testInfo) => {
    const site = siteConfig(testInfo);
    const critical = [];
    fs.mkdirSync('results/axe', { recursive: true });
    for (const path of site.pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const slug = `${testInfo.project.name}${path.replace(/\//g, '_') || '_home'}`;
      fs.writeFileSync(`results/axe/${slug}.json`, JSON.stringify(res.violations, null, 1));
      for (const v of res.violations.filter((x) => x.impact === 'critical')) {
        critical.push(`${path}: ${v.id} (${v.nodes.length} nodes)`);
      }
    }
    expect(critical, critical.join('\n')).toEqual([]);
  });
});
