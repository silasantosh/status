# Site tests (390x844 mobile)

Per-site read-only end-to-end runner for Impact Connect, in-learn, in-meet, in-media.
Playwright (390x844, iPhone UA) + axe-core + Lighthouse CI + linkinator. All deps pinned in package-lock.json.

- Never submits real data: POSTs are intercepted and aborted after assertion.
- Sign-in path stops at form render. No credentials, no emails, no posts.
- Runs nightly 6:30 AM IST (`0 1 * * *` UTC) + on-demand (workflow_dispatch, `sites` input).
- Failures open/update one GitHub issue per site via the built-in GITHUB_TOKEN; auto-close on recovery.
- The learn watchdog reads the latest run results for the morning WhatsApp line.

Run locally: `cd tests && npm ci && npx playwright install chromium && SITES=ic,inlearn npx playwright test`
