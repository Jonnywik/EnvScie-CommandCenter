# Incidents Workspace Improvements

## Purpose

This release improves the Command Center’s **Incidents / Live SOS** workflow without automating dispatch, inferring field safety, or treating a technical delivery record as a responder acknowledgement. It combines high-volume queue triage, accessible detail review, durable reported-verification inputs, dispatch lifecycle awareness, and handover context.

## Delivered controls

| Area | Improvement | Operational boundary |
|---|---|---|
| Live SOS queue | Added severity/age/uncertainty/verification sorting, active-filter chips, one-click filter recovery, false-alarm review, and compact metadata for narrow layouts. | Sorting and filtering change only the displayed queue; they never change SOS state or priority. |
| Triage Drawer | Added modal semantics, focus containment, background isolation, deterministic focus restoration, and nested Escape behavior. | Closing a drawer or selector does not acknowledge, dispatch, cancel, resolve, or notify anyone. |
| SOS status changes | False-alarm and resolution actions require a human-entered reason. Resolution is blocked when an active dispatch lifecycle or an incomplete linked Incident Command Record still needs review. | A coordinator remains responsible for reviewing the evidence and dependencies before any transition. |
| Verification evidence | Added append-only reported-verification records with category, source role, contact method, note, optional reference, actor attribution, and a stated decision limit. | A verification input does not prove an SOS is valid, a location is safe, a route is clear, or a unit is authorized to move. |
| Incident workboard | Added required-next-action prompts, evidence/lifecycle timeline, incident ownership context, data-freshness display, notification context, and copyable handover brief. | Prompts and copied handovers preserve context only; they do not transfer authority, accept tasking, or establish safety. |
| Dispatch selector | Escape now closes the nested selector before the Triage Drawer and returns focus to the exact Dispatch response team trigger. | Selecting a team remains a pending proposal that requires the separate human confirmation lifecycle. |

## Database deployment requirement

Apply `db/014_sos_verification_records.sql` to the live PostgreSQL/PostGIS database before enabling persistent verification evidence in live mode. The migration creates `cfr.sos_verification_records` and its SOS/time index. Demo mode already supplies matching transient behavior for preview and automated regression tests.

## Validation record

The release passed 42 backend tests, 18 frontend tests, TypeScript validation, and an optimized Next.js production build. Hosted checks confirmed Live SOS sorting and compact metadata, drawer focus return to the originating SOS row, selector Escape hierarchy, and selector focus return to the Dispatch response team trigger. No new responder proposal, dispatch confirmation, notification, false-alarm, resolution, or closure action was performed during those browser checks.
