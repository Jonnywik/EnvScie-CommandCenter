# Verified external feed findings

## PAGASA sources reviewed on 12 August 2026

1. PAGASA homepage: https://www.pagasa.dost.gov.ph/
   - Identifies the Philippine Atmospheric, Geophysical and Astronomical Services Administration under DOST.
   - Exposes current weather, weather map, radar/satellite layers, alerts, and active-warning sections.
   - The page states that some weather data is loaded from an external source, so the implementation should use a controlled adapter and not scrape arbitrary DOM as the primary contract.

2. PAGASA severe weather bulletin: https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin
   - Provides a Tropical Cyclone Bulletin section and a bulletin archive.
   - The page notes that previously issued bulletins remain available for one calendar week after bulletin issuances terminate.
   - This supports treating source event identifiers, issued timestamps, expiry, and content hashes as required ingestion fields.

3. PAGASA weather page: https://pagasa.dost.gov.ph/weather
   - Publishes synopsis, tropical-cyclone information, forecast weather conditions, forecast wind/coastal water conditions, rainfall/landslide impact language, and related weather images.
   - This supports mapping source information to the project hazard types: flood, storm_surge, landslide, and wind.

## Implementation implication

Code for Resilience now exposes a normalized alert-ingestion endpoint and feed-health endpoint. A production connector should be configured against an officially approved PAGASA/LGU data contract, preserve raw payloads, compute content hashes, enforce source/event idempotency, and mark stale feeds when the last successful pull exceeds the configured threshold. The current demo source is explicitly labeled as seeded data.
