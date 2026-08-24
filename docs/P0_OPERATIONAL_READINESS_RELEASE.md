# P0 Operational Readiness Release

## Purpose

This release completes the three priority readiness controls identified after Command Map validation: operator-facing source provenance and freshness review, a human-confirmed dispatch lifecycle, and an LGU/DRRMO facility-verification workspace. The features are decision-support controls. They preserve the Command Center’s existing rule that data, recommendations, and registry records do **not** independently authorize field movement, public warnings, route clearance, facility readiness, or notification delivery.

## Delivered capabilities

| Capability | What is recorded | Operator boundary |
|---|---|---|
| Source health and provenance | Current source state, freshness metadata, provenance link, reference-only status, and a review-only audit action | A review records human attention; it does not refresh a provider, clear a route, validate an alert, or authorize a public warning. |
| Dispatch lifecycle | Proposal, explicit confirmation, reported unit acknowledgement, escalation, cancellation, closure, timestamped events, and actor-attributed audit entries | A recommendation creates **pending confirmation** only. Notification receipt remains separate from reported field acknowledgement. No state proves field safety or route clearance. |
| Facility verification | Official reference ID, pin check, contact attempt, reported access, verification outcome, source-document/reference evidence, responsible role, verification timestamp, and revalidation due date | A record documents a human check of a facility reference. It does not represent current staffing, beds, supplies, access clearance, communications, structural safety, or mission suitability. |

## Operator workflow

On the Command Map, open **Map tools → Sources** to inspect source status and provenance. The available action records a review in the audit trail and leaves underlying source data unchanged.

In **Incidents → Triage & Dispatch**, complete the verification checklist before creating a response-group proposal. The proposal remains in `pending_confirmation` until an operator opens the confirmation gate, affirms the human decision, and records it. Only afterward can a separate reported unit acknowledgement be recorded. Fleet Safety shows the corresponding lifecycle state and directs a pending proposal back to Triage; it cannot bypass the confirmation gate.

In **Community Safety → Evacuation Centers**, the LGU/DRRMO verification panel is available beneath evacuation-center operations. The same workspace is linked from the official-facility map inspector. A verifier records source evidence and a revalidation date alongside the limited reference check. A later review must create another human record; the due date is a reminder for renewed verification, not a readiness expiry.

## Persistence and API surface

The release adds three forward-only PostgreSQL migrations.

| Migration | Purpose |
|---|---|
| `008_dispatch_lifecycle.sql` | Adds explicit assignment lifecycle state and immutable transition events. |
| `009_facility_verification.sql` | Adds auditable facility-reference verification records. |
| `010_facility_verification_revalidation.sql` | Adds required source-document evidence and a scheduled revalidation timestamp. |

The FastAPI surface now provides the source-health snapshot and review endpoint, lifecycle retrieval and transition endpoints, and facility-verification list/create endpoints. Demo-mode state mirrors these contracts so the hosted preview behaves consistently with the production model while retaining its simulation boundary.

## Validation record

The release was checked with the backend regression suite, the frontend Vitest suite, TypeScript validation, `git diff --check`, and a production Next.js build. The final results were **38 backend tests passed**, **17 frontend tests passed**, successful TypeScript validation, and a successful optimized production build. The hosted Command Center was restarted and smoke-tested through the loader transition, Google-backed Command Map, Source Health drawer, Triage & Dispatch lifecycle panel, and Community Safety facility-verification workspace.

> The hosted demo remains an operational training and decision-support environment. It does not send real responders, issue public notices, authenticate facility availability, confirm road or route safety, or replace LGU/DRRMO incident command procedures.
