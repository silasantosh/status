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
    accountPath: null, // in-learn has no accounts by design ("No account or automatic sync")
  },
  inmeet: {
    name: 'in-meet',
    base: 'https://in-meet.in',
    apiHealth: 'https://api.in-meet.in/api/health',
    pages: ['/'],
    accountPath: null, // in-meet is local-first: no server accounts; /account/ is the app shell, only a hidden data-transfer passcode field (#transferPass), no sign-in control
  },
  inmedia: {
    name: 'in-media',
    base: 'https://in-media.in',
    pages: ['/', '/terms.html'],
    accountPath: null,
  },
};
