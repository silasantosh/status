const sites = require('../sites');

function siteConfig(testInfo) {
  return sites[testInfo.project.name];
}

// Collect page errors and console errors, excluding known third-party noise.
function watchErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const ALLOW = [
    /favicon/i, /net::ERR/i, /Failed to load resource/i, /tile\.openstreetmap/i,
    /third-?party/i, /ResizeObserver/i, /manifest/i, /preconnect/i,
  ];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !ALLOW.some((re) => re.test(m.text()))) consoleErrors.push(m.text().slice(0, 300));
  });
  return { pageErrors, consoleErrors };
}
module.exports = { siteConfig, watchErrors };
