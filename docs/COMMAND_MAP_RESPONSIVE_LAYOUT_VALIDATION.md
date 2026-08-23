# Command Map Responsive Layout Validation

## Scope

This refinement addresses height-sensitive Command Map overlays without changing the full-height desktop navigation dock. It adds shared mobile safe-area tokens, bounds inspector and layer-drawer height against the responder radar, compacts the radar at short mobile heights, and removes CSS for an inactive popup-navigation implementation.

## Hosted Desktop Checks

The production Command Map loaded with the full-height navigation dock, top header, map controls, responder radar, quick links, and broadcast action all present. Opening the live map-layer drawer exposed the Road, Satellite, and Terrain basemaps; active radar and flood-risk switches; provider-pending meteorology controls; and the operational-context safeguard. The drawer remained above the lower responder radar and did not obstruct its roster controls at the desktop viewport.

## Automated Checks

| Check | Result |
| --- | --- |
| Frontend Vitest | Passed: 16 tests |
| TypeScript (`tsc --noEmit`) | Passed |
| Next.js production build | Passed |

## Inspector and Appearance Checks

An evacuation-center pin opened its information sheet while the layer drawer remained available. The sheet retained its close control, location data, position-check action, and safety reminder; the responder radar remained visible below the active map overlays. The alternate dark appearance was also toggled successfully, preserving readable contrast for the full-height dock, map pin sheet, layer drawer, map controls, radar cards, and header.

After the final build, the compact desktop dock was rechecked with a response-resource information sheet open. The sheet now begins to the right of the 68 px collapsed dock, rather than sitting beneath it. This leaves the dock’s expand control and five workstream buttons unobstructed while preserving the sheet’s close control, details, action, and safeguard text.

## Result

The active Command Map now has a single shared safe-area system for its narrow-screen overlays, a compact short-height responder-radar treatment, and pin sheets that clear the desktop navigation dock in both collapsed and expanded states. The prior popup-navigation CSS was removed after confirming that the live Command Map uses the shared `CommandCenterNavigation` dock instead.
