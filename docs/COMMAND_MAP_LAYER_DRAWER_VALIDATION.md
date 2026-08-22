# Command Map Right-Side Layer Drawer — Validation Record

**Validation date:** 2026-08-22  
**Hosted Command Center:** <https://3100-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer>

## Delivered interaction

The Command Map’s operational layer controls are now grouped in the map’s right-side tool rail with the zoom controls. The former side-panel layer-control path has been removed. A compact **▤** icon sits below the zoom-in, zoom-out, and reset controls; pressing it opens an adjacent layer drawer to the left. Its high-contrast teal state and accessible `aria-expanded` / open-close labels make the active state explicit.

| Control | Behavior |
| --- | --- |
| Zoom rail | Retains zoom in, zoom out, and reset actions at the top of the right-side map tool rail. |
| Layer icon | Opens and closes the map-layer drawer. Active state uses teal fill, brighter text, and a halo treatment. |
| Layer drawer | Appears immediately left of its tool-rail icon and exposes Live Weather Radar, Flood Risk Zones, and Topography / Terrain switches. |
| Layer switches | Continue to control the established GIS overlays; the operational-context / no-route-clearance disclaimer remains visible. |

## Validation results

| Check | Result |
| --- | --- |
| Desktop hosted view | The zoom controls and layer icon render as a single right-side rail. Opening the icon displays the drawer left of the rail with a contrasted active trigger. |
| Layer behavior | Toggling Flood Risk Zones hid and restored the corresponding hazard geometry without changing map control availability. |
| Narrow layout | At **390px**, the open drawer stayed fully inside the map canvas, remained aligned with the right-side rail, and did not overlap the responder radar or mobile broadcast action. |
| Accessibility | The icon exposes **Open map layers** / **Close map layers** labels and the drawer switches retain semantic switch roles. |
| Regression suite | **16 frontend tests passed**, including tool-rail and open-state assertions. |
| TypeScript and production build | `pnpm exec tsc --noEmit` and the Next.js **15.5.23** optimized production build passed. |
| Hosted service | Restarted production service responded with HTTP **200**. |

## Operational boundary retained

The controls continue to display operational map context only. The drawer does not imply verified hazard clearance, responder safety, or routing clearance.
