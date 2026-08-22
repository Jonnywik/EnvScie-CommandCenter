# Final Command Center Action Audit

The Command Center exposes **18 operational actions across eight tabs**. Every action reaches the shared `onAction` handler, which records an audit event and shows a status toast. Demo mode applies the mutation to in-memory state where the workflow has a mutable operational record; live mode now applies the corresponding PostGIS update for feed checks, roster check-ins, center reviews, and resource resupply, while preserving audit-only semantics for review and decision records.

| Tab | Action | Operational meaning | Demo mode | Live mode | Feedback |
|---|---|---|---|---|---|
| Overview | `bulletin.draft_started` | Open a new public-information bulletin draft | Creates a draft communication record | Records the action for the communication workflow | Updated / Audit recorded |
| Live SOS | `sos.handover_reviewed` | Record a dispatcher-to-field handover review | Updates the SOS handover record | Records the handover audit event | Audit recorded |
| Verified Alerts | `alert.verified` | Verify an alert before operational use | Marks the alert verified | Records the verification audit event | Updated / Audit recorded |
| Verified Alerts | `bulletin.queued` | Queue an alert for a public bulletin | Marks the alert queued | Records the queue decision | Updated / Audit recorded |
| Verified Alerts | `feeds.reviewed` | Record a review of the official feed set | Records feed review state | Records the review audit event | Audit recorded |
| Verified Alerts | `feed.health_checked` | Check one source's freshness and health | Refreshes the source state | Touches the live source record and records the audit event | Updated / Audit recorded |
| Verified Alerts | `feeds.sync_requested` | Request a manual feed synchronization | Refreshes all demo feed health | Touches live feed source freshness metadata and records the audit event | Updated / Audit recorded |
| Risk Map | `hazards.reviewed` | Confirm current hazard register and boundaries | Updates hazard review timestamps | Records the review audit event | Updated / Audit recorded |
| Risk Map | `route.previewed` | Record a safe-route preview before movement | Records the route review | Records the route preview audit event | Audit recorded |
| Risk Map | `gis.resource_position_checked` | Confirm a tracked unit's position confidence | Updates demo position review state | Records the position check audit event | Audit recorded |
| Evacuation Centers | `centers.capacity_reviewed` | Review the complete center-capacity snapshot | Updates all demo center review timestamps | Touches all live center records and records the audit event | Updated / Audit recorded |
| Evacuation Centers | `center.capacity_verified` | Verify one center's intake capacity | Updates the center verification timestamp | Touches the live center record and records the audit event | Updated / Audit recorded |
| Evacuation Centers | `center.resupply_requested` | Request supplies for a constrained center | Records the resupply request | Records the resupply audit event | Audit recorded |
| Resources | `resource.accountability_checked` | Confirm a resource or team's accountability | Updates the demo resource review | Records the live audit event | Updated / Audit recorded |
| Response Groups | `response_group.checked_in` | Refresh roster and field-position freshness | Updates roster and position timestamps | Updates `resource_units.last_check_in_at` and records the audit event | Updated / Audit recorded |
| Communications | `coordination.message_sent` | Send an outbound coordination message | Adds an in-memory event and audio item | Inserts a live `communication_events` record | Updated / Audit recorded |
| Communications | `dispatch.recommendations_generated` | Generate ranked response-group recommendations | Runs the demo scoring engine | Runs the PostGIS-backed roster scoring engine and records the action | Updated / Audit recorded |
| Communications | `dispatch.recommendation_accepted` | Accept the selected recommendation for handoff | Records the acceptance | Records the acceptance audit event | Audit recorded |

## Guardrails verified

The recommendation response remains advisory and includes specialty matches, missing specialties, distance, readiness, freshness, constraints, and safety notes. Assigned, stale, constrained, and offline units are never represented as an unconditional deployment clearance. Assignment routes still enforce the 15-minute roster check-in freshness rule and trigger the configured SMS, push, and in-app notification contract.

The live operations snapshot is no longer an empty placeholder. It assembles teams and personnel from `resource_units`, latest positions from `resource_positions`, active SOS-derived readiness rows, active hazard zones, live communication events, and open SOS-derived triage tasks while preserving the frontend's demo payload vocabulary.
