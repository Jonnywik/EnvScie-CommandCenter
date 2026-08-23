# Command Map Header and Navigation-Dock Refinement

**Date:** 23 August 2026 (PHT)  
**Scope:** Visual refinement of the Command Map top header and its below-header workstream navigation dock.

## Delivered design improvement

The Command Map now uses one coordinated header-and-dock composition rather than two visually competing panels. The persistent header begins to the right of the **68 px collapsed navigation dock**, separated by a 14 px gutter. The workstream rail begins below the header at **94 px**, creating a deliberate L-shaped command surface instead of allowing the rail to intrude on the logo, identity, search, or system-status area.

| Element | Refined behavior |
| --- | --- |
| Header | Uses shared layout tokens and begins at 82 px on desktop: 68 px dock width plus 14 px gutter. The glass surface now uses a calmer directional gradient. |
| Collapsed dock | A narrow, contained 68 px vertical dock starts below the top bar and keeps icon-only workstream access visually secondary to the command header. |
| Expanded dock | Expands to 248 px **below** the header, retaining the full five-workstream navigation without shifting or overlapping the header. |
| Material language | Dark appearance uses a restrained blue-green glass dock. Light appearance uses a coordinated white/mint glass dock, matching the light header rather than leaving a dark visual block beside it. |
| Responsive behavior | At widths up to 980 px, the navigation preserves its bounded horizontal rail, the header returns to its mobile-safe left inset, and the collapse control becomes static within the rail. |

## Important implementation correction

The layout tokens were moved to the shared `command-map-workspace` ancestor. This allows both the header and the sibling navigation dock to resolve the same geometry values. Before that correction, the rail could not inherit the header-clearance variable because it was defined only on the header’s sibling subtree.

## Validation evidence

| Check | Result |
| --- | --- |
| Frontend regression suite | **16 passed**. Coverage includes shared header-clearance/dock tokens, desktop dock position, responsive override, and light-appearance dock styling. |
| TypeScript validation | Passed with no errors. |
| Next.js 15.5.23 production build | Passed. |
| Hosted expanded layout | Header: left 82 px, top 16 px, bottom 80 px. Dock: top 94 px, width 248 px. Collapse control: top 107 px. The expanded dock remained below the header. |
| Hosted collapsed layout | Header: left 82 px, bottom 80 px. Dock: top 94 px, width 68 px. Expand control: top 104 px. The header began after the compact dock and all controls remained clear. |
| Theme review | Both light and dark appearance were checked with the collapsed dock; the header/dock material system remained cohesive and navigation state was preserved. |

This is a presentation and containment improvement only. It does not change the Google Maps canvas, radar behavior, map markers, incident handling, navigation destinations, or operational safety boundaries.
