// Per-site config for the test runner. Read-only tests: no real submits, no emails, no writes.
module.exports = {
  ic: {
    name: 'Impact Connect',
    base: 'https://impact-connect.in',
    apiHealth: 'https://api.impact-connect.in/api/health',
    pages: ['/', '/opportunities/', '/nonprofits/', '/account/', '/saved/'],
    accountPath: '/account/',
    cards: { listPath: '/opportunities/', rowSel: '.ic-act-row', sourceSel: '.ic-action-primary', tileAttr: 'data-ic', expectedTiles: ['summary', 'save', 'follow', 'remind', 'share', 'report'] },
  },
  inlearn: {
    name: 'in-learn',
    base: 'https://in-learn.in',
    pages: ['/', '/tracker/', '/guides/', '/daily-jobs/'],
    accountPath: '/tracker/',
  },
  inmeet: {
    name: 'in-meet',
    base: 'https://in-meet.in',
    apiHealth: 'https://api.in-meet.in/api/health',
    pages: ['/'],
    accountPath: '/account/',
  },
  inmedia: {
    name: 'in-media',
    base: 'https://in-media.in',
    pages: ['/', '/terms.html'],
    accountPath: null,
  },
};
