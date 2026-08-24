# Unified Command Center Header

## Shared contract

Every operational workspace now presents the same **EnvScie CommandCenter** identity, contextual workspace label, operational-state indication, appearance control, operator identity marker, and Command Map return path. The map’s dedicated header retains its search and map-tool functions while using the same shared brand identity component.

| Header element | Purpose | Operational boundary |
|---|---|---|
| Brand and context | Identifies the Command Center and the active workspace without repeating local navigation labels. | Identity and workspace context do not establish an operational status. |
| Status and sync label | Shows live/cached/review-required presentation state and the current workspace snapshot label. | A displayed state is not a source-health certification or field verification. |
| Appearance and operator controls | Keeps the theme switch and operator marker in the same predictable location. | Theme selection and identity display do not grant authority. |
| Return action | Gives specialized workspaces a consistent route back to Command Map. | Returning to the map does not resolve, dispatch, or modify any incident. |

## Validation

The specialized **Triage & Dispatch**, **Fleet Safety**, and **DRRMO Intelligence** workspaces were inspected in the hosted interface. Each rendered the shared identity, workspace title, status, return action, appearance toggle, and operator marker without overlap. The Command Map retained its existing operational search and tool controls while reusing the same brand identity component.

At the reported narrow viewport of `495 × 825`, the Triage header reflowed to a two-row layout with a `471px` contained width, `127px` rendered height, and no horizontal overflow. Dark and light appearance checks confirmed readable header text, controls, and operator marker. No operational workflow, dispatch proposal, notification, SOS state, or audit record was changed during header validation.
