# Command Center All-Tabs Design Consistency

## Scope

This refinement standardizes the visible Command Center shell across Command Map, Incidents, Field Response, Community Safety, and Intelligence. It preserves each workspace’s existing content, controls, decision-support labels, and human-authorized operational workflows.

## Shared visual contract

| Surface | Standardized treatment |
| --- | --- |
| Header | Continuous deep-navy and teal operational bar, emblem identity, status/session context, appearance control, and operator avatar. |
| Navigation | One persistent Command Center workspace rail with matching active state, collapse control, focus treatment, and responsive horizontal presentation. |
| Context navigation | Shared rounded contextual selector with consistent active, hover, focus, dark, and light appearance states. |
| Responsive behavior | Desktop uses a collapsible side rail. Narrow layouts reflow the rail into an overflow-safe horizontal navigation strip and keep headers and selectors within the viewport. |
| Theme behavior | Navy, teal, and coastal-mint surfaces remain the neutral visual language. Coral, amber, green, and blue retain semantic status meaning. |

## Implementation record

The Command Map now uses the reusable `CommandCenterHeader` and the same persistent `CommandCenterNavigation` behavior as the other workspaces. Its coordinate/LGU/unit search and Map Tools remain in the shared header’s center and action regions, respectively. The map’s operational controls, layers, source-review panel, map pin sheets, and broadcast draft workflow are unchanged.

The legacy Community Safety contextual views retain their content components, but their header dimensions, emblem scale, borders, shadow, session controls, and desktop relationship to the navigation rail now align with the shared shell. Field Response, Incident Triage, and Intelligence continue using the reusable header and common navigation component.

## Validation record

Desktop visual checks covered Command Map, Incidents, Field Response, Community Safety, and Intelligence. A narrow-screen check recorded a `495 px` common header, a `467 px` contextual selector and panel, and no horizontal overflow. The frontend test suite passed 19 tests, TypeScript validation completed successfully, and the optimized Next.js production build completed successfully. No browser console error was reported during the checks.

## Responsive and accessibility follow-up

The shared shell was rechecked at `320 px`, `375 px`, and `430 px` CSS widths. In each case, the document had no horizontal overflow; the standardized sidebar remained a horizontally scrollable rail; and the header controls stayed within the visible shell. A specific `320 px` legacy-header adjustment now compacts the identity treatment and retains both the appearance and profile controls inside the viewport.

Automated regression coverage now verifies the common navigation/header contract, compact `320 px` behavior, overflow-safe contextual selectors, and six shared header/sidebar color pairs. The complete frontend suite now contains 27 passing tests.

| Shared surface | Appearance | Foreground / background | Reviewed contrast ratio |
| --- | --- | --- | --- |
| Header title | Dark | `#efffff` / `#071923` | `17.42:1` |
| Sidebar label | Dark | `#c3dadd` / `#071923` | `12.28:1` |
| Header utility | Dark | `#d9ffff` / `#0a3942` | `11.75:1` |
| Header title | Light | `#0b2535` / `#f7fcfa` | `15.23:1` |
| Sidebar label | Light | `#486874` / `#ffffff` | `5.99:1` |
| Utility control | Light | `#0b6570` / `#ffffff` | `6.75:1` |

All reviewed normal-text pairs meet or exceed the `4.5:1` WCAG AA contrast threshold used by the regression suite. The review covers shared shell elements; status and semantic alert colors retain their operational meanings and are not repurposed as neutral interface text.

## Full-width Command Map header correction

The Command Map header now occupies the entire top edge of the workspace rather than beginning after the navigation rail. The standardized sidebar begins below the fixed header, preserving the same map controls and workspace navigation without consuming header width.

The corrected layout was compared with the supplied wide reference and checked in the hosted workspace. At `320 px`, `375 px`, and `430 px`, the header spans the viewport from left to right, the sidebar begins directly below it, header controls remain within bounds, and the document reports no horizontal overflow. The compact navigation rail remains horizontally scrollable when its workspace items exceed the available width.

## All-tabs layout standardization

The same full-width fixed-header and below-header sidebar contract now applies to Command Map, Incidents, Field Response, Community Safety, and Intelligence. This removes the prior distinction in which some contextual workspaces began their headers beside the navigation rail.

On desktop, each workspace keeps a full-width operational header across the top and begins its vertical rail directly below. On compact screens, each workspace keeps the header at the top and reflows the same navigation into an overflow-safe horizontal rail beneath it. Hosted visual checks confirmed the shared arrangement on Command Map, Live SOS, Field Response Fleet Safety, Provincial Weather, and DRRMO Intelligence; the compact Intelligence check confirmed a `64 px` header directly above a `59 px` sidebar rail with no horizontal document overflow at `320 px`, `375 px`, or `430 px`.

Verification only used navigation and inspection controls. It did not invoke SOS, dispatch, notification, communications, route, resource, field-safety, or public-warning actions.
