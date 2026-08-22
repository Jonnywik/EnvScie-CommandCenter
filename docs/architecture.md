# Code for Resilience
## Foundational architecture for Balangiga disaster management

**Target municipality:** Balangiga, Eastern Samar  
**Primary users:** residents, LGU DRRM staff, dispatchers, and field responders  
**Author:** Manus AI  
**Status:** foundational scaffold for implementation and Figma translation

## Architectural position

The system should be designed as a **degraded-mode safety system**, not as an ordinary online CRUD application. The mobile client must remain useful when the backend, cellular data, electricity, or map service is unavailable. The LGU command center must distinguish a verified current alert from a cached alert, and it must distinguish an SMS that reached the gateway from an SOS that was acknowledged by a dispatcher.

The core architecture is a shared FastAPI/PostGIS service with two clients. The resident client uses a local cache and a durable SOS outbox. The Next.js command center uses a cached snapshot plus a real-time event stream. Official hazard/weather feeds are normalized into verified alert records by backend ingestion workers; field and community reports are kept as a separate operational signal and are never silently presented as official warnings.

| Layer | Recommended implementation | Resilience responsibility |
|---|---|---|
| Resident mobile | React Native with SQLite/WatermelonDB or a small encrypted SQLite adapter | Offline toolkit, cached alerts/maps, durable SOS outbox, SMS handoff |
| LGU dashboard | Next.js App Router with TanStack Query and a WebSocket/SSE client | Live triage, cached queue, freshness indicators, audit trail |
| API | FastAPI with async SQLAlchemy and asyncpg | Validation, idempotency, spatial queries, WebSocket fan-out |
| Data | PostgreSQL + PostGIS; optional pgRouting when the road graph grows | Hazard geometry, shelter locations, road graph, incident history |
| Feed ingestion | Separate deterministic worker with source adapters | Poll official sources, normalize, deduplicate, expire stale alerts |
| Realtime backbone | Redis Streams, NATS, or another durable pub/sub layer in production | Fan-out across API workers; replay after brief disconnects |
| Map delivery | Pre-downloaded local tiles plus a server tile endpoint | Map remains readable without a live basemap request |

The supplied project brief identifies PAGASA and NDRRMC as the initial official-source targets. Keep those integrations behind an adapter interface so source authentication, response formats, polling cadence, and licensing can change without touching the mobile or dashboard clients.

---

# Step 1 — PostGIS database schema

The executable schema is in [`db/001_init.sql`](../db/001_init.sql). It enables `postgis` and `pgcrypto`, places the application tables in the `cfr` schema, and creates spatial GiST indexes for point, line, and polygon layers.

## Spatial model

`evacuation_centers.geom` stores shelter points in EPSG:4326. `hazard_zones.geom` stores `MultiPolygon` boundaries so a single source event can contain multiple disconnected areas. `road_segments.geom` stores the local routable road graph. API input remains WGS84 longitude/latitude; distance calculations cast to `geography` so the result is in meters. PostGIS documents `ST_Intersects` as the spatial predicate for intersecting geometries [1], and its `<->` operator can provide index-assisted nearest-neighbor ordering [2].

The schema stores both **source provenance** and **operational freshness**. A hazard polygon is active only when `is_active` is true, `valid_from <= now()`, and `valid_until` is null or in the future. Ingestion must preserve `source_name`, `source_version`, and timestamps so an operator can answer which official dataset produced an alert or polygon.

## SOS model and idempotency

The `sos_requests` table stores a point, client timestamp, receiving channel, emergency type, current triage status, accuracy, and a `dedupe_key`. The unique constraint on `dedupe_key` is essential because the same physical incident may arrive first through the internet and later through SMS, or may be retried after a timeout. The database should create one logical record and append status changes to `sos_status_events`.

The `registered_devices` table intentionally uses a non-secret public identifier. Device identity is useful for deduplication and last-seen information; it is not sufficient proof that a person is who they claim to be. The SMS gateway must authenticate its inbound request separately, and the LGU should treat unverified caller identity as an operational fact rather than inventing a name.

## Operational data rules

| Rule | Implementation |
|---|---|
| Never route through an active flood polygon | Exclude any road segment where `ST_Intersects(road_segments.geom, active_flood.geom)` is true |
| Never recommend a closed/full shelter | Filter `status` and `occupancy_current` before routing |
| Do not label stale data current | Return `issued_at`, `expires_at`, and `retrieved_at` to clients |
| Preserve source lineage | Store source name, event ID, version, URL, and raw normalized payload |
| Avoid geometry confusion | Keep 4326 at the API boundary; use `geography` for meter distances |
| Make retries safe | Unique source event IDs and SOS dedupe keys; use upserts |

A production migration should also validate incoming geometries with `ST_IsValid`/`ST_MakeValid`, run `ANALYZE` after bulk GIS imports, and quarantine source data that has an invalid CRS, impossible coordinates, or a validity window in the past.

---

# Step 2 — FastAPI backend architecture

## Directory structure

```text
backend/
├── requirements.txt
└── app/
    ├── main.py
    ├── api/
    │   └── routes.py
    ├── core/
    │   ├── config.py
    │   └── db.py
    ├── schemas/
    │   └── sos.py
    └── services/
        ├── realtime.py
        ├── routing.py
        └── sos_codec.py
```

The starter uses async SQLAlchemy sessions and raw SQL for the spatial statements because the PostGIS predicates are clearer and easier to `EXPLAIN`. As the domain grows, add Alembic migrations, domain services, repository boundaries, authentication dependencies, and structured audit logging. Keep the `cfr` schema out of the default public namespace so accidental table name collisions are less likely.

## Safe routing algorithm

The executable implementation is [`backend/app/services/routing.py`](../backend/app/services/routing.py). It follows this sequence:

1. Query open or unknown-status centers that have remaining capacity and do not intersect an active flood polygon. Order candidates by index-assisted nearest-neighbor distance.
2. Query road segments and exclude any segment intersecting an active flood polygon. This is the hard safety constraint; a flooded segment is not merely given a high cost.
3. Expand the filtered segments into a directed adjacency list. Add a reverse edge only when the segment is not one-way.
4. Snap the resident and each candidate center to the nearest retained graph node.
5. Run Dijkstra using `base_cost_seconds` as the edge weight. Return the first reachable center in nearest-first candidate order and the route geometry.
6. Return the time at which the safety decision was made. The client must show that timestamp because a route is a point-in-time recommendation, not a guarantee.

For a municipality-scale graph this keeps the safety rule visible in code. When the graph becomes large or when travel-time modeling needs turn restrictions, elevation, bridge status, or multiple hazard penalties, move the graph search to pgRouting or a dedicated routing service. Preserve the same pre-routing hazard exclusion and attach the hazard snapshot/version to the route response.

The critical query shape is:

```sql
SELECT ec.id, ec.name
FROM cfr.evacuation_centers AS ec
WHERE ec.status IN ('open', 'unknown')
  AND ec.occupancy_current < ec.capacity_total
  AND NOT EXISTS (
      SELECT 1
      FROM cfr.hazard_zones AS hz
      WHERE hz.is_active
        AND hz.hazard = 'flood'
        AND hz.valid_from <= now()
        AND (hz.valid_until IS NULL OR hz.valid_until > now())
        AND ST_Intersects(ec.geom, hz.geom)
  )
ORDER BY ec.geom::geography <-> ST_GeomFromText(:point_wkt, 4326)::geography
LIMIT :candidate_limit;
```

This query finds safe candidates; it does not by itself prove that a road route is safe. The road-segment filter and graph search are required as well.

## Compact offline SMS payload

The codec is in [`backend/app/services/sos_codec.py`](../backend/app/services/sos_codec.py). It uses the following intentionally compact, human-debuggable wire format:

```text
CFR1;device;nonce;type;lat5;lon5;accuracy;unix_seconds;crc32
```

Latitude and longitude are quantized to five decimal places and encoded in base36. The nonce allows the backend to deduplicate retries. The CRC32 detects a mistyped or damaged payload; it is **not authentication**. The inbound gateway request must be authenticated with a provider signature or a mutually authenticated network path. The API must not trust a user-controlled field as proof that an SMS originated from an authorized device.

A sample encoder call is:

```python
from app.services.sos_codec import encode_sms_payload

payload = encode_sms_payload(
    device_public_id="a1b2c3d4",
    nonce="k9m2x7",
    emergency_type="MED",
    latitude=11.1264,
    longitude=125.3892,
    accuracy_meters=25,
    client_epoch=1780000000,
)
# CFR1;a1b2c3d4;k9m2x7;MED;...;...
```

## SMS intake endpoint

The executable endpoint is `POST /v1/sos/sms` in [`backend/app/api/routes.py`](../backend/app/api/routes.py). The intended gateway contract is:

```http
POST /v1/sos/sms
Content-Type: application/json
X-Gateway-Signature: <HMAC supplied by the SMS provider>

{
  "sender_phone": "+639171234567",
  "message": "CFR1;a1b2c3d4;k9m2x7;MED;...;...",
  "gateway_received_at": "2026-08-12T10:20:00Z"
}
```

The handler authenticates the gateway envelope, decodes the CFR1 message, verifies the CRC, rejects timestamps outside the configured acceptance window, derives an idempotency key from sender/device/nonce, persists the SOS as `channel = 'sms'`, and publishes a dashboard event. The database `ON CONFLICT` clause makes a retry return the original record instead of duplicating it.

The starter gateway secret defaults to `change-me` and intentionally causes a `503` until configured. This prevents a developer from accidentally deploying an unauthenticated emergency endpoint. A real deployment must use secret storage, key rotation, request replay protection, rate limiting, and provider-specific signature verification.

## Real-time LGU sync

The starter exposes `WS /v1/ws/lgu`. [`backend/app/services/realtime.py`](../backend/app/services/realtime.py) is a single-process connection hub to make the contract testable. It is not sufficient for multiple API workers: production must publish `sos.received` and status events to Redis Streams, NATS, Kafka, or an equivalent durable broker, then have each WebSocket worker subscribe. On reconnect, the browser must refetch the authoritative queue snapshot rather than assume that no message was missed.

---

# Step 3 — Frontend and UI/UX component tree

The dashboard tree is in [`frontend/docs/component-tree.md`](../frontend/docs/component-tree.md). The resident flow and state machine are in [`mobile/docs/offline-state-machine.md`](../mobile/docs/offline-state-machine.md).

## Next.js LGU dashboard responsibilities

The dashboard should be split into four boundaries: authentication/session, server-state cache, real-time event transport, and presentation. TanStack Query or an equivalent cache should own the queue and alert snapshots. A WebSocket provider should only invalidate or patch those snapshots; it should not be the only copy of data. URL state should own selected incident IDs and filters so a dispatcher can deep-link a case.

The primary view combines a priority SOS queue, a live situation map, and a verified alert feed. The queue is ordered by severity, age, location confidence, and triage status. Every row shows the receiving channel because an SMS-derived record has different delivery semantics from an internet-originated event. The map layers are independently toggleable: flood, landslide, storm surge, evacuation centers, and SOS clusters.

A dispatcher must be able to acknowledge an SOS, assign it to a responder team, add a note, and resolve it, but the interface must not collapse those into one irreversible button. The backend owns the valid transition graph and the audit event. The dashboard renders error states when a second dispatcher has already changed the incident.

## Mobile primary user flow

The resident flow is `Alert → Map → Evacuation → SOS`. The home screen renders cached verified alerts and offline toolkit content before attempting a network refresh. The map renders the last downloaded hazard and evacuation snapshot if offline, and the interface clearly identifies whether the route is live, cached, or unavailable. The SOS button is a hold-to-confirm control and records a local outbox item before selecting internet, SMS, or mesh transport.

The minimum durable state is:

| State slice | Required fields | Local durability |
|---|---|---|
| Connectivity | online/degraded/offline, lastOnlineAt, active transport | Yes |
| Alerts | entities, source, issued/expires/retrieved timestamps, sync state | Yes |
| Evacuation | centers, hazard-layer version, last sync, route | Yes |
| SOS outbox | local ID, nonce, coordinates, event time, delivery state, retries | Yes and transactional |
| Location | permission, last fix, accuracy, capture time | Yes for last fix; do not invent a new fix |
| Toolkit | bundle version, hash/integrity state, content | Bundled plus cached updates |
| UI | current screen, selected alert/center, confirmation sheet | Ephemeral or session storage |

The key guarantee is that pressing SOS never depends on the network round trip to create the local incident record. If the device loses power immediately afterward, the next launch must recover the outbox item and continue delivery or display that the handoff is incomplete.

## Offline transition semantics

The state machine in [`mobile/docs/offline-state-machine.md`](../mobile/docs/offline-state-machine.md) defines the transitions. The most important distinctions are **queued**, **handed to SMS**, **sent to API**, and **acknowledged by LGU**. The UI must never call “handed to SMS” “received by the LGU,” and it must never call “API accepted” “rescuer dispatched.” Those are separate operational facts.

Mesh communication is a later transport adapter, not a separate incident model. A BLE relay should carry the same signed/idempotent envelope, record hop count and first-seen time, and expire messages after a bounded TTL. The first release should keep the transport interface small and ship the internet/SMS paths reliably before adding mesh behavior.

---

# Step 4 — Edge-case and bottleneck analysis

## Bottleneck 1: concurrent SOS arrivals and duplicate delivery

A typhoon can produce bursts of SOS calls, while unreliable networks can cause the same request to retry through multiple transports. A naive `SELECT then INSERT` flow will race and create duplicates; a naive in-memory queue will lose events during worker restarts.

**Mitigation:** generate the local `localId`/nonce before transport selection; derive a stable server `dedupe_key`; enforce a unique database constraint; use `INSERT ... ON CONFLICT`; publish an event only after the transaction commits; and place committed events on a durable broker. Add a partial index or queue view for untriaged critical events, and use a short transaction that does not hold locks while sending push notifications. The command center refetches a snapshot after reconnect, so a missed WebSocket frame cannot erase an SOS from the queue.

## Bottleneck 2: spatial query latency and stale routes

Repeated polygon intersection tests and nearest-center queries become expensive as hazard layers and road segments grow. More importantly, a fast query can still return an unsafe answer if the hazard snapshot changes during routing.

**Mitigation:** use GiST indexes on all geometry columns; keep the KNN `<->` query index-friendly; pre-normalize hazard polygons and run `ANALYZE` after imports; bound the number of candidate shelters; cache immutable/prepared map tiles separately from route decisions; and log the hazard data version and `route_is_safe_as_of` timestamp in every route response. For larger graphs, precompute connected components or use pgRouting with a materialized “blocked segment” view. If a critical hazard update arrives during a route request, prefer returning “route requires refresh” to silently serving a route based on old polygons.

## Bottleneck 3: power/signal failure and false confidence in delivery

A user can lose cellular data but retain SMS, have no signal at all, or see the SMS composer open without a provider handoff. A dashboard can be online while official feeds are stale. Treating all of these states as binary online/offline produces unsafe user expectations.

**Mitigation:** expose a transport state machine and explicit timestamps. Persist an offline toolkit and last verified alerts locally; keep a bounded SOS outbox; use a native, user-approved SMS handoff or a carrier gateway; show “handoff complete” separately from “LGU acknowledged”; and present verified-feed freshness on both mobile and dashboard. Use a cached local map snapshot and an offline center directory. If no transport is available, the app immediately presents offline hotlines and first-aid guidance rather than spinning indefinitely.

## Additional hazards to test before pilot

| Edge case | Required behavior |
|---|---|
| GPS fix has 500 m accuracy | Send the fix with accuracy; mark location confidence low; ask for confirmation |
| User is inside an active flood polygon | Do not route through the polygon; show nearest safe fallback and “shelter status may change” |
| All centers are full or closed | Return a clear no-safe-center state and show LGU hotline/alternate assembly guidance |
| SMS arrives twice | Same dedupe key; one SOS record; audit log may record duplicate reception |
| Client clock is wrong | Include gateway receive time; accept a bounded window and flag skew for review |
| Hazard feed fails for several polls | Keep last verified alert but mark stale; do not extend expiry automatically |
| WebSocket disconnects | Reconnect with backoff, then refetch queue snapshot and reconcile by SOS ID |
| Two dispatchers triage one SOS | Use optimistic concurrency/version checks; reject stale update and show latest audit event |
| Offline bundle update is corrupt | Retain the prior verified bundle and the minimal bundled safety content |
| Map tiles unavailable | Use local cached tiles or a simple center list; never block SOS on the map |

---

# Recommended implementation sequence

**Phase 1:** run the SQL migration, seed a small set of verified evacuation centers, import a versioned road graph, and build the SOS endpoint with a fake authenticated gateway adapter. Add unit tests for codec round trips, CRC failures, timestamp rejection, and duplicate delivery.

**Phase 2:** implement the safe-route query and a route snapshot endpoint. Test with known flood polygons, a road segment that crosses a polygon, a center inside a polygon, and a disconnected safe graph. Add `EXPLAIN (ANALYZE, BUFFERS)` checks to the deployment runbook.

**Phase 3:** implement the mobile local cache/outbox and the dashboard snapshot/reconnect flow. Use seeded data to conduct a tabletop exercise: turn off data, trigger SOS, restore SMS/API, disconnect the dashboard socket, and verify that the final queue contains exactly one incident.

**Phase 4:** add official-source adapters, alert expiry, source provenance, responder assignment, audit exports, role-based access control, and operational observability. Only after those paths are reliable should the team add BLE mesh relaying, because mesh increases the security, duplication, and battery-management surface.

## References

[1]: https://postgis.net/docs/ST_Intersects.html "PostGIS ST_Intersects documentation"
[2]: https://postgis.net/docs/geometry_distance_knn.html "PostGIS KNN distance operator documentation"
[3]: https://postgis.net/docs/ST_Distance.html "PostGIS ST_Distance documentation"
[4]: https://fastapi.tiangolo.com/advanced/websockets/ "FastAPI WebSockets documentation"
