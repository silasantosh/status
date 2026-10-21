// Link check per site (linkinator). Read-only GET/HEAD checks only.
const { LinkChecker } = require('linkinator');
const sites = require('./sites');
const fs = require('fs');

(async () => {
  const only = (process.env.SITES || Object.keys(sites).join(',')).split(',');
  fs.mkdirSync('results/links', { recursive: true });
  let brokenTotal = 0;
  for (const key of only) {
    const site = sites[key];
    if (!site) continue;
    const checker = new LinkChecker();
    const result = await checker.check({
      path: site.base + '/',
      recurse: false,
      timeout: 15000,
      retry: true,
      linksToSkip: [/^mailto:/, /^tel:/, /upptime/i, /github\.com\/silasantosh/i],
    });
    const broken = result.links.filter((l) => l.state === 'BROKEN' && l.status !== 429);
    const limited = result.links.filter((l) => l.state === 'BROKEN' && l.status === 429);
    if (limited.length) console.log(`  rate-limited (protection, not counted): ${limited.length}`);
    brokenTotal += broken.length;
    fs.writeFileSync(`results/links/${key}.json`, JSON.stringify(result.links, null, 1));
    console.log(`[${key}] links: ${result.links.length}, broken: ${broken.length}`);
    broken.forEach((l) => console.log(`  BROKEN ${l.status} ${l.url}`));
  }
  process.exit(brokenTotal ? 1 : 0);
})();
