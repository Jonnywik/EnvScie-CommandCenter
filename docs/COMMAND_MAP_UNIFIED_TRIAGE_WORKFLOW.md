# Command Map Unified Triage Workflow

## Purpose

The Command Map now provides a single, persistent triage workspace for narrowing visible operational context while preserving the underlying operational snapshot. It supports **review and navigation only**: no filter, selection, or handoff resolves an alert, changes a unit status, authorizes a route, dispatches a team, or sends a public warning.

## Operator Workflow

| Step | Operator action | System behavior | Operational boundary |
|---|---|---|---|
| 1 | Select **Filter** in the map-control rail. | Opens the Operational Triage drawer and closes the facilities or layer drawer if either is open. | The map retains the full snapshot in memory; filtering only changes the visible context. |
| 2 | Apply one or more SOS, unit posture, center, hazard, or position-age criteria. | Recalculates the visible map snapshot, updates the total/visible summary, and highlights matching markers. | No record is removed, changed, acknowledged, or resolved. |
| 3 | Select a map marker. | Opens its evidence sheet with provenance and a clear verification boundary. | A pin is informational; it is not a live safety, access, or readiness guarantee. |
| 4 | Select a contextual handoff such as **Open Incident triage**. | Navigates to the relevant existing workspace with the selected incident retained. | The operator must still complete verification and choose any subsequent action. |
| 5 | Select **Clear triage filters** before a broad review or handover. | Restores the all-record view and leaves the source records untouched. | Wider review remains an explicit operator decision. |

## Persisted Map State

The filter set is persisted in browser storage under `cfr_command_map_triage_filters`. It is deliberately limited to view preferences, not operational facts. The current filters include SOS severity/status, field-unit posture, evacuation-center condition, hazard state, and position freshness.

> **Handover rule:** At shift change, clear active filters and review the full map summary before relying on a filtered view. The count label always presents visible records alongside the total available context.

## Selected-Record Handoffs

| Map record | Explicit action | Destination | Guardrail retained |
|---|---|---|---|
| SOS alert | Open Incident triage | Incidents / Triage & Dispatch | Shows the selected SOS but does not mark it verified or deploy a unit. |
| Field resource | Open Field response | Fleet & Responder Safety | Opens the roster/safety workspace without assuming location freshness or responder safety. |
| Evacuation center | Open Community safety | Evacuation Centers | Opens center information without confirming capacity, access, or suitability. |

## Drawer Containment and Accessibility

The layer, triage, and official-facility inspectors are mutually exclusive. Opening one closes the others, preventing overlap on the right-hand map control rail. The triage drawer uses native labeled select controls, a keyboard-reachable trigger, visible focus treatment, and a clear reset action. On narrow screens, its height is bounded above the responder radar and it scrolls internally.

## Validation Record

| Check | Result |
|---|---|
| Frontend regression suite | 16 tests passed. |
| TypeScript | `tsc --noEmit` passed. |
| Production build | Next.js production build passed. |
| Hosted map filter | Active unit posture reduced the visible resource context from five records to two without changing source records. |
| Inspector containment | Opening the triage drawer closed the official facility inspector; only one auxiliary drawer remained active. |
| Evidence handoff | A selected SOS opened the matching Incident Triage record through an explicit **Open Incident triage** control. |
| Safety boundary | The triage workspace retained its verification checklist and advisory dispatch language; no automated action was triggered. |

## Implementation Touchpoints

The workflow is implemented in `frontend/components/dashboard-tabs/CommandMap.tsx`, with selected-marker emphasis in `GoogleOperationalMap.tsx`, incident handoff support in `Dashboard.tsx` and `IncidentTriage.tsx`, styles in `frontend/app/globals.css`, and regression assertions in `frontend/lib/compactUi.test.ts`.
