# Live Feed and Map Validation

**Scope.** This validation tested the Command Center’s public-source integration from the sandbox on 20 August 2026. It measures source delivery time, not the accuracy, geographic applicability, or operational validity of a source statement. Every weather, hazard, road, and evacuation decision still requires official and field confirmation.

## Live-source sampling

Each public URL was requested three times with redirect following, a five-second connection limit, and a twenty-second total-request limit. The table reports full-response time, which is the appropriate measure for the current HTML and archive retrieval paths.

| Source endpoint | HTTP availability | Mean | Range | Operational treatment |
|---|---:|---:|---:|---|
| PAGASA Visayas regional forecast | 3/3 HTTP 200 | 4.653 s | 3.750–5.538 s | **Live** regional weather narrative and warnings; cached by the Command Center before display. |
| PAGASA severe-weather bulletin | 3/3 HTTP 200 | 3.759 s | 3.396–4.036 s | **Live** official tropical-cyclone bulletin source; used by the Risk Map tracker and linked in the provincial workspace. |
| Project NOAH catalogue | 3/3 HTTP 200 | 2.101 s | 2.011–2.166 s | **Static-reference catalogue** metadata; used for transparent source discovery only. |
| Project NOAH Eastern Samar 100-year flood archive | 3/3 HTTP 200 | 7.862 s | 6.268–9.146 s | **Static-reference dataset** download (about 129.7 MB); deliberately not fetched in the interactive browser path. |

The source results show why the workspace requests only PAGASA live content during normal refreshes. The Project NOAH province archives are valuable hazard-reference material but are large static spatial datasets, not a real-time API or a live flood-observation feed. The workspace links to the relevant Eastern Samar archive and states its return-period context and decision limit instead of misrepresenting it as current inundation.

## Command Center API cache test

After restarting the FastAPI service to clear its in-memory cache, each endpoint was sampled once cold and once warm. All samples returned HTTP 200. The live snapshots were current (`stale: false`) during this check; the cyclone endpoint correctly reported no active cyclone at the sample time.

| Command Center endpoint | Cold response | Warm cached response | Result |
|---|---:|---:|---|
| Provincial PAGASA situation | 3.849 s | 1.0 ms | Live source fetched once, then served from bounded cache. |
| RainViewer radar metadata | 2.208 s | 1.2 ms | Live frame metadata fetched once, then served from bounded cache. |
| PAGASA tropical-cyclone status | 3.634 s | 0.8 ms | Live bulletin parsed once, then served from bounded cache. |
| Operational GIS snapshot | 1.5 ms | 1.3 ms | Local Command Center GIS API remained immediately responsive. |

The deterministic provincial weather regressions also passed (**2 passed**), including the stale/fallback response contract. This validates that an upstream failure produces an explicit safe fallback rather than blocking or inventing live conditions.

## Feed resilience contract

The provincial endpoint caches PAGASA’s regional page and returns its last successful snapshot with `stale: true` if the public page cannot be refreshed. It retains source links and Project NOAH reference cards even during that safe fallback. The separate radar and tropical-cyclone endpoints use their own bounded requests and freshness flags.

The Command Center Risk Map is API-driven in three distinct ways: the satellite base imagery is requested from Esri’s World Imagery export service; radar frames are requested through the RainViewer public weather-map service; and tropical-cyclone status is requested through the backend’s cached PAGASA bulletin adapter. Local operational hazards, SOS reports, centers, routes, and tracked resources are supplied by the Command Center GIS API snapshot and event-refresh path.

## Responsiveness boundary

Panning, wheel zoom, touch pinch, button zoom, and reset execute locally against the SVG viewport and do not request or block on a public weather page. The map panel preserves its scope: its interactions do not scroll or zoom the page. Public feeds refresh asynchronously on a five-minute interval and present an explicit unavailable or cached state instead of blocking the operational map.

## Browser-map responsiveness test

The running production Command Center was refreshed from the Risk Map workspace and then tested with a synthetic, cancelable wheel event scoped to the map panel. The UI remained settled after 903 ms, while the individual same-origin API calls completed in 15–24 ms. The API response timing is not a public-source latency measurement: it reflects the validated warm-cache and local GIS paths described above.

| Check | Observed result |
|---|---|
| Command Center API refresh | `/api/v1/gis/map`, dashboard, feed-health, operations, response-group, communications, notification, and provincial-situation requests observed at 15–24 ms. |
| Satellite imagery source | Rendered `<image>` source was Esri World Imagery’s ArcGIS REST `MapServer/export` API. |
| Weather-radar source | One rendered RainViewer tile was present in the map canvas. |
| PAGASA feed state | Map status reported a current radar refresh and the explicit no-active-cyclone state from the live cached bulletin adapter. |
| Map-only wheel zoom | Viewport transform changed from `scale(1.18)` to `scale(1.3924)` with translated anchor compensation. |
| Page interaction isolation | Browser page scroll position was unchanged by the map-panel wheel event. |

This confirms the Risk Map is not backed by a bundled screenshot: it renders Esri imagery from an external ArcGIS REST API, overlays current RainViewer radar-tile API data, and refreshes operational features from the Command Center GIS API. The static Project NOAH provincial archives remain source-linked hazard references and are intentionally excluded from the interactive refresh path.

The browser does not expose detailed timing entries for these cross-origin image requests, so the exact rendered URLs were also sampled directly three times. The ArcGIS imagery export returned HTTP 200 in 2.088–2.433 s (mean **2.271 s**). The RainViewer radar tile returned HTTP 200 in 2.046–2.237 s (mean **2.168 s**). These image-network times are asynchronous and do not affect the local pan, zoom, pinch, or reset interactions after the image is rendered.

> **Decision-support boundary.** API-driven imagery, weather radar, and PAGASA bulletins do not establish live flood depth, damaged infrastructure, road passability, structural safety, or an evacuation order. Project NOAH reference layers identify modeled potential exposure, not current impact. Verify official advisories and field reports immediately before dispatch or public guidance.

## Source links

1. [PAGASA Visayas regional forecast](https://www.pagasa.dost.gov.ph/regional-forecast/visprsd)
2. [PAGASA severe-weather bulletin](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin)
3. [Project NOAH hazard-map catalogue](https://data.bettergov.ph/datasets/22)
4. [Project NOAH Eastern Samar flood-hazard archive](https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/blob/main/Flood/100yr/EasternSamar.zip)
5. [Esri World Imagery](https://www.esri.com/en-us/arcgis/products/arcgis-living-atlas)
6. [RainViewer weather maps](https://www.rainviewer.com/)
