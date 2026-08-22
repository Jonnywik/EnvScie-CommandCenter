# Code for Resilience

## Cover
Code for Resilience
Balangiga LGU disaster-response platform
Architecture, offline-first communications, and command-center operations

## Slide 1
### The operating reality is fragmented during a crisis

- Typhoons, storm surges, and flash floods create rapidly changing local risk.
- Residents may lose power, signal, or reliable access to verified information.
- Responders need a shared picture of hazards, SOS requests, shelters, and capacity.
- The design target is not another alert feed; it is a resilient local response loop.

## Slide 2
### One system connects warning, movement, and assistance

- **Residents:** receive verified alerts, view risk layers, find evacuation centers, and send SOS requests.
- **Municipal operations:** triage incoming incidents, dispatch responders, and monitor center capacity.
- **Resilient transport:** use internet when available, then fall back to compact SMS with durable local outbox storage.
- **Decision principle:** cached information remains useful, but every cached record is visibly marked for re-verification.

## Slide 3
### A layered architecture keeps critical actions local

- **Mobile client:** React Native / Expo, local snapshot, emergency toolkit, location capture, SOS outbox.
- **Transport layer:** HTTPS and WebSocket for normal operations; signed, compact SMS for degraded connectivity.
- **FastAPI service:** asynchronous API routing, SOS intake, safe-route lookup, alert and evacuation APIs, dispatcher events.
- **Spatial core:** PostgreSQL + PostGIS for hazard polygons, evacuation centers, roads, and geospatial predicates.
- **Operations surface:** Next.js command center for the Balangiga LGU / DRRM team.

## Slide 4
### Offline SOS turns a weak signal into an actionable record

- Capture the minimum viable emergency packet: device identity, emergency type, coordinates, time, and message.
- Quantize coordinates and encode a compact payload that fits a single SMS message.
- Add CRC validation and a shared secret so corrupted or unauthenticated messages are rejected.
- Persist the SOS in a durable outbox; submit over internet when possible and hand off to SMS when offline.
- Preserve the original channel so dispatchers can distinguish internet, SMS, or mesh-originated reports.

## Slide 5
### Spatial intelligence routes people away from active flood zones

- Store evacuation centers as points and flood / landslide hazards as versioned polygons.
- Filter road segments that intersect active flood polygons before route calculation.
- Run Dijkstra over the remaining local road graph and return the nearest safe center.
- Show route confidence, distance, estimated travel time, and hazards avoided before dispatch.
- Keep the algorithm explainable: the map should make the safety constraint visible to responders.

## Slide 6
### The LGU dashboard turns incoming signals into a triage queue

- **Situation cards:** untriaged SOS, critical alerts, open centers, and residents at risk.
- **Live situation map:** active hazard overlays, SOS markers, open centers, and safe-route context.
- **Priority queue:** severity, age, channel, confidence, and current triage state in one scan.
- **Triage drawer:** acknowledge, dispatch team, resolve, inspect coordinates, and preserve incident history.
- **Verified feed:** official or LGU-published alerts remain separate from unverified community reports.

## Slide 7
### The response loop is designed for the first critical minutes

**Verify** the alert source and hazard layer.

**Locate** the resident or incident through coordinates and channel confidence.

**Route** to a safe center while avoiding active hazard polygons.

**Dispatch** the right team and update the incident state.

**Reconcile** new reports, center capacity, and field status through the live command view.

## Slide 8
### The current build is a runnable foundation, not a black box

- **Backend:** FastAPI demo mode with dashboard, alert, evacuation, route, SOS, and triage endpoints.
- **Frontend:** Next.js command-center dashboard with responsive map-style visualization and interactive SOS drawer.
- **Mobile:** Expo prototype with cached feeds, connectivity monitoring, durable outbox, internet submission, and SMS handoff.
- **Validation:** backend tests pass; dashboard production build passes; mobile TypeScript check passes.
- **Demo baseline:** 3 untriaged SOS, 1 critical alert, 4 open centers, and 187 residents at risk are seeded for review.

## Slide 9
### From prototype to operational readiness

- Import and validate municipal GIS layers, evacuation-center records, hotlines, and official alert feeds.
- Add identity, LGU role-based access, audit logs, rate limits, observability, and durable realtime pub/sub.
- Test the SMS gateway across delayed, duplicated, truncated, and reordered messages.
- Conduct field exercises with barangay responders, residents, carriers, and power / signal interruption scenarios.

A resilient system is ready when the safest next action remains available—even when the network is not.
