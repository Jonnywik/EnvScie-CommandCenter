# Live SOS and Triage Queue UI Review

## Review scope

This review inspected the current Live SOS queue, Triage Drawer, Dispatch response team selector, global keyboard handling, filter states, and responsive CSS. It also exercised the hosted Command Center without creating a new team proposal, dispatch confirmation, notification, or SOS status transition.

The recent selector-search dismissal is **resolved**. The hosted test entered `water` in the role/specialty search and changed the availability filter while the Triage Queue drawer remained open. The selector retained its context and correctly narrowed the visible team list.

## Findings

| Priority | Area | Observed edge case | Risk | Recommended remediation |
|---|---|---|---|---|
| **P0** | Dispatch proposal integrity | The proposal route inserts a new `pending_confirmation` assignment without checking whether that SOS already has an open pending or confirmed assignment. The drawer does not display an existing proposal. | A coordinator can create competing responder proposals for one SOS, increasing the chance of conflicting confirmation. | Add a database guard for open assignments per SOS, return the existing lifecycle record, and show the active proposal with Cancel or View lifecycle actions. |
| **P1** | Team eligibility and ETA | The selector’s default “Available & ready” filter checks availability only. ETA can be shown for a stale check-in or position, while the proposal API rejects stale data only after the user clicks Select. | The UI can visually imply current eligibility or a usable ETA when source age already blocks tasking. | Evaluate status, location age, and check-in age before rendering an eligible action; disable selection and label the stale condition. Suppress or clearly mark stale ETA estimates. |
| **P1** | State-changing triage actions | “Mark false alarm” and “Mark resolved” are single-click transitions with a generated note. | A high-impact status change can be committed without a reason, confirmation step, or explicit review of the linked incident/dispatch record. | Add a confirmation dialog requiring an operator-entered reason; block resolution when an open dispatch lifecycle or unresolved follow-up exists. |
| **P1** | Modal accessibility | The Triage Drawer has `role="dialog"` but no `aria-modal`, focus trap, initial focus, or focus restoration. In the hosted test, Escape closed the drawer and left focus on `BODY`, not the originating SOS row. | Keyboard and screen-reader operators can lose their place in a high-volume queue. | Use a shared dialog primitive with focus trapping, Escape handling, initial focus, and return focus to the source SOS row. Apply the same pattern to the selector portal. |
| **P1** | In-flight operation visibility | The drawer backdrop and close control remain usable while a status update, safety assessment, team load, or proposal request is in progress. | A request can finish after its progress, error, or pending-proposal result has been visually discarded. | Disable drawer dismissal while mutating, or retain a persistent operation result and reopenable task state after dismissal. |
| **P2** | Mobile queue scan | At the compact breakpoint, the queue hides the channel/age and location columns. | Mobile operators lose age, channel, coordinate preview, and location-confidence context until they open each row. | Keep compact inline metadata under the incident summary, for example `SMS · 6m · ±42m`, and make location confidence visible before opening the drawer. |
| **P2** | Empty filters | The hosted `Received` filter correctly showed an empty state, but the state has no Clear filters action or quick explanation of the active filters. | Recovery from a no-results state is slower during a rapid triage pass. | Add a one-click Clear filters control and show the selected status/channel terms in the empty-state message. |
| **P2** | Selector filter semantics | “Available & ready” is labelled as a combined eligibility filter but is implemented as `availability === "available"`; readiness is assessed separately. | The label can disagree with the returned list when a group is available but not ready. | Either filter on both availability and ready status or rename the option to “Availability: available.” |
| **P3** | Queue prioritization | The queue relies on its incoming data order and does not offer sort modes such as severity, age, or confidence. | High-volume queues may require more manual scanning. | Add a non-mutating Sort control with severity and oldest-first presets, while preserving a deterministic default order. |
| **P3** | Filter completeness | Live SOS status filters do not expose `false_alarm`, even though the drawer can create that status. | Review and post-incident reconciliation require broader filtering or text search. | Add a False alarm status option and a compact archived-state toggle. |

## Hosted checks completed

The following non-destructive checks passed:

| Check | Result |
|---|---|
| Specialty search in dispatch selector | Entering `water` retained the selector and showed Delta Water Rescue only. |
| Availability filtering | Switching to Assigned retained the selector and showed Alpha Rescue as non-selectable. |
| Escape dismissal | Escape closed the drawer; focus did not return to the originating row, confirming the accessibility issue above. |
| Empty Live SOS filter | The Received filter showed the expected no-results state without altering incident data. |

> The reviewed interface remains decision support. A proposed team, ETA estimate, filtered queue, or status display never proves a route is clear, a unit is safe, a facility is ready, a notification was delivered, or an authorized dispatch decision has been made.
