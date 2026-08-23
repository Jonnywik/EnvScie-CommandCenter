# PAGASA Radar and Lightning Layer Integration Plan

**Prepared for:** EnvScie CommandCenter / Code for Resilience  
**Scope:** Command Map drawer, Google Maps overlay lifecycle, FastAPI weather-feed adapters, and operational safeguards  
**Status:** Draft implementation plan; no new external feed is enabled by this document.

## 1. Purpose and operating boundaries

The Command Map should add a **PAGASA meteorological stack**—radar/QPE first, then officially permitted station and satellite context—alongside a **separately licensed lightning feed**. PAGASA describes its radar QPE product as a way to identify and measure rainfall during radar observations, and identifies Himawari imagery as a key real-time tropical-cyclone analysis product. [1] [2] PANaHON provides near-real-time station observations and forecast context that can supplement, but not replace, local field reports. [3]

> **Hard boundary:** A radar return, satellite image, lightning strike, forecast, or map symbol is situational context. It must not automatically clear a route, estimate flood depth, issue an evacuation order, change an SOS status, dispatch a unit, or claim crew safety. Those actions retain the existing operator verification and approval controls.

The plan deliberately separates **source acquisition**, **server-side normalization**, **map rendering**, and **operator interpretation**. This preserves provider attribution, prevents browser-side credential exposure, and ensures a paused, stale, rate-limited, or unavailable source remains visibly distinguishable from live observations.

## 2. Current architecture and target change

| Existing element | Current behavior | Planned evolution |
| --- | --- | --- |
| Command Map drawer | Contains Road/Satellite/Terrain controls plus `Live Weather Radar` and `Flood Risk Zones` switches. | Add a distinct **Live meteorology** group and explicit source status for PAGASA Radar/QPE, stations, satellite context, and licensed lightning. |
| Google map renderer | Clears and recreates operational overlays; renders RainViewer through one `ImageMapType` at regional zoom ≤10. | Introduce a named overlay registry so multiple tile, vector, and clustered point overlays can coexist in a fixed operational z-order. |
| Weather adapter | Uses a server-side cache, an in-flight lock, stale fallback, source URLs, and a five-minute radar cache. | Reuse the same adapter pattern for provider-specific PAGASA and lightning snapshots, plus a composite response to prevent client request stampedes. |
| Browser refresh | Fetches radar and typhoon snapshots every five minutes. | Fetch a single map-overlay snapshot on the existing cadence; toggles must render cached data only and never trigger provider calls. |
| Safety messaging | States that imagery and overlays do not confirm field safety or route clearance. | Preserve the message and add each overlay’s observed/forecast classification, age, coverage, and decision limit. |

## 3. Preconditions and approval gates

No provider integration begins until these gates are satisfied. The order matters: it prevents a public page, image URL, or undocumented endpoint from becoming a fragile or unauthorized operational feed.

| Gate | Owner | Evidence required | Outcome if unmet |
| --- | --- | --- | --- |
| PAGASA access authority | LGU DRRMO / legal / PAGASA liaison | Written permission or a documented public API/tile licence, allowed refresh frequency, redistribution/display terms, and supported product types. | Keep current RainViewer layer; do not scrape or hotlink PAGASA radar media. |
| Radar product definition | DRRMO meteorology focal person | Chosen product: reflectivity, QPE, accumulation, or warning geography; geographic coverage; intended update interval; legend; and interpretation SOP. | Do not label an unspecified image as “live radar.” |
| Lightning-provider procurement | DRRMO procurement / IT security | Vendor selection, Philippine/Eastern Visayas coverage statement, latency SLA, API/tile licence, retention terms, permitted users, cost owner, and escalation contacts. | Drawer shows no lightning switch; never substitute scraped consumer-map data. |
| Security configuration | System administrator | Credentials stored only in server-side secrets, allowed egress host list, rotation owner, and audit trail. | No browser token, URL token, or API secret is exposed. |
| Operational SOP | DRRMO operations lead | A written procedure defining how operators compare source age, verify alerts, and record decisions. | Data remains informational and cannot feed recommended or automated actions. |

## 4. Delivery options for feed refresh and cache ownership

The weather data is deterministic and the application already experienced a gateway rate-limit boundary during repeated reads. The plan therefore presents two viable operational models; the LGU should choose after confirming provider terms and desired freshness.

| Approach | How it runs | Trade-offs | Cost | Setup complexity |
| --- | --- | --- | --- | --- |
| **A. Demand-led shared cache** | The first permitted map request refreshes an expired server cache; all concurrent users receive the same normalized snapshot. A short client cadence reads only the composite endpoint. | Lowest operational complexity and avoids idle polling. The first operator after TTL expiry may see a cached/stale state briefly while a single refresh completes. | Uses existing application infrastructure; provider usage depends on contract. | Lower. |
| **B. Managed periodic prefetch** | A server-side scheduled job refreshes approved provider caches at contract-compliant intervals, while browser requests remain cache-only. | More predictable first-map freshness, but requires durable scheduling, monitoring, and explicit provider-rate governance. It must not run as a new agent session per minute. | Depends on hosting and provider contract; may require always-on capacity for sub-minute lightning. | Higher. |

For either approach, the browser must not independently poll each provider, and map-layer toggles must never cause a refetch. If the lightning SLA demands sub-minute updates or an inbound provider webhook, validate the provider’s callback support and hosting capacity before choosing the second model.

## 5. Target data contracts

Create a common metadata envelope rather than adding unrelated booleans. Every map overlay should communicate its provenance and operational limits consistently.

```ts
type OverlayFreshness = "live" | "cached" | "stale" | "rate_limited" | "unavailable";
type OverlayKind = "radar_qpe" | "station_observation" | "satellite" | "lightning";

type OverlayMeta = {
  id: string;
  kind: OverlayKind;
  provider: string;
  source_url: string;
  observed_at: string | null;
  fetched_at: string;
  expires_at: string | null;
  freshness: OverlayFreshness;
  coverage: string;
  resolution: string | null;
  decision_limit: string;
};
```

The composite response should extend the existing `RadarSnapshot` and `TyphoonSnapshot` rather than breaking them. Suggested fields follow.

| Snapshot | Required payload | Rendering method | Data-volume control |
| --- | --- | --- | --- |
| `pagasa_radar` | `OverlayMeta`, frame time, legend URL/version, tile template or approved proxied image, bounding box, supported zoom range. | Google `ImageMapType` for approved tile delivery; a timestamped ground overlay only if the provider permits a georeferenced image. | One most-recent frame by default; optional time scrubber only after cache and licensing approval. |
| `pagasa_stations` | `OverlayMeta`, station ID/name, coordinates, observed rainfall/wind values, observation time, quality/freshness state. | Clustered Google markers at low zoom; expanded, accessible station cards at operational zoom. | Limit to the operational region; aggregate or cluster outside the focus extent. |
| `pagasa_satellite` | `OverlayMeta`, product/channel, frame time, approved image/tile reference, bounding box. | Optional low-opacity image/tile context below hazards and markers. | One current frame; no uncontrolled animation loop. |
| `lightning` | `OverlayMeta`, provider event ID, coordinates, observed time, polarity/type if licensed, confidence/quality, coverage state, latency. | Server-clustered points or a grid/heat layer; individual strike markers only at high zoom and short history windows. | Default 15-minute history, bounded feature count, server-side spatial bucketing, and no event retention beyond the contract. |

The common response should be `GET /v1/weather/map-overlays`, with selective fields or `include=` flags only if profiling demonstrates a need. The UI reads one snapshot, while the server internally owns provider-specific refreshes. Existing `/weather/radar` remains compatible during migration, then can become a derived view of the composite snapshot.

## 6. Backend implementation sequence

### Phase 0 — access, governance, and fixtures

Create provider integration records in the database or managed configuration: legal contact, product name, refresh minimum, licence expiry, permitted geography, supported format, source URL, secret reference, and decision-limit text. Collect a small set of **permitted recorded fixtures** for adapter tests; do not use live provider calls in unit tests.

### Phase 1 — normalized adapter foundation

Extend `backend/app/services/weather_feeds.py` with one adapter per provider, following the existing cache-lock and stale-fallback pattern. Each adapter must validate schema, normalise coordinates/time zones, reject frames outside declared coverage, and retain the last known good snapshot only with `freshness: "stale"`. Add a short-lived negative cache for 401/403/429/provider errors so repeated browser requests do not amplify an outage.

Implement a `get_map_overlays_snapshot()` coordinator that deduplicates in-flight refreshes and returns the full normalized response. It must return an explicit `rate_limited` status when upstream or platform admission control rejects a request; it must not retry in a tight loop or convert missing data into a zero-hazard assertion.

### Phase 2 — approved PAGASA radar/QPE adapter

Implement the PAGASA adapter only after the chosen delivery format is documented. For tiles, use a server-side proxy/cache when terms allow; for GeoTIFF/GeoJSON, convert or expose a contract-compliant view without giving clients a provider credential. Capture the provider issue time, product/legend, coverage and permitted zoom level. The radar switch label should read **“PAGASA Radar/QPE”**, not merely “Live Weather Radar,” and should always display a time and freshness state.

Add a station adapter only after coverage near Balangiga is confirmed. Display station observations as points with `observed_at`, not interpolated surfaces. Satellite context is an optional later adapter, because it should not delay radar/QPE delivery and must preserve its separate observed-product label.

### Phase 3 — licensed lightning adapter

Build the lightning adapter behind a feature flag that remains off until procurement and coverage approval complete. Keep the raw provider response on the server; normalize the minimum allowed event fields and cluster them before returning the map response. Enforce a fixed history window, regional bounding box, maximum feature count, and provider-defined latency/quality label.

The adapter must expose `coverage_state` independently from `freshness`. A fresh feed with no coverage over Eastern Samar is **not** the same as no strikes; the drawer must say so. A lightning layer can inform crew awareness but cannot trigger a responder hold, reroute, alert, or notification without the established LGU approval workflow.

### Phase 4 — observability and source health

Add structured server logs and source-health metrics for refresh duration, cache hits, stale fallback, 401/403/429, schema rejects, feature counts, last provider observation time, and client response age. Surface a concise source-health chip in the Command Center’s existing health strip. Link each chip to a details panel with source, product, time, coverage, and limitations.

## 7. Map-drawer and Google Maps changes

### Drawer information architecture

Retain the current basemap group unchanged. Replace the two-item layer list with a grouped layout that remains usable on desktop and mobile.

| Drawer group | Control | Default | Required status text |
| --- | --- | --- | --- |
| Basemap | Road / Satellite / Terrain | Road | Existing active state. |
| Official observations | PAGASA Radar/QPE toggle | Off until access approved, then last operator preference | `Observed HH:MM PHT`, live/cached/stale/rate-limited, product name. |
| Official observations | PAGASA stations toggle | Off | Station count, newest observation age, coverage caveat. |
| Satellite context | Himawari context toggle | Off | Channel/product, frame time, satellite-derived label. |
| Lightning | Licensed lightning toggle | Off and disabled until contract is active | Event history window, newest event age, coverage/latency state. |
| Existing risk context | Flood Risk Zones | Existing behavior | `Static reference` label; never label as live inundation. |

Use accessible `role="switch"` controls with `aria-checked`, and add a non-color status label beside each switch. A disabled lightning control must state **“Provider access pending”** rather than implying no lightning. Operator preferences may persist locally only after confirming that a stale or unavailable default does not conceal an important source-health warning.

### Overlay renderer refactor

Refactor `GoogleOperationalMap` from a single `overlayMapTypes.clear()` call to a keyed registry, such as `radarQpe`, `satelliteContext`, and `lightningGrid`. Reconcile only layers whose inputs changed. Use the following z-order: basemap → satellite/radar rasters → flood-reference polygons → lightning grid/points → active hazards → route → evacuation/SOS/resources → controls and legend.

Render lightning as server-clustered grid cells or a heat layer at regional zoom, then show individual strikes only at closer zoom. Rendering every raw point at all scales is prohibited because it can obscure SOS/asset markers and amplify memory/paint costs during high-activity storms. Do not use the Google Maps heatmap visualization library until its loading and licensing path have been tested through the managed Maps loader.

## 8. Cache, rate-limit, and failure behavior

The previous map simulation established a gateway 429 boundary during an unthrottled sustained retry. This implementation must treat **admission control as an expected observable state**, not a generic source outage.

| Condition | Server response | Drawer behavior | Operator message |
| --- | --- | --- | --- |
| Fresh provider response | `freshness: live` | Render current permitted data. | `Observed at HH:MM PHT`. |
| Cache hit within TTL | `freshness: cached` | Render cached data normally. | `Cached; source observed at HH:MM PHT`. |
| Provider fails but last good cache exists | `freshness: stale` | Render only the last good overlay, visibly muted. | `Stale; verify with official bulletin and field reports`. |
| Provider or gateway 429 | `freshness: rate_limited`, retry timestamp if available | Keep last good data only if available; do not refetch on toggle. | `Refresh delayed by source limit; next attempt after …`. |
| No good cache / rejected schema / access error | `freshness: unavailable` | Do not render an invented blank-safe map. | `Unavailable; source is not confirming conditions`. |

Use a shared server cache, request coalescing, `Retry-After` when available, capped exponential back-off with jitter, provider-specific TTL floors, and a circuit breaker after repeated failures. User actions only change rendering state; they do not reset the circuit breaker or bypass a refresh minimum.

## 9. Verification plan and acceptance gates

| Test layer | Evidence required | Pass condition |
| --- | --- | --- |
| Adapter contract tests | Recorded, permitted provider fixtures for normal, malformed, stale, unauthorized, and 429 responses. | Correct schema normalization and explicit freshness state; no inferred hazard values. |
| API integration tests | Composite endpoint, source URL, times, coverage, disabled feature flag, cache coalescing, and no secret in response. | One provider refresh serves concurrent clients; secrets and restricted URLs never reach the browser. |
| Map unit/UI tests | Drawer grouping, keyboard navigation, `aria-checked`, disabled-provider explanation, status text, layer isolation, z-order. | A toggle changes only its intended map layer; SOS/resources remain readable. |
| Browser validation | Desktop and 390 px mobile; Road/Satellite/Terrain; live/cached/stale/rate-limited/unavailable fixtures. | No clipping/overlap, no page-scroll capture defect, and no duplicate legacy SVG under normal Maps operation. |
| Controlled load test | Approved request budget, single composite endpoint, concurrent operators, cache-hit and cache-miss scenarios. | No unexpected provider amplification; expected 429 produces a visible rate-limited state and recovery after back-off. |
| DRRMO scenario exercise | Typhoon + heavy-rain + lightning situation using approved SOP. | Operators can identify source age and limits; no automatic operational action is enabled. |

## 10. Delivery milestones

| Milestone | Deliverable | Exit gate |
| --- | --- | --- |
| M1 — data authority | Signed PAGASA access basis, lightning vendor selection, product dictionary, SOP owner. | Governance gates in Section 3 complete. |
| M2 — backend foundation | Common overlay schema, composite endpoint, cache/back-off/circuit breaker, fixtures, source health. | Contract and API tests pass. |
| M3 — PAGASA radar/QPE | Approved radar adapter and drawer control, source/freshness display, map overlay registry. | Provider terms and browser/desktop/mobile tests pass. |
| M4 — stations and satellite context | Optional approved station/Himawari adapters with distinct labels. | Coverage and decision-limit review pass. |
| M5 — lightning pilot | Feature-flagged licensed lightning adapter, clustering, status/coverage states, retention controls. | Procurement, coverage, security and performance gates pass. |
| M6 — operational readiness | DRRMO exercise, load/rate-limit report, updated SOP, operator training. | LGU sign-off; no automation boundary breached. |

## 11. Decisions needed before implementation

1. Which approved PAGASA delivery mechanism and product should be integrated first: QPE tiles, georeferenced image, vector warning geography, or a combination?
2. Does the LGU prefer the lighter **demand-led shared cache** or the more predictable **managed periodic prefetch** model from Section 4?
3. Which lightning provider has suitable Eastern Visayas coverage, permissible retention, latency, and procurement approval?
4. What is the DRRMO-approved default history window for lightning—15, 30, or 60 minutes—and which operator role can enable it?
5. Who owns source-health monitoring and the decision to disable an unreliable provider layer during an incident?

## References

[1] [PAGASA — Radar](https://www.pagasa.dost.gov.ph/radar)  
[2] [PAGASA — Satellite / Himawari 8/9](https://www.pagasa.dost.gov.ph/products-and-services/satellite)  
[3] [PAGASA — National Hydro-Met Observing Network (PANaHON)](https://www.panahon.gov.ph/)
