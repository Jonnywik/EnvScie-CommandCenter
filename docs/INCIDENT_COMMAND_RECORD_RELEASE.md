# Incidents Command Record Release

## Scope

This release extends the **Incidents** workstream from a triage view into an auditable incident command record. It preserves the existing SOS inbox, verification checklist, advisory recommendation view, and human-confirmed dispatch lifecycle while creating a durable place to organize the underlying reported evidence and human decisions.

## Delivered workflow

| Stage | Delivered control | Boundary |
|---|---|---|
| Intake | A coordinator can create one incident command record from an SOS report. The original SOS remains intact and linked. | Creating a record does not acknowledge, resolve, reject, or dispatch the SOS. |
| Command record | The record shows linked intake count, status, follow-up owner, due date, and immutable status-event timeline. | The record organizes reported evidence; it does not verify field conditions or operational safety. |
| Human transitions | Operators can record monitoring, escalation, stabilization, closure, and reopening with a required decision note. | Transitions do not affect response-group assignments, notifications, route clearance, or public messages. |
| Closure | Closing requires a named follow-up owner and a follow-up date. | Closure never deletes evidence or cancels a dispatch lifecycle record. |
| Handover | Intelligence shows unresolved incident records, assigned owner, and due date in a read-only handover surface. | Handover visibility does not mutate or close an incident. |

## Persistence and interfaces

Migration `011_incident_command_records.sql` adds `cfr.incidents`, `cfr.incident_sos_links`, and `cfr.incident_events`. The API exposes a snapshot endpoint, creation from SOS endpoint, and actor-attributed transition endpoint. The demo-mode implementation mirrors the production contract so the hosted preview retains safe behavior.

The Incidents workspace displays the new **Incident Command Record** beneath the existing human-confirmed dispatch lifecycle. The panel remains intentionally separate from dispatch confirmation. Its explicit language states that records do not authorize dispatch or verify field conditions.

## Validation

The release passed **39 backend tests**, **17 frontend tests**, TypeScript validation, and an optimized Next.js production build. The hosted Command Center was restarted and smoke-tested through the loader transition and the Triage & Dispatch view, where the new Incident Command Record rendered with its optional owner and due-date inputs and explicit create action.

> This is a decision-support and accountability capability. LGU/DRRMO staff must continue to apply local SOPs, verify conditions with authorized sources and field teams, and make all dispatch, warning, routing, and public-information decisions through the appropriate human process.
