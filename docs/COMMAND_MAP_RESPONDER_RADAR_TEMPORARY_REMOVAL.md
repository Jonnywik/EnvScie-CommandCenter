# Command Map Responder Radar: Temporary Removal

**Status:** Completed and live-validated  
**Scope:** Temporary removal of the bottom-center Responder Radar segment

## Change Summary

The Responder Radar segment, including its compact summary state and field-unit carousel, has been removed from the Command Map for the current interface iteration. The map canvas now uses the recovered lower viewport area for clearer geographic context and less visual competition.

| Area | Updated behavior |
|---|---|
| Responder Radar | Removed from the Command Map. Response-group data remains available through the Field Response workspace. |
| Legend | Moves to the lower-left map edge using the reduced reserve, without a radar panel above it. |
| Map tools | Continue to open in their established reserved region and retain their no-overlap behavior. |
| Broadcast action | Moves into the reclaimed lower-right space while remaining separate from zoom/reset controls. |
| Search results | Responder search results direct operators to Field Response rather than referring to the removed radar. |

## Validation Record

The hosted Command Map was restarted and checked with live Google Maps tiles. The Responder Radar, its field-unit cards, its summary bar, and its minimization trigger were absent. The lower-left legend and lower-right broadcast action remained visible and separate from the right-side zoom/reset pill.

The frontend regression suite reported **17 passing tests**. TypeScript validation and the production build completed successfully before hosted verification.

> **Operational boundary:** Removing this map segment does not remove response-group records or create automatic dispatch behavior. It only changes how the Command Map presents supporting field-unit information.
