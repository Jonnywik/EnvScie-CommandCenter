# Command Map Visibility and Tactical Controls

**Status:** Completed and live-validated  
**Scope:** Command Map (Live Operations) interface refinement  
**Audience:** Balangiga LGU/DRRMO Command Center maintainers and operators

## Purpose

This refinement prioritizes geographic visibility and control separation in the Command Map. It replaces broad, competing edge controls with a compact navigation rail, a top-bar utility selector, a zoom-only map control pill, a minimizable responder radar, and a protected legend region.

| Area | Delivered behavior | Operational benefit |
|---|---|---|
| Navigation | A persistent icon-only rail expands into a temporary full-navigation overlay. | The map remains visible at rest while every workspace stays reachable. |
| Map utilities | Map view, Triage, and Facilities are available through one top-bar **Map tools** selector. | Only one operational utility panel can be active at a time. |
| Zoom controls | Zoom in, zoom out, and reset are grouped in a compact vertical pill. | The right-side map edge is reserved for map movement rather than stacked actions. |
| Responder radar | The expanded field-unit roster can collapse to an active-unit status bar. | Operators can recover map area without losing responder-status awareness. |
| Legend | The legend’s bottom offset follows the radar’s expanded or minimized reserve. | The legend remains visible above the responder radar. |
| Critical SOS | Critical SOS events carry persistent, non-interactive red reported-event labels. | High-priority event context is visible without opening a marker inspector. |

## Control and Overlap Safeguards

The Command Map uses a shared utility-panel state. Selecting **Map view**, **Triage**, or **Facilities** replaces the current panel rather than adding another drawer. The panel area is bounded above the responder radar and separated from the compact zoom pill. On narrow screens, the same panels become bounded sheets with an explicit lower reserve.

The full navigation view is an overlay and does not resize the map canvas. It can be dismissed by the dedicated control or its backdrop. The top-bar Map tools menu closes after a selection, and `Escape` dismisses an active map utility panel.

Critical SOS labels use a bounded red treatment and ignore pointer input so the underlying marker retains its click target. Live Google Maps labels test a set of vertical offsets when nearby critical labels would intersect, reducing label-on-label obstruction in clustered events. The fallback map renderer uses the same reported-event wording.

> **Decision-support boundary:** Persistent critical labels surface reported event text only. They do not verify a hazard, declare an active warning, confirm route safety, assign responders, or issue public notices.

## Live Validation Record

| Check | Result |
|---|---|
| Icon-only rail at rest | Passed. Workspace icons remain available while the map retains its full working canvas. |
| Full navigation overlay | Passed. The expanded navigation rendered above the map and dismissed cleanly without moving the map canvas. |
| Consolidated Map tools menu | Passed. Map view, Triage, and Facilities were exposed only through the top-bar selector; the large right-edge utility buttons were absent. |
| Map view panel | Passed. The reference-layer drawer occupied the reserved region and remained clear of the zoom pill and responder radar. |
| Facilities panel | Passed. Registry controls and category filters rendered in the reserved region with their reference-only safeguards intact. |
| Compact zoom/reset controls | Passed. The right edge displayed only a stacked zoom-in, zoom-out, and reset pill. |
| Responder radar minimization | Passed. The expanded roster collapsed to an active-field-units summary bar and restored the lower map area. |
| Legend protection | Passed. The legend remained above the expanded radar and shifted downward into reclaimed space when the radar was minimized. |
| Critical marker labels | Passed. Live Google Maps displayed persistent red reported-event labels for critical SOS records while marker inspection remained available. |
| Light-theme treatment | Passed. The top-bar utility menu, utility panels, rail, and compact controls retained readable contrast in the light appearance. |

## Automated Validation

The frontend regression suite completed with **17 passing tests**. TypeScript validation and the Next.js production build also completed successfully after the refinement.

## Maintenance Notes

Maintain the shared `--responder-radar-reserve` variable whenever the radar layout changes. New utility panels must use the existing single active-panel contract and the reserved panel region; they must not be independently fixed to the map edge. New persistent marker labels should be limited to critical, reported context and should not encode unverified operational status as fact.
