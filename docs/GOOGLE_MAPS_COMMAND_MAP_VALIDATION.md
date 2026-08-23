# Google Maps Command Map Validation

## Delivered implementation

The Command Map now uses the **Google Maps JavaScript API** as its live geographic canvas. The map loads through the managed Maps proxy using a same-origin FastAPI relay, so no user-provided API key is required and the browser does not carry the proxy credential directly.

The Google Maps canvas retains the Command Center’s existing operational overlays and controls.

| Capability | Implementation |
| --- | --- |
| Map interaction | Native Google Maps drag-to-pan, scroll/pinch zoom, keyboard support, and a bounded operational zoom range from 7 to 14. The initial data extent is fitted once; subsequent layer, weather, and basemap updates preserve the operator's manually chosen view. |
| Hazard layer | Live Command Center hazard polygons render as severity-colored Google Maps polygons. |
| Response resources | Resource markers show state, type, and selection behavior; selecting a marker opens the existing resource inspector. |
| SOS and centers | SOS reports and evacuation centers render as distinct map markers with operational labels. |
| Routing and weather | Existing safe-route and typhoon-track data render as native Google Maps overlays. RainViewer radar is displayed at its supported regional scale through zoom 10 and becomes transparent at closer zoom levels rather than displaying unsupported-tile error panels. |
| Basemap and layers | The existing layer drawer provides accessible **Road**, **Satellite**, and **Terrain** Google Maps basemap controls, as well as independent radar and flood-risk switches. Buttons expose `aria-pressed`; switches retain their existing `role="switch"` state. |
| Fallback and attribution | The former SVG/Esri canvas is now an error-only fallback. When Google Maps is ready, only the native canvas is rendered and the Command Map identifies its Google Maps basemap rather than presenting stale Esri attribution. |
| Safety boundaries | Map imagery and overlays remain context only; field confirmation, route clearance, approval, and delivery controls are unchanged. |

## Validation record

The same-origin loader endpoint returned the managed Google Maps script with HTTP 200, and the hosted Command Map initialized the Google Maps runtime, native base-map tiles, operational markers, keyboard shortcuts, and provider attribution. The hosted verification at `https://3100-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer` confirmed that the Satellite control selected Google imagery (`aria-pressed="true"` and native imagery tiles), while hazard, evacuation-center, SOS, and resource markers remained visible. Switching back to Road restored the operational road presentation without losing these overlays.

The hosted DOM check confirmed `window.google.maps` was available, the native map rendered 15 canvas elements, four inspected operational markers remained present, and the legacy SVG fallback count was **zero** during a successful Google Maps load. The layer drawer remained available alongside zoom, reset, navigation, responder-radar, and broadcast-draft controls. The native satellite imagery is not an assertion of current flood extent, damage, route clearance, signal availability, or responder safety; those decisions still require authoritative updates and field confirmation.

## Satellite and usability remediation summary

| Confirmed gap | Resolution | Operational effect |
| --- | --- | --- |
| Existing satellite UI only drove the legacy SVG canvas. | Introduced a typed Google Maps basemap state and passes `roadmap`, `satellite`, or `terrain` directly to native `mapTypeId`. | Satellite imagery is a real Google Maps presentation, not a simulated backdrop. |
| The legacy SVG remained rendered under/over the live map, duplicating visual layers and Esri attribution. | Render the SVG only after a Google Maps loading error; use Google Maps basemap text when the native canvas is active. | Removes competing map visuals and incorrect active-provider labeling. |
| Overlay refreshes refit the bounds and could undo operator pan/zoom. | Guard `fitBounds` so it runs only for the initial operational extent. Reset remains an intentional, visible operator control. | Weather/layer changes do not silently recenter the map. |
| RainViewer returned unsupported tiles at close operational zoom. | Restrict radar tiles to regional scale through zoom 10, return transparent tiles above that scale, and label the limit in the status line. | Avoids misleading provider error tiles while retaining verified regional radar context. |

## Automated checks

The completed change passed the frontend Vitest suite (**16 tests**), TypeScript validation, and the Next.js **15.5.23** production build. Regression coverage now checks for the satellite selector, accessible basemap control group, radar-scale label, and error-only SVG fallback condition.

The update passed the frontend Vitest suite (**16 tests**), TypeScript validation, and the Next.js **15.5.23** production build. The FastAPI relay and hosted Command Center both returned HTTP 200 during final validation.
