# Notification browser verification notes

The dashboard initially remained on its server-rendered loading state because the bootstrap requested protected snapshots before `demoLogin` resolved and used an all-or-nothing `Promise.all` loader. The dashboard was patched to await demo authentication, use `Promise.allSettled`, and expose an explicit retry state.

Manual browser fetches from `http://localhost:3001` to the backend succeeded for `/v1/auth/me`, `/v1/dashboard/summary`, and `/v1/notifications` using the stored bearer token. The served Next.js bundle contains the new `Promise.allSettled` and retry strings.

The browser’s actual dashboard traffic was observed as `OPTIONS` preflights from the sandbox proxy, with several requests returning `400` before a demo-only CORS origin regex was added in `backend/app/main.py`. A direct preflight including `authorization,content-type` now returns `200` with the expected origin and headers. The demo-only matcher was then broadened to `https?://.*` because the browser proxy sends a rewritten origin form that is not stable across reloads. All six protected dashboard preflights now return `200`.

Manual browser requests to all seven data endpoints return `200` with `cors` response type, but the server-rendered loading element has no React internal hydration markers after five seconds and no automatic dashboard requests are visible. This points to a Next.js client hydration/runtime issue separate from the API or notification endpoints.

After restarting the stale Next.js dev server and clearing `.next`, the Command Center hydrated normally. Browser verification assigned **Delta Water Rescue** to SOS `e6c8edb4`; the UI showed the pending badge, a simulated SMS row in `sending`, and an in-app row in `delivered`. After the two-second demo delay, SMS reached `delivered`. The SMS row and then the in-app row were acknowledged, both rows showed `acknowledged`, the toast confirmed `DELTA-BOAT acknowledged the assignment`, and the panel returned to `0 pending · 0 failed`.
