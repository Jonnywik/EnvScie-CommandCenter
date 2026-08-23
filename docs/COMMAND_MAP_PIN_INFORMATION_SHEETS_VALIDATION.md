# Command Map Pin Information Sheets Validation

**Date:** 23 August 2026 (PHT)  
**Scope:** Click-to-inspect information sheets for Command Map resource, evacuation-center, and SOS pins.

## Delivered interaction

The native Google Maps pins for tracked response resources, evacuation centers, and SOS alerts now open one consistent information sheet when selected. The sheet replaces the previous selection rather than stacking multiple panels, and its close control returns the operator to an unobstructed map view.

| Selected pin | Information shown | Deliberate operational boundary |
| --- | --- | --- |
| Response resource | Owner, current assignment, state, position age, reported accuracy, battery, reported coordinates, and a position-check action. | The position-check action records a coordinator check only; it does not dispatch, reroute, or establish crew safety. |
| Evacuation center | Reported status, occupancy versus capacity, reported spaces, snapshot source, and coordinates. | Capacity data is reported operating-snapshot context and does not establish suitability, access, or safety. |
| SOS alert | Summary, severity, status, reported accuracy, snapshot source, and coordinates. | The information is not a verification result and does not change SOS status or create a response assignment. |

Every sheet retains the reminder to verify with the reporting party, center coordinator, and field teams before changing operations, routing, or safety status.

## Accessibility and resilience behavior

Native Google Maps markers receive click handlers for all three pin categories. The legacy SVG fallback mirrors this behavior with keyboard-operable resource, evacuation-center, and SOS markers. The sheet is an accessible `role="region"` with a specific information-sheet label and an explicitly labeled close control. Selected fallback markers receive a visible highlight without hiding hazards, routing, resource, or SOS layers.

On narrow displays, the information sheet uses a bounded width and scrollable height above the responder rail. It does not alter the map’s zoom/reset rail, navigation, layer drawer, or broadcast control placement.

## Validation evidence

| Check | Result |
| --- | --- |
| Frontend Vitest suite | **16 passed**; regression coverage includes the unified selected-pin model, native center/SOS handlers, sheet markup, safeguard text, and styling hooks. |
| TypeScript validation | Passed with no errors. |
| Next.js 15.5.23 production build | Passed. |
| Hosted Google Map | Loaded with the native map canvas and no legacy SVG fallback during normal operation. |
| Resource pin | A tracked response-resource pin opened a resource sheet with state, position-age, accuracy, battery, coordinates, close control, and position-check action. |
| Evacuation-center pin | The Balangiga Central School marker opened a center sheet showing **182/500** occupancy and **318** reported spaces. |
| SOS pin | A rising-water SOS marker opened an alert sheet with critical severity, received status, ±42 m reported accuracy, and safety reminder. |
| Close behavior | Closing the SOS sheet removed it and returned the full map surface without changing the native marker set. |

The live map remains decision support. The information sheets do not prove field conditions, route clearance, evacuation readiness, signal availability, delivery completion, or responder safety.
