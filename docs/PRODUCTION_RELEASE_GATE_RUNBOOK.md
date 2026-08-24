# Production Release-Gate Runbook

## Purpose

This runbook controls the transition from the current **training and decision-support** Command Center to an LGU-operated production environment. It does not authorize deployment by itself. A gate may be marked complete only when its named LGU owner supplies the listed evidence and the engineering owner records the corresponding technical verification.

> The system must not represent telemetry, routes, weather, facility references, provider receipts, or recommendations as proof of field safety, route clearance, dispatch authority, public-warning release, or responder acknowledgement.

## Gate 0 — Governance and configuration

| Requirement | LGU owner | Engineering evidence | Gate evidence |
| --- | --- | --- | --- |
| Named operator accounts and role matrix | DRRMO lead / identity administrator | Least-privilege role tests and privileged-action audit sample | Approved role matrix, offboarding process, periodic access-review schedule |
| Dispatch, closure, export, and warning authority | Incident commander / DRRMO lead | UI/API authorization map | Approved command SOP with escalation windows |
| Data classification, retention, and privacy | Privacy/legal officer | Export/access controls and retention design | Signed retention, consent, legal-hold, and disclosure policy |
| Approved source/provider register | Information officer / communications lead | Non-sensitive readiness status and source-health display | Source authority, terms, service owner, cadence, and degraded-state policy |
| Migration and recovery procedure | LGU IT / database administrator | Staging migration, backup, restore, and rollback rehearsal | Recorded recovery objective and restoration result |

## Gate 1 — Controlled live integrations

| Requirement | Required control | Completion evidence |
| --- | --- | --- |
| Weather/hazard sources | Per-source source URL authority, contract normalization, freshness threshold, rate limit, and failure policy | Live/sandbox source health, last-success/last-error, and degraded-state drill |
| SMS/push provider | Sender/device registration, consent scope, recipient validation, retry cap, deduplication, and outage handling | Sandbox delivery drill showing failed/pending/receipt states distinctly from field acknowledgement |
| Communications provider | Approved operating procedure and retained human confirmation before consequential release | Reviewed test message and audit trail; no public-warning authority inferred |

## Gate 2 — Field and mobile operations

| Requirement | Required control | Completion evidence |
| --- | --- | --- |
| Unit telemetry | Approved source, location/check-in age rule, accuracy rule, offline fallback, and missing-data escalation | Field pilot with reported, stale, and unavailable examples |
| Offline SOS | Device enrollment, encrypted local queue, retry/backoff, SMS fallback, battery/network-loss handling | Real-device drill with traceable submission and recovery |
| Resource accountability | Named owner, request/hold/issue/receipt/reconciliation distinction, variance review | Logistics drill with immutable decision trail and reported receipt evidence |

## Gate 3 — Resilience and assurance

| Requirement | Required control | Completion evidence |
| --- | --- | --- |
| Service and provider monitoring | API, feed, job, notification, database, storage, audit-write, and event-delivery checks | Alert test and operator-visible readiness record |
| Concurrency and failure safety | Concurrent proposal, retry, reconnect, source outage, and degraded-map tests | Staging report showing no duplicate active dispatch proposal |
| Accessibility and field usability | Keyboard, screen reader, zoom/reflow, touch targets, reduced-motion, low-bandwidth, and local-language review | Test matrix across desktop and supported field devices |
| Recovery | Backup integrity, restore, rollback decision path, and recovery target | Documented successful restore drill |

## Non-sensitive configuration inventory

The following values must be present in the production deployment but must never be stored in source control or displayed in the operator interface: database credentials, authentication signing secret, inbound SMS gateway secret, SMS/push provider keys, and map proxy credentials. The production readiness surface may report only whether a required category is configured, not its secret, URL query, token, or full endpoint.

## Release decision

The release is blocked if any P0 gate lacks evidence. A live provider outage, stale feed, absent telemetry, or unconfigured integration must result in an explicit degraded/unavailable state and human review prompt; it must not cause the platform to invent a current condition or silently substitute demo data.
