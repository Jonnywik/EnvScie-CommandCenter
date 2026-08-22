# Command Center Interface-Overhaul Preparation

**System:** Code for Resilience — Balangiga LGU DRRM Command Center  
**Status:** Ready for visual redesign after the baseline tag is created  
**Prepared:** 22 August 2026

## Purpose

This preparation record separates the **visual interface** from the Command Center’s established operational behavior. The next redesign may substantially change hierarchy, navigation, styling, layout, and component composition, but it must preserve the verified emergency workflows, safety boundaries, and data contracts listed below.

> The Command Center is decision support for LGU operations. A redesigned interface must not imply automatic dispatch, route clearance, public-alert authorization, confirmed inundation, road safety, or responder safety where the supporting workflow still requires human review.

## Protected operational baseline

| Area | Current behavior that must remain available after redesign | Primary source boundary |
|---|---|---|
| Application shell | Branded loading state, top status bar, workspace navigation, live/cached status, refresh, bulletin entry, and manual emergency entry remain reachable. | `frontend/components/Dashboard.tsx`, `frontend/components/DashboardClient.tsx` |
| Overview | Rapid scan of high-level metrics, operational GIS context, readiness checks, SOS, alerts, evacuation capacity, and direct operational navigation. | `frontend/components/Dashboard.tsx` |
| Live SOS | Searchable triage queue, status and channel filters, coordinator-recorded emergencies, acknowledgement, dispatch, verification, resolution, and auditable status actions. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts` |
| Verified alerts | Alert review state, evidence visibility, approval workflow, source freshness, and communication controls. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts` |
| Provincial weather | PAGASA conditions and warning context alongside clearly bounded Project NOAH static reference material. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts` |
| Risk map | Hazard, SOS, resource, center, route, radar, and typhoon layers; contained wheel/touch map interaction; manual route optimization and active-hazard review. | `frontend/components/Dashboard.tsx`, `frontend/lib/mapContext.ts` |
| Evacuation and resources | Center capacity review, resource status, location, and audited availability controls. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts` |
| Response groups | Group availability, specialty, readiness, check-in freshness, assignment workflow, and responder-safety assessment. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts` |
| Communications | Communication log, audio-dispatch simulation, assignment delivery status, acknowledgement, retry, and handover information. | `frontend/components/Dashboard.tsx`, `frontend/lib/api.ts`, `frontend/lib/operatorAssist.ts` |

## Interface ownership map

The overhaul should treat the following files as distinct responsibilities rather than changing them indiscriminately.

| Layer | Primary file(s) | Redesign guidance |
|---|---|---|
| Visual tokens and responsive layout | `frontend/app/globals.css` | Primary target for a new design language, layout grid, density, spacing, interaction states, and responsive behavior. Preserve visible focus states, readable hazard colors, and map containment rules. |
| Application composition | `frontend/components/Dashboard.tsx` | Main target for component extraction and structural redesign. Preserve existing state, action callbacks, role checks, data refreshes, keyboard-safety guards, and API calls when moving UI. |
| Loading boundary | `frontend/components/DashboardClient.tsx` | May be visually refreshed, but must keep the safe client-only dashboard boundary and accessible loading state. |
| API contracts | `frontend/lib/api.ts` | Preserve request and response contracts unless the redesign requires a separately planned product feature. UI-only work should not change these contracts. |
| Map calculations | `frontend/lib/mapContext.ts` | Preserve geographic extents, tile calculations, viewport clamping, and map gesture behavior. |
| Operator behavior | `frontend/lib/operatorAssist.ts` | Preserve manual-intake eligibility, handover content, and keyboard shortcut safety rules. |
| Regression coverage | `frontend/lib/*.test.ts` | Update tests only when a deliberate UI behavior changes; retain tests for safety boundaries, overview content, and contained map gestures. |

## Non-negotiable safety and usability constraints

The redesign must continue to distinguish source freshness, cached data, advisory decision support, and verified operational facts. It must retain explicit human approval before public communication, evacuation direction, dispatch, or route clearance. The risk map may be redesigned, but its imagery, radar, and static-hazard layers cannot be presented as live damage, flood, road-status, or safety confirmation.

The application must remain usable with keyboard navigation, retain visible focus treatment, offer usable touch targets, and preserve the map’s contained wheel, drag, and pinch interaction. On narrow screens, operational information must reflow without clipping or horizontal page overflow.

## Recommended redesign sequence

| Sequence | Work package | Acceptance condition |
|---|---|---|
| 1 | Visual direction | Approve a style reference, density target, color direction, typography, navigation model, and information hierarchy before changing functional code. |
| 2 | Shared shell | Redesign loading, top bar, navigation, page headers, panels, buttons, feedback, and responsive grid rules. |
| 3 | Overview | Recompose the rapid-information dashboard around the approved hierarchy while retaining quick entry to SOS, alerts, resources, centers, groups, and communications. |
| 4 | Operational workspaces | Redesign the eight specialist workspaces one at a time, preserving their actions and state transitions. |
| 5 | Interaction polish | Refine drawers, filters, map controls, empty states, keyboard focus, mobile layout, and reduced-motion behavior. |
| 6 | Release validation | Run automated tests, type checking, production build, desktop and mobile visual review, map gesture containment checks, and critical SOS/alert workflow smoke tests. |

## Baseline validation gates

Before a redesigned version is accepted, it must satisfy the following checks.

| Gate | Required result |
|---|---|
| Functional regression | Frontend tests, TypeScript validation, and production build pass. |
| Operational workflow | SOS triage, alert review, manual intake, map controls, route preview, response-group status, notification acknowledgement, and communication review remain available. |
| Safety review | Cached and advisory data remain clearly bounded; consequential actions remain human-controlled and audited. |
| Responsive review | Desktop and narrow-screen layouts remain readable, keyboard reachable, and free of horizontal page overflow. |
| Map interaction | Wheel, drag, and touch gestures inside the map do not scroll the surrounding page; page scrolling works normally outside it. |
| Release control | The redesign has a separate commit trail from the `pre-interface-overhaul` baseline tag and is pushed only after validation. |

## Next design input needed

The system is ready for the overhaul. Before implementation begins, provide a preferred visual direction or reference material, including any desired colors, logo treatment, dashboard density, navigation style, mobile priority, and examples of interfaces to emulate or avoid.
