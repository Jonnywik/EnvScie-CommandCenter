# Command Map Rendering Restoration

## Reported Symptom

The hosted Command Map could briefly display a blank map field even while the Google Maps JavaScript loader, GIS endpoint, and map-tile requests were healthy. This was a client-side visual-timing condition: the application treated JavaScript-map construction as ready before the map tiles had visibly painted.

## Reliability Changes

The map loader now clears a rejected shared loader promise and removes the failed script element, allowing a fresh attempt after a transient script-initialization failure. The map component makes one bounded retry after 700 milliseconds; a continued failure still exposes the local interactive fallback rather than silently leaving a blank map.

The deterministic local fallback remains visible until Google Maps emits its `tilesloaded` event and two animation frames have elapsed. This covers the interval between JavaScript-map initialization and visible tile paint. Existing fallback interactions, local hazards, evacuation centers, SOS records, response resources, weather context, and safety notices remain available during that interval.

## Validation

| Check | Result |
| --- | --- |
| Backend health, GIS snapshot, and same-origin Google Maps script relay | HTTP 200 |
| Frontend Vitest suite | 16 tests passed |
| Frontend TypeScript validation | Passed |
| Next.js production build | Passed |
| Hosted initial load | Local fallback rendered instead of a blank field while Google tiles initialized |
| Hosted completed load | Google road map, hazard polygons, evacuation centers, SOS, response markers, facilities control, and responder radar rendered |

## Safety Boundary

> The restoration improves **visual availability only**. It does not alter the decision-support limits for hazards, weather, routes, facilities, deployments, warnings, or field safety.
