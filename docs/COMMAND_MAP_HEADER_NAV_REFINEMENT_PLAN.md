# Command Map Header and Navigation-Rail Refinement Plan

## Goal

Refine the visual relationship between the fixed Command Map header, logo lockup, collapsed navigation rail, and expand/collapse control so the interface reads as one intentional command-center shell instead of several panels touching or appearing to cut through one another. The work will preserve the current no-overlap geometry, five functional workstreams, map controls, responsive behavior, dark/light modes, and accessibility semantics.

## Diagnosis

The current containment fix correctly moves the navigation rail below the header. However, the screenshot shows two remaining aesthetic problems. First, the top bar begins behind the reserved left navigation area, which makes the logo/header card appear visually interrupted by the rail. Second, the navigation inherits a light workspace-sidebar surface while the Command Map uses a dark glass header, so the two elements look like unrelated UI systems even when they no longer physically overlap.

> The target is a deliberate **L-shaped command shell**: a header that begins to the right of the collapsed rail, and a matching dark/translucent rail that begins below the header. The expanded rail remains below the header and becomes a contextual drawer, not a panel covering the logo.

## Design decisions

| Area | Proposed decision | Rationale |
| --- | --- | --- |
| Header start edge | On desktop, reserve the collapsed navigation-dock width plus a consistent gutter before the Command Map top bar begins. | Prevents the header card from sitting behind the left rail and creates a clean visual seam. |
| Navigation geometry | Keep the rail and its expand/collapse control below the measured header clearance. Retain the existing bounded/scrollable rail behavior. | Preserves the already verified no-overlap condition. |
| Visual language | Give the Command Map sidebar a dark glass surface, compatible border, subtle shadow, and matching blur treatment. | Unifies the sidebar with the map top bar without reducing contrast or control visibility. |
| Collapsed rail | Use a compact dock with consistent icon hit targets, controlled vertical rhythm, and a restrained active state. | Avoids a floating white strip and makes the collapsed rail look designed for map-first work. |
| Expanded rail | Expand only beneath the header; use the same surface and transition as the collapsed dock. The header does not move or resize during expansion. | Avoids reflow of the map header and retains a stable search/session layout. |
| Brand lockup | Retain the logo and product name in the top header only; do not duplicate branding in the rail. | Maintains a clear hierarchy: identity in the header, navigation in the dock. |
| Responsive mode | Preserve the existing ≤980 px horizontal navigation rail beneath the header. At ≤760 px, keep the compact header and horizontal strip without introducing a desktop dock. | Prevents a narrow screen from receiving a cramped vertical sidebar. |

## Implementation steps

### 1. Establish explicit Command Map layout tokens

Add scoped CSS custom properties to the Command Map shell for header inset, header height/clearance, collapsed dock width, dock gutter, and shared glass-surface colors. The desktop header will use the collapsed dock width plus gutter as its left inset, while the sidebar will use the same clearance token for its top position. This avoids independent magic numbers drifting apart.

The values will be calibrated from the existing verified geometry: the header remains clear of the viewport edge, the navigation begins below the header, and the header begins immediately to the right of the collapsed navigation dock with a small visual gutter.

### 2. Refine desktop header and rail composition

Update the desktop Command Map top bar to begin after the collapsed navigation dock rather than at the viewport edge. Keep its existing logo, search, health/session, and profile controls. Retain the fixed, below-header rail, but apply a matching dark glass treatment, restrained border, and a low-contrast divider rather than the inherited white sidebar surface.

The expand/collapse control will remain the first rail control beneath the header and keep its accessible label. In collapsed state it will use the same material and corner language as the dock; in expanded state it will remain within the same visual frame above the five workstream controls.

### 3. Preserve functional and responsive behavior

Keep the five workstream buttons, current-route state, navigation keyboard reachability, and persisted collapse state unchanged. Ensure the Command Map quick links, layer rail, responder drawer, and broadcast control maintain their current z-index ordering relative to the redesigned navigation shell.

At the existing responsive breakpoint, retain the bounded horizontal navigation rail below the header. Override only desktop-specific dock/header values, so mobile does not inherit a left inset intended for a vertical dock. Validate both dark and light appearance tokens for contrast and visual continuity.

### 4. Add regression coverage

Extend the compact UI regression test to assert the scoped Command Map layout tokens, the desktop header offset, the below-header sidebar placement, the dark/glass navigation treatment, and the existing responsive override. Retain the current tests for five workstream controls, collapse labels, and functional navigation compatibility.

### 5. Validate and document

Run frontend tests, TypeScript validation, and the production build. Restart the hosted Command Center and validate the following states: desktop collapsed rail, desktop expanded rail, Command Map header/search visibility, map control reachability, and the responsive horizontal navigation rule. Measure header, rail, and toggle rectangles in the hosted browser to prove that the visual refinement does not reintroduce overlap.

Record the final desktop and responsive behavior, test results, and any remaining visual constraints in a validation note. Commit locally and synchronize only after the hosted validation passes.

## Acceptance criteria

| Requirement | Acceptance check |
| --- | --- |
| No physical overlap | In collapsed and expanded desktop states, the rail and expand/collapse control begin below the header; the header begins to the right of the collapsed rail. |
| Natural visual hierarchy | Header and rail share a coherent dark-glass material system, while the logo appears only once in the header. |
| Navigation retained | All five workstream controls remain visible, named, keyboard reachable, and compatible with existing contextual views. |
| Responsive containment | The ≤980 px horizontal navigation behavior remains below the header, with no clipped labels or overlap with map controls. |
| Map safety preserved | Google Maps, live operational overlays, pin sheets, layer drawer, zoom/reset, weather status, and all decision-support caveats remain unchanged. |
| Quality gates passed | Frontend tests, TypeScript, production build, and hosted interaction checks pass. |

## Assumptions and risks

This plan assumes the user wants the current map-first information architecture retained and requests a visual refinement rather than a navigation-model change. The desktop header will reserve the **collapsed** dock width even when the navigation expands; this keeps the header stable and avoids compressing the search field at mid-sized widths. The expanded rail is intentionally a below-header drawer, not a second top-level header.

The main implementation risk is crowded space around the header at intermediate desktop widths. The existing responsive rules will be reviewed and, if necessary, tightened so the search/health/session layout degrades before the dock/header relationship becomes crowded. No map data provider, dispatch logic, or external integration is in scope.
