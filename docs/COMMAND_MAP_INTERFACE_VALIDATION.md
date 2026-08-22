# Command Map (Live Operations) — Interface Validation

**Validation date:** 2026-08-22  
**Application:** EnvScie CommandCenter  
**Target:** Hosted Next.js 15 production build

## Validated live behaviors

| Area | Result | Evidence |
| --- | --- | --- |
| Map-first startup | Pass | A fresh hosted session opened directly into the full-viewport Command Map canvas. |
| Full-screen map interaction | Pass | GIS hazard, resource, evacuation-center, alert, radar, and weather-source elements were visible on the central map. Existing zoom, pan, reset, and map-contained gesture protections remained exposed. |
| Fixed command bar | Pass | The top overlay displayed the EnvScie CommandCenter emblem, live PST clock, global search, connected-system status, and operator avatar. |
| Global search | Pass | Searching `Alpha` returned **Unit · ALPHA-1 · Alpha Rescue** and a clear radar-location confirmation. |
| Situational awareness | Pass | Weather radar, flood-risk, and terrain switches were exposed. The weather switch was toggled for validation and restored to its enabled default state. |
| Priority alert feed | Pass | Critical and advisory alerts were available as map-side priority cards with access to the verified-alert workspace. |
| Responder radar | Pass | The bottom drawer displayed active response units with name, vehicle/resource context, status, and ETA. |
| Mass Area Notification | Pass | The broadcast FAB opened a modal with audience selection and a message draft field. The modal clearly retained the draft-only boundary: radius selection, approval, and delivery confirmation are still required before transmission. No message was sent. |

## Responsive and safety review

The Command Map stylesheet defines desktop, tablet, and narrow-screen layouts. At narrow widths, the top bar becomes two rows; map labels and less-critical attribution are reduced; the situational panel becomes scrollable and collapsible; the responder radar spans the safe lower viewport; and the broadcast FAB remains reachable above the radar drawer.

The implementation preserves the operational constraints established before the redesign: the GIS map is decision support rather than a route-clearance authority, source freshness stays visible, alert and dispatch workflows remain accessible from the floating controls, and broadcast creation is a draft-only action.
