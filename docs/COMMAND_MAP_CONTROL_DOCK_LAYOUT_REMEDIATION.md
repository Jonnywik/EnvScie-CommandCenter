# Command Map Control Dock Layout Remediation

**Status:** Completed and validated on the hosted Command Center.  
**Scope:** Command Map zoom/reset, Map view, Triage, and official Facilities controls.  

## Objective

The Command Map previously used separate right-edge positions for the zoom controls, Map view, Triage, and official-facility controls. This created a risk that expanding a utility panel could visually compete with another control or a fixed operational surface. The remediation establishes one **control dock** and one shared panel-safe region.

## Implementation

| Area | Delivered behavior |
| --- | --- |
| Unified dock | Zoom, zoom-out, reset, Map view, Triage, and Facilities are rendered in one consistent right-edge dock. |
| Exclusive panels | A discriminated `activeUtilityPanel` state allows only one of `view`, `triage`, or `facilities` to be expanded at a time. Opening another control replaces the current panel instead of stacking drawers. |
| Collision-safe placement | All expanded panels use the same fixed desktop rectangle, positioned to the left of the dock and capped above the responder-radar reserve. The panel body scrolls internally. |
| Responsive containment | Shared CSS variables define the dock edge, panel width, vertical clearance, and mobile radar reserve. On narrow screens, the panel moves to a bounded sheet below the dock. |
| Visual consistency | Dock actions share sizing, typography, focus treatment, translucent surfaces, active-state treatment, and light-mode overrides. |
| Keyboard dismissal | Pressing `Escape` closes the active utility panel while retaining the selected map context and the dock controls. |

## Safety and Data Boundaries

The layout work does not alter map data, layer persistence, official facility records, dispatch behavior, or external integrations. Project NOAH layers continue to be modeled reference context only; they do not confirm a current hazard, route clearance, or field safety. Official facility records remain reference-only until directly validated with the Balangiga LGU/DRRMO and the facility contact. No automatic dispatch, warning, message delivery, or readiness assertion was added.

## Validation Record

| Check | Result |
| --- | --- |
| Map view expansion | Verified open with zoom/reset, Triage, Facilities, top bar, responder radar, and broadcast action all remaining clear and reachable. |
| Triage expansion | Verified it replaced Map view in the same reserved panel region; Map view and Facilities controls remained exposed. |
| Facilities expansion | Verified it replaced Triage in the same region; registry source-record controls and category filters remained usable. |
| Geometry inspection | Browser rectangle checks for the open Facilities panel found no intersections with zoom, Map view, Triage, Facilities trigger, responder radar, top bar, or broadcast action. |
| Theme behavior | Verified dark and light presentations retain the dock geometry and panel hierarchy. |
| Keyboard behavior | Verified `Escape` closes an open utility panel after the final production restart. |
| Automated checks | `pnpm test` passed with 16 tests; TypeScript validation and the Next.js production build completed successfully. |

## Maintainer Notes

Future Command Map utility controls should join the shared `map-control-dock` and use `activeUtilityPanel` rather than introducing independent absolute-positioned drawers. Any new expanded surface must use the existing panel-safe CSS variables and must be visually checked against the dock, top bar, responder radar, broadcast action, map attribution, and selected-record sheets at desktop and narrow breakpoints.
