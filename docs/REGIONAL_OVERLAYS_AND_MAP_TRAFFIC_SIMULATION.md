# Regional Weather Overlays and Command Map Traffic Simulation

**Prepared by:** Manus AI  
**Date:** 23 August 2026 (PHT)  
**Scope:** Balangiga / Eastern Samar Command Map decision support

## Executive conclusion

The strongest next integration is an **approved PAGASA observation-and-warning layer stack**: radar quantitative precipitation estimates, PANaHON station observations, Himawari imagery, and the agency’s issued tropical-cyclone, storm-surge, rainfall, and severe-wind products. PAGASA identifies its radar QPE product as a rainfall-measurement capability and describes Himawari 8/9 as its principal real-time imagery for forecasting and tropical-cyclone analysis, with images generated every ten minutes. [1] [2] This combination is more locally authoritative than generic weather-map aggregators.

A controlled end-to-end test was also completed against the Manus-hosted Command Map. The application served **1,800 read-only map/weather requests with 100% valid HTTP 200 responses**, while the live browser switched to terrain, independently disabled radar and flood-risk overlays, and used reset. The native Google Map, layer drawer, marker set, and zoom/reset rail remained available. This is a successful bounded test, not proof of production capacity during a real public emergency or a test of upstream provider failure modes.

> **Operational boundary:** Every recommended layer is decision support. It does not establish flood depth, road clearance, damage, safe passage, signal availability, evacuation authority, or responder safety without current official information and field confirmation.

## Recommended overlay portfolio

| Priority | Overlay | Primary source and use | Required presentation controls | Important limit |
| --- | --- | --- | --- | --- |
| 1 | **Observed radar rainfall / QPE** | Use a formally approved PAGASA radar/QPE feed as the local observed-precipitation layer. PAGASA states that QPE identifies and measures rainfall during radar observations. [1] | Observation time, age, radar/QPE badge, opacity, source URL, unavailable state. | The public page does not establish a stable reusable tile/API contract; obtain written access terms before ingestion. |
| 1 | **Hydromet station observations** | Add PANaHON rainfall, wind, pressure, humidity and station freshness as point symbols, particularly for East Samar coverage. PANaHON publishes near-real-time automatic and manned-station information and ECMWF-backed forecasts. [3] | Station time, quality/freshness, observed vs forecast separation, no interpolation by default. | Sparse stations cannot prove barangay- or road-level conditions between sensors. |
| 1 | **Official impact and warning geography** | Overlay PAGASA-issued tropical-cyclone bulletins, storm-surge forecast areas, heavy-rainfall warnings, severe-wind impacts, and shipping warnings. PAGASA’s product catalogue exposes these as its national warning products. [4] | Issuance and expiry time, original warning geography, source link, explicit "official" label. | Preserve the agency’s published spatial and temporal meaning; never infer new warning polygons. |
| 2 | **Himawari visible / IR / water-vapour loop** | Use the official PAGASA or JMA Himawari 8/9 imagery as a system-scale cloud and cyclone-structure context layer. PAGASA reports ten-minute imagery and operational reliance for real-time forecasting and tropical-cyclone analysis. [2] | Product type, timestamp, animation stop/play, age, satellite-derived label. | It is not a direct observation of rainfall at ground level, wind at the surface, inundation, or damage. |
| 2 | **Satellite precipitation context** | Add JAXA GPM/GSMaP beside—not in place of—radar/QPE to show regional precipitation structure and gaps beyond radar coverage. [5] | Satellite-derived label, observation/processing time, coarse-resolution notice, separate palette. | Retrieval latency and resolution make it unsuitable for municipal clearance or life-safety decisions on its own. |
| 3 | **Regional track comparison** | Display JTWC position/forecast context in a secondary comparison layer, while retaining PAGASA as the Philippines authority. JTWC publishes active-system text, graphics, 3-hour updates, KMZ and satellite products, and directs users to national meteorological agencies for country-relevant products. [6] | Clearly labeled "regional comparison", issue time, forecast horizon, PAGASA primary-warning badge. | Do not treat a JTWC track as the local Philippine warning or impact area. |
| 3 | **Large-river flood context** | Add Copernicus GloFAS for basin-scale precursor context and Sentinel-1 flood-monitoring availability. It produces daily global river-flood forecasts and satellite-based monitoring when a new image is available. [7] | Forecast vs observation distinction, update age, basin-scale label, registration/auth state. | GloFAS explicitly excludes real-time flash-flood, coastal-flood, and inundation-area forecasting; it is not a municipal flash-flood or storm-surge clearance map. [7] |
| Deferred | **Lightning density / recent strike** | Procure a licensed, coverage-verified lightning feed for crew-exposure awareness and thunderstorm escalation. | Network/provider, coverage, strike age, confidence, license status, no-signal state. | No unverified scraped or consumer-map lightning feed should be operationalized. Procurement and SOP approval are required first. |

## Integration sequencing

The first implementation increment should create a common **overlay record** containing: provider, product name, observed-versus-forecast classification, issue/observation time, system ingest time, geographic resolution, age state, source URL, provider license/terms reference, and a short operational-limit statement. This makes the map auditable and prevents an old or modelled layer from being mistaken for live ground truth.

The second increment should prioritize approved PAGASA QPE/station/warning access and add failure-safe caching, stale status, and a visible source panel. Himawari and GSMaP can then be added as contextual overlays. JTWC and GloFAS should remain secondary tabs or comparison layers, never replace PAGASA warning text, and should be excluded from any automatic evacuation or dispatch action.

## Controlled end-to-end simulation

### Test design

The traffic portion used a saved, operator-run harness at `backend/tests/map_drawer_load_simulation.py`. It issued only GET requests to the hosted application’s existing map endpoints: `/api/v1/gis/map`, `/api/v1/weather/radar`, and `/api/v1/weather/typhoon`. It did **not** create SOS reports, alter operational records, issue notifications, assign responders, dispatch units, or write audit actions.

Each wave used 24 concurrent requests per endpoint across five rounds: **360 requests per wave**. Five consecutive waves created **1,800 total requests**. Every response was required to be HTTP 200 and to contain the expected map/weather response shape before it counted as valid. The complete final-wave JSON is provided in `MAP_DRAWER_LOAD_SIMULATION_RAW.json`.

| Measure | Result | Interpretation |
| --- | ---: | --- |
| Total read-only requests | 1,800 | 5 waves × 360 requests; no mutation requests were used. |
| Valid responses | 1,800 / 1,800 | All shape-checked requests returned HTTP 200. |
| Aggregate traffic duration | 5,879.14 ms | Sum of the five individual wave durations. |
| Aggregate throughput | 306.16 requests/sec | Aggregate measurement across the controlled waves. |
| Per-wave throughput | 277.13–327.80 requests/sec | Observed range under this environment and endpoint mix. |
| Worst endpoint p95 | 1,209.54 ms | The maximum p95 among all endpoint/wave samples. |
| Failures captured | 0 | No request failure or invalid response shape was recorded. |

### Browser user-flow verification

While the traffic wave was active, the hosted interface was exercised as a coordinator would use it. The map drawer was already open; the test selected **Terrain**, toggled **Live Weather Radar** off, and then toggled **Flood Risk Zones** off. The **Reset map view** control was also invoked. Browser inspection afterward confirmed that Google Maps remained initialized, Terrain remained selected, each overlay switch reflected its independent changed state, the drawer stayed open, all three zoom/reset controls remained present, four inspected operational markers remained available, and the legacy SVG fallback count stayed at zero.

| User-facing check | Result |
| --- | --- |
| Layer drawer availability | Passed; drawer remained open and interactive. |
| Terrain basemap selection | Passed; native Google terrain tiles were shown and the selected state was retained. |
| Radar switch | Passed; state changed independently without removing markers or the basemap. |
| Flood-risk switch | Passed; state changed independently without removing markers or the basemap. |
| Reset control | Passed; map returned to its intended reset behavior after the layer changes. |
| Operational overlays | Passed; evacuation, SOS, and response-resource markers remained present. |
| Native map and fallback isolation | Passed; `window.google.maps` was available and no legacy SVG fallback rendered. |

## Findings and next validation gates

The tested API path was responsive and error-free for this controlled read-only workload. However, the load harness covered the Command Center’s cached/served API response path, not the full rendering and tile-delivery capacity of Google Maps, RainViewer, a future PAGASA feed, or a public-facing surge in independent browsers. Before calling the system incident-ready at scale, the next validation should include browser-level concurrency, cache-miss and provider-timeout scenarios, mobile network throttling, rate-limit behavior, and an explicit degraded-mode operational exercise.

No automatic escalation, dispatch, warning transmission, evacuation order, or road-clearance conclusion was introduced by this test or by the recommended overlays.

## References

[1] [PAGASA — Radar](https://www.pagasa.dost.gov.ph/radar)  
[2] [PAGASA — Satellite / Himawari 8/9](https://www.pagasa.dost.gov.ph/products-and-services/satellite)  
[3] [PAGASA — National Hydro-Met Observing Network (PANaHON)](https://www.panahon.gov.ph/)  
[4] [PAGASA — Official weather and tropical-cyclone product catalogue](https://www.pagasa.dost.gov.ph/)  
[5] [JAXA — Global Satellite Mapping of Precipitation (GSMaP)](https://sharaku.eorc.jaxa.jp/GSMaP/)  
[6] [Joint Typhoon Warning Center — Tropical Warnings](https://www.cnmoc.usff.navy.mil/Our-Commands/Fleet-Weather-Center-San-Diego/Joint-Typhoon-Warning-Center/)  
[7] [Copernicus Emergency Management Service — About GloFAS](https://global-flood.emergency.copernicus.eu/general-information/about-glofas/)
