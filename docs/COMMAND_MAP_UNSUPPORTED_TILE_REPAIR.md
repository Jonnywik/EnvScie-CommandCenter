# Command Map Unsupported-Tile Overlap Repair

**Date:** 23 August 2026 (PHT)  
**Scope:** Repeated `Zoom Level Not Supported` panels rendered by the live radar overlay over the Command Map.

## Root cause and repair

The reported overlap was caused by the RainViewer radar layer requesting tiles beyond the provider’s currently supported zoom range. RainViewer’s Weather Maps API specifies a maximum tile zoom of **7**, and its 2026 transition notice confirms that maximum. [1] [2] The Command Map had previously permitted the radar overlay through zoom 10, so the map canvas could display upstream error tiles as repeated opaque panels.

| Repair | Implemented behavior |
| --- | --- |
| Provider zoom cap | The backend publishes `max_zoom: 7` with each RainViewer snapshot. The frontend clamps the provider value to 7 rather than assuming higher zoom support. |
| Native Google Maps overlay | The Google `ImageMapType` now returns a transparent tile when the requested zoom exceeds the supported maximum or when a requested tile falls outside the valid world range. Horizontal tile coordinates are normalized before a supported request is sent. |
| Legacy SVG fallback | The fallback radar helper uses the same provider-safe zoom limit; it cannot reintroduce high-zoom unsupported tiles if Google Maps is unavailable. |
| Operator status | The map status now reports **“supported through map zoom 7”** so operators understand why close map zoom does not produce a false high-resolution radar image. |

> **Safety boundary:** Hiding unsupported tiles prevents visual obstruction; it does not make the remaining radar image proof of rainfall at a location, flood depth, road clearance, damage, or responder safety. Field confirmation and official warnings remain required.

## Validation evidence

| Check | Result |
| --- | --- |
| Backend regression suite | **32 passed**. |
| Frontend regression suite | **16 passed**. The map-context tile test now uses zoom 7 and the Command Map test verifies the provider-aware status string. |
| TypeScript validation | Passed with no errors. |
| Next.js 15.5.23 production build | Passed. |
| Hosted map | Native Google Maps remained initialized with 15 canvases and 11 inspected marker controls. |
| Hosted overlap check | Browser inspection found no `Zoom Level Not Supported` text. The status reads `Radar updated … · supported through map zoom 7`. |
| Map integrity | Primary navigation, map zoom/reset, layer control, operational markers, Google base map, and the no-SVG-fallback state remain intact. |

## References

[1] [RainViewer Weather Maps API](https://www.rainviewer.com/api/weather-maps-api.html)  
[2] [RainViewer API Transition Summary](https://www.rainviewer.com/api/transition-faq.html)
