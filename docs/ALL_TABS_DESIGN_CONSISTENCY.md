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

Verification only used navigation and inspection controls. It did not invoke SOS, dispatch, notification, communications, route, resource, field-safety, or public-warning actions.
