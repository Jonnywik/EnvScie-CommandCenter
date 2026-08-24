# Critical SOS Marker Clustering and Label Behavior

**Status:** Completed and live-validated  
**Scope:** Command Map SOS marker readability remediation  
**Audience:** Balangiga LGU/DRRMO Command Center operators and maintainers

## Purpose

This change removes the severe map clutter caused by persistent critical-SOS labels at moderate zoom levels. Nearby SOS reports now collapse into an interactive incident-count cluster. Critical text labels appear only when an operator hovers over or selects an individual critical incident.

| Concern | Delivered behavior | Operator result |
|---|---|---|
| Nearby SOS markers | The Google Maps renderer uses `@googlemaps/markerclusterer` to group nearby SOS points by the current zoom and pixel radius. | Dense reports occupy one readable count badge rather than overlapping markers and labels. |
| Cluster interaction | Selecting a cluster fits the map to the cluster bounds. | Operators can reveal individual incident markers without manually searching for the correct zoom. |
| Critical-label visibility | Critical reported-event labels appear on hover, focus, or active selection rather than continuously. | Incident detail remains available without obscuring the map at rest. |
| Active-marker hierarchy | Selected markers use elevated marker and label stacking; labels render in the Google Maps float pane. | The active reported-event label remains above unselected markers and overlays. |
| Fallback map | The SVG fallback mirrors the interaction-driven label behavior. | A temporary Google Maps loading failure does not reintroduce persistent-label clutter. |

## Interaction Contract

At a zoom level where the reports are close on screen, the map displays a circular rose cluster badge with the number of grouped SOS records. The cluster’s accessible title explains that selecting it will zoom toward the grouped incidents. When the map zooms to the group extent, individual markers become available for selection.

For a critical SOS marker, a hover or keyboard focus reveals the concise label beginning with **Reported SOS**. Selecting the marker opens its information sheet and retains the label as the active map context. The label is non-interactive so it cannot block the marker’s click target.

> **Decision-support boundary:** A cluster count and a critical reported-event label organize incoming reports. They do not verify the event, prove a current hazard, establish route safety, assess facility readiness, assign a response group, or issue a public warning.

## Hosted Validation

| Check | Result |
|---|---|
| Initial map state | Passed. Individual SOS markers displayed without persistent critical-event labels. |
| Moderate zoom clustering | Passed. Two nearby SOS reports collapsed into a **2** cluster badge. |
| Cluster selection | Passed. Selecting the cluster zoomed the map to its grouped incident extent and exposed individual SOS markers. |
| Active label | Passed. Selecting a critical incident showed only that incident’s red reported-event label above neighboring markers. |
| Selection continuity | Passed. The selected marker still opened its existing SOS information sheet. |
| Stacking | Passed. The active label used the high-priority float-pane treatment and remained visible above unselected map markers. |
| Automated checks | Passed. The frontend test suite reported **17 passing tests**; TypeScript validation and the production build also succeeded. |

## Maintenance Notes

The clusterer is explicitly cleared before the marker collection is rebuilt and during map teardown. Any new SOS marker behavior should remain under the clusterer rather than calling `setMap(map)` directly. New labels should preserve the reported-context wording and only appear for an interaction state; permanent marker labels would restore the collision problem this change resolves.
