# Smoke test (node, in-memory D1 shim) - 2026-10-21
18/18 pass: status, handoff valid/invalid, register-options (enroll cookie), login-options no-owner,
code-request/code-verify wrong+right, session cookie, owner-data auth/noauth, origin rejection,
notes post/get/unknown-id, visuals gating, logout + post-logout 403, bogus login-verify, health.
WebAuthn ceremony itself is verified on the preview with a real authenticator (390px e2e).
