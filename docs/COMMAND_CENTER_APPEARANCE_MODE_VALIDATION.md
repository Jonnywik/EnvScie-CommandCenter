# Command Center Appearance Mode Validation

## Delivered behavior

The Command Map header now places an accessible appearance toggle immediately to the right of the operator profile placeholder. The **current Command Map palette is the default dark mode**. Activating the control restores the earlier coastal light palette, while retaining the full-screen map, navigation, map-layer rail, responder radar, and mass-notification controls.

| Area | Verification outcome |
| --- | --- |
| Accessibility | The toggle exposes a target-specific accessible name: “Switch to light mode” or “Switch to dark mode.” Its pressed state describes whether dark mode is active. |
| Persistence | The selection is stored under `cfr_appearance` and applied to the document root, so it survives workspace navigation and page reloads. |
| Dark mode | The updated navy, teal, and high-contrast Command Map treatment remains the default view. |
| Light mode | The previous light coastal palette restores pale map surfaces, white panels, dark readable text, and the established mint/teal action accents. |
| Operational behavior | The map continues to use the same pan, zoom, layer, search, navigation, responder-radar, and deliberate notification pathways in either appearance. No automated dispatch or message delivery behavior was added. |

## Validation record

The completed update passed the frontend Vitest suite (**16 tests**), TypeScript validation via `tsc --noEmit`, and the Next.js **15.5.23** production build. The hosted Command Center was then checked at the Manus production URL: the light appearance switched successfully, remained selected after reload, retained the map-first shell, and switched back to the default dark appearance through the same profile-adjacent control.

## All-tabs extension

The same persistent control is now exposed in every workspace. Command Map retains its button beside the profile placeholder. Incident Triage, Fleet & Responder Safety, and DRRMO Intelligence place it beside their Command Map return control. The remaining legacy workspaces expose it beside the shared profile placeholder in the retained Command Center topbar: **Live SOS, Verified Alerts, Provincial Weather, Risk Map, Evacuation Centers, Resources, Response Groups, and Communications**.

The hosted verification confirmed the control in Command Map, Incident Triage, Fleet & Responder Safety, and Live SOS. Toggling inside Incident Triage persisted into Live SOS, and the Live SOS control returned the interface to the default dark appearance. The shared state and one reusable control component cover all twelve Command Center tabs.

## Color-scheme compliance review

The shared legacy workspace styles were audited alongside the map-first screens. In **dark mode**, the legacy sidebar, cards, tables, inputs, drawers, status strips, and low-emphasis text now use the Command Map’s navy, teal, and muted-cyan palette instead of retaining light surfaces. In **light mode**, those same surfaces resolve to white or pale-coastal containers with dark navy text, restrained teal accents, and visible borders.

Special treatment remains intentional for operational warning, hazard, and map content. Light-mode safety, warning, and status text now uses darker red, amber, teal, and sky values where a pale label would otherwise lose contrast on its colored container. Hosted checks covered Command Map, Live SOS, and Fleet & Responder Safety in both modes, with readable containers, inputs, table rows, safety panels, controls, and typography observed in each scheme.

## Unified workspace navigation

The former Command Map three-line collapsible menu has been replaced by the same persistent left-side **Command Center** tab container used throughout the system. The shared container lists all twelve workspaces, marks the active workspace with `aria-current="page"`, and routes through the existing controller without changing any operational action path.

The same container now wraps Command Map, Incident Triage, Fleet & Responder Safety, and DRRMO Intelligence; the remaining workspaces retain the matching legacy sidebar. At narrow widths, the common navigation condenses into the established horizontally scrollable strip. The Command Map strip reserves clearance for the header and right-side GIS tools, preserving pan, zoom, layer, responder-radar, and notification controls.
