# Production Deployment and Infrastructure Prerequisites

## Deployment readiness conclusion

The Command Center backend is feature-complete for its current safety boundary, but the hosted environment remains a **demo/training deployment**. The API accurately reports this in `/v1/operations/readiness`: live release remains blocked until infrastructure, provider, identity, data-governance, and field-operations prerequisites are approved and evidenced.

> Deployment readiness is not a UI state. It requires named LGU owners, approved credentials and data sources, tested recovery paths, and operating procedures that determine how human decisions are authorized and recorded.

## Required production foundations

| Area | Required production state | Current code boundary | Evidence required before release | Suggested owner |
| --- | --- | --- | --- | --- |
| PostgreSQL/PostGIS | LGU-owned production database with encrypted transport, least-privilege application role, backups, monitoring, and a tested restore path. | Application ships migrations `001`–`014`; service-health inventories files but does not claim target database history. | Staged migration record, backup/restore drill, migration ledger, rollback decision tree. | LGU IT / database administrator |
| Application runtime | Managed FastAPI and Next.js deployment with controlled process restart, health checks, pinned dependencies, log collection, and capacity policy. | Current local/demo processes are adequate for validation only. | Deployment runbook, health probes, release/rollback procedure, named on-call owner. | Platform owner |
| Network and TLS | LGU-controlled domain, TLS termination, restricted ingress, explicit CORS allowlist, API rate limits, and protected admin paths. | Production config already rejects wildcard CORS; network policy is not application-owned. | Domain/TLS configuration, firewall/ingress record, penetration/rate-limit verification. | LGU IT / network administrator |
| Secret management | Auth signing secret, SMS gateway secret, provider keys, database credentials, and maps credentials stored outside source control with rotation. | Readiness endpoint reports only configuration categories; it never returns secret values. | Secret inventory, access policy, rotation schedule, revoke/replace drill. | Security/IT owner |
| Governed identities | Named accounts, role assignments, MFA/equivalent, offboarding, access review, and authoritative role policy. | Demo login is explicitly disabled in live mode; live identity requires configured secret and governed account source. | Role matrix, onboarding/offboarding workflow, access review record. | DRRMO lead / identity administrator |
| Event transport | Durable cross-worker pub-sub for websocket/event fan-out if production scales beyond one API process. | Service-health truthfully labels the current websocket hub as process-local and non-durable across workers. | Selected transport, failover behavior, reconnect/duplicate-event test, operational ownership. | Platform owner |
| Refresh jobs | Managed deterministic refresh jobs for authorized alerts/weather feeds with rate limits, retry bounds, idempotency, and stale-state alerting. | Feed polling is disabled in demo mode and requires an approved alert-feed URL. | Job schedule, source policy, run history, provider outage/recovery drill. | Data steward / platform owner |
| Notification delivery | Authorized SMS/push/voice provider with sender/device enrollment, consent, recipient validation, deduplication, failure/retry policy, and receipt semantics. | Providers fail safely while unconfigured; technical receipt is distinct from responder acknowledgement. | Sandbox delivery drill, consent evidence, failure/retry test, provider escalation procedure. | Communications lead |
| Source authority | Approved weather, radar, lightning, Project NOAH, and facility-data sources with terms/license, normalized contracts, freshness thresholds, and fallback states. | Reference and pending-provider states are explicitly surfaced; no source is silently treated as live. | Source register, legal/terms approval, source-health test, assigned data owner. | Information officer / data steward |
| Field/mobile operations | Approved device fleet, telemetry/check-in method, offline SOS/SMS fallback, battery/network-loss procedure, and responder training. | Current workflows preserve reported/stale/unavailable data semantics; they do not prove field position or safety. | Device pilot, offline drill, check-in SOP, field training record. | Field-response lead |
| Privacy and retention | Data classification, lawful purpose, consent, retention, legal hold, export authorization, and audit-review process. | Immutable audit UI and working exports do not establish LGU policy. | Signed privacy/retention/export policy and access-control verification. | Privacy/legal officer |
| Observability and recovery | API, database, source, job, provider, event, storage, and audit-write monitoring with recovery objectives and drills. | Readiness/service-health endpoints expose bounded application evidence only. | Dashboard/alerts, restore drill, network/provider failure reports, after-action record. | Platform owner / LGU IT |

## Ordered deployment gates

### Gate A — Foundation approval

Approve ownership, role authority, data classification, source/provider selection, secret management, network/TLS, and production database plan. Do not set `DEMO_MODE=false` until this evidence is accepted.

### Gate B — Staging environment

Deploy the same application version to a non-production PostGIS environment. Apply migrations in sequence; seed only sanitized test data; verify signed identity, constrained CORS, health/readiness/service-health contracts, provider sandbox adapters, and rollback procedure.

### Gate C — Integration and operational drill

Execute the backend integration matrix, multi-operator dispatch lifecycle checks, provider outage/retry checks, websocket reconnect test, database loss/restore drill, network-partition drill, and offline mobile/SMS exercise. Record evidence without relying on demo records as production evidence.

### Gate D — Production release

Use a planned release window with database backup, migration verification, service health checks, source health review, notification sandbox-to-production transition approval, monitoring coverage, and an incident escalation owner. Keep human-confirmation and decision-limit language unchanged.

### Gate E — Post-release assurance

Run an LGU tabletop exercise, supervised field exercise, access review, provider reconciliation, alert-source freshness review, backup-restore drill, and after-action review before expanding access or enabling additional integrations.

## Integration verification evidence

The contained integration suite currently exercises all implemented read endpoint families, route parameters, readiness/service-health contracts, Project NOAH overlay delivery, authenticated audit access, and all five websocket topics. It is intentionally non-destructive: it does not create SOS records, propose/confirm dispatches, send communications, deliver notifications, alter resource positions, or transition incidents.

Mutation endpoints remain covered by the existing focused tests for controlled demo contracts, including feed health, group check-in, center review, assignment confirmation, notification retry, stale-check-in rejection, SOS verification, facility verification, lifecycle controls, and completion safeguards. These are application-level tests; they do not substitute for provider, production database, or field-device drills.

## Release blockers that must not be bypassed

1. No real provider credential, source URL, user identity, or production database may be invented to turn a readiness check green.
2. A map, route, ETA, facility reference, feed receipt, or notification receipt must not be represented as a route clearance, field-safety finding, public warning, responder acknowledgement, or dispatch authority.
3. A deployment is blocked if migrations, recovery, identity roles, source authority, provider delivery, privacy policy, or named LGU ownership lack evidence.
