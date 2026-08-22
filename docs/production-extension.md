# Production Extension Baseline

The current implementation extends the Code for Resilience demo into a more controlled operational foundation. The backend now supports signed bearer sessions, role-aware dispatcher actions, immutable audit-event contracts, idempotent normalized alert ingestion, feed-health reporting, a unified bootstrap synchronization endpoint for the mobile client, and auditable assignment-notification delivery state.

## Operational functions added

| Function | Endpoint or artifact | Purpose |
|---|---|---|
| Demo sign-in | `POST /v1/auth/demo-login` | Creates a signed development token for dispatcher, responder, resident, or admin testing. |
| Current identity | `GET /v1/auth/me` | Returns the active role and display identity. |
| Audit review | `GET /v1/auth/audit` | Exposes demo audit events; production mode reads from the PostGIS audit table. |
| Role-protected triage | `PATCH /v1/sos/{id}/status` | Requires dispatcher, responder, or admin role and records the transition. |
| Alert ingestion | `POST /v1/admin/alerts/ingest` | Upserts normalized alerts by `(source_name, source_event_id)` and content hash. |
| Feed health | `GET /v1/admin/feeds/health` | Reports last successful pull, stale state, content hash, and last error. |
| Mobile bootstrap | `GET /v1/sync/bootstrap` | Returns one cursor-bearing snapshot of active alerts and evacuation centers. |
| Assignment notifications | `GET /v1/notifications`, `POST /v1/notifications/{id}/acknowledge`, `POST /v1/notifications/{id}/retry`, `WS /v1/ws/notifications` | Shows SMS/in-app delivery state, records unit receipts, permits dispatcher retries, and broadcasts lifecycle events. |
| Database migrations | `db/002_operational_controls.sql`, `db/003_alert_sync.sql` | Adds identity linkage, audit events, feed sources, and feed-run observability. |

The alert contract is deliberately source-neutral. The approved adapter boundary should be connected to an officially authorized PAGASA or LGU feed rather than relying on arbitrary page scraping. PAGASA’s official site publishes weather, active warnings, radar/satellite layers, and alert-related content [1]. Its severe-weather bulletin page identifies a bulletin archive and notes that historical bulletins remain available for only a limited period after issuance ends [2]. The weather page publishes forecast conditions, tropical-cyclone information, coastal-water conditions, and possible flash-flood or landslide impacts [3]. These properties are why the ingestion model retains source event IDs, issued and expiry timestamps, raw payloads, and content hashes.

> “This archive of previously issued bulletins for a particular tropical cyclone will remain available on this website within one (1) calendar week only from the termination of bulletin issuances.” — PAGASA severe weather bulletin page [2]

## Client behavior

The LGU dashboard now bootstraps a dispatcher session at startup, sends the bearer token with triage mutations, and displays feed-health status beside the verified alert feed. The resident app now uses the unified bootstrap endpoint for snapshot refresh, persists its server cursor and source provenance, retries queued or failed internet SOS records on reconnection, and keeps failed-delivery diagnostics in the durable outbox. SMS remains the fallback path when data service is unavailable.

## Assignment notification boundary

When a dispatcher assigns a response group, the same assignment action creates an SMS record and an in-app record. In demo mode, both records are stored in the in-memory operational state, the in-app channel is delivered immediately, and the SMS channel completes after a deterministic two-second gateway simulation. The simulation can produce a failed SMS receipt without making an external call, so the Command Center exercises the same retry, delivery-status, acknowledgement, and audit flow used by a live deployment.

Live SMS delivery is intentionally not enabled by default. A production deployment must provide `SMS_PROVIDER_URL`, `SMS_SENDER_ID`, and `SMS_PROVIDER_API_KEY` through the deployment secret manager. The adapter sends a Twilio-compatible form payload with `From`, `To`, and `Body`; provider failures are persisted as delivery failures rather than silently discarded. Push delivery requires `PUSH_PROVIDER_URL` and a separate device-token registration path before it can be enabled for field units. No provider connector or credential is configured in the current demo session.

Delivery attempts are capped by `NOTIFICATION_RETRY_MAX` (default `3`). Every queue, retry request, delivery update, and acknowledgement is recorded in the demo audit log or the production `cfr.assignment_notifications` table. The Command Center exposes pending and failed counts, channel-specific status, timestamps, attempt counts, retry controls for dispatchers, and acknowledgement controls for unit receipt simulation.

## Validation status

The backend suite passes with **18 tests** including authenticated assignment notification creation, delivery-state visibility, acknowledgement, retry, and audit coverage. The Next.js dashboard passes its production build and type validation. The Expo mobile project passes its TypeScript check. Browser verification covers assignment creation, the pending navigation badge, simulated SMS delivery, in-app delivery, both acknowledgement actions, the acknowledgement toast, and the cleared `0 pending · 0 failed` state. The stabilization pass also persists PostGIS SOS status events, removes the hard-coded SMS destination, fixes the mobile SMS payload call, and verifies the feed-health runtime path.

## References

[1]: https://www.pagasa.dost.gov.ph/ "PAGASA official homepage"

[2]: https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin "PAGASA Tropical Cyclone Bulletin"

[3]: https://pagasa.dost.gov.ph/weather "PAGASA weather information page"
