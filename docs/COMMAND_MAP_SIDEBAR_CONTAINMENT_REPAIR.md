# Command Map Side-Navigation Containment Repair

**Date:** 23 August 2026 (PHT)  
**Scope:** Fixed Command Map side navigation and expand/collapse control overlapping the top header on desktop/narrow captures.

## Repair

The Command Map workspace navigation rail is now fixed **below** the top-bar boundary rather than starting at the viewport origin. The rail begins at `top: 94px`, while the top bar finishes at 80 px in the hosted desktop layout. The expand/collapse button is sticky only inside this bounded rail, so it begins below the same boundary in both collapsed and expanded states.

| State | Navigation behavior |
| --- | --- |
| Collapsed desktop rail | The 68 px icon rail begins at 94 px and the expand button remains within it; it no longer covers the map header or logo. |
| Expanded desktop rail | The 248 px navigation rail begins at 94 px and exposes all five workstreams below the top bar. |
| Narrow layout (≤980 px) | The responsive horizontal rail continues to begin at 94 px, has bounded height, and resets the button from sticky to static positioning. |

The rail retains its existing accessibility labels, keyboard focus behavior, collapse/expand persistence, and all five functional workstream controls.

## Validation evidence

| Check | Result |
| --- | --- |
| Frontend regression suite | **16 passed**. New assertions lock the desktop rail to `top: 94px`, the collapse button to sticky in the rail, and the narrow-layout bounded override. |
| TypeScript validation | Passed with no errors. |
| Next.js 15.5.23 production build | Passed. |
| Hosted collapsed rail | Header bottom: **80 px**; sidebar top: **94 px**; expand control top: **110 px**. Both were clear of the header. |
| Hosted expanded rail | Header bottom: **80 px**; sidebar top: **94 px**; collapse control top: **118 px**; width: **248 px**; all five workstream controls remained present. |

The change affects layout containment only. It does not change map overlays, map controls, SOS handling, dispatch workflow, weather data, or safety boundaries.
