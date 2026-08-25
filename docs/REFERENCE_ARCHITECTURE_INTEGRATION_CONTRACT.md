# Referenced Architecture: Mobile-to-Command-Center Integration Contract

This record captures the integration requirements extracted from the user-referenced **Disaster Risk Reduction App Architecture Design** task, including its `mobile-sos-command-center-plan.md` and `sos-command-center-integration-plan.md` artifacts.

## Required Operational Contract

The reference architecture requires a single auditable lifecycle for an explicitly confirmed SOS request. It separates ordinary incident reports and family check-ins from dispatch-grade SOS cases. A mobile SOS must enter the Command Center as `submitted`, then only move through `acknowledged`, `assigned` or coordination-in-progress, `contact_attempted`, `escalated`, `resolved`, or `cancelled` through authorized, audited actions.

The Command Center must receive a newly submitted SOS immediately in a priority queue, expose consent-aware location and accuracy context only to authorized operators, and retain the operator audit trail. A submission, message-provider transport result, map proximity, dispatch proposal, or technical receipt must not be presented as confirmation that a responder was dispatched or arrived.

The resident-facing mobile experience must preserve a durable offline outbox, distinguish queued/offline/SMS handoff from confirmed backend receipt, and retrieve only resident-safe lifecycle feedback. It must never disclose team identity, exact dispatch position, operator notes, sensitive evidence, or an unverified operational outcome.

## Current Platform Mapping

| Contract concern | Existing platform foundation | Required audit focus |
|---|---|---|
| SOS intake | `POST /v1/sos` persists internet SOS and publishes `lgu:sos`; `POST /v1/sos/sms` verifies and decodes gateway-delivered fallback payloads | Ensure mobile submits an idempotency correlation value and cannot imply that an SMS composer handoff reached the LGU. |
| Command Center queue | `/v1/dashboard/summary`, `/v1/gis/map`, and `ws /v1/ws/lgu` expose SOS to operational screens | Confirm queue updates and lifecycle actions remain separate from resident status wording. |
| Operator lifecycle | Authorized `PATCH /v1/sos/{sos_id}/status`, dispatch lifecycle endpoints, verification records, incident records, and audit events | Expose a resident-safe read model without weakening role protection or treating assignment as arrival. |
| Mobile feedback | Expo app currently caches alerts/centers and SOS outbox entries | Add safe status refresh/cache and unambiguous lifecycle wording without introducing unapproved native push or live delivery claims. |
| Offline resilience | AsyncStorage SOS outbox and native SMS handoff exist | Retain the fallback; persist `queued` or `SMS handoff` truthfully until a gateway/HTTP receipt is actually available. |

## Integration Coverage Implemented in This Audit

| Integration path | Implemented connection | Evidence and safety boundary |
|---|---|---|
| Mobile installation to backend | The Expo app now creates and persists a pseudonymous `cfr.device-public-id.v1` value, then refreshes `POST /v1/mobile/devices` when online. | The registration records only an installation reference and platform. It does not upload resident profile data or location. |
| Mobile SOS to Command Center | The app submits a persistent client nonce with `POST /v1/sos`. The backend stores that nonce, preserves the original received time on retry, publishes the SOS to `lgu:sos`, and exposes it through the Command Center summary and GIS paths. | The nonce prevents duplicate mobile retries from creating multiple operational cases. Internet intake remains separate from SMS gateway intake. |
| Command Center acknowledgement to mobile | Authorized Command Center status actions remain audit-protected. The mobile app refreshes its local outbox from `GET /v1/sos/resident-status` while it is online and active. | The resident response exposes only status timestamps and plain-language wording; it excludes location, evidence, team identity, operator notes, and dispatch route data. |
| Confirmed dispatch to mobile | A human-confirmed dispatch lifecycle transition now records the linked SOS as `dispatched`, creates an SOS status event, and publishes a realtime SOS update. | Resident wording is **Help coordination is in progress** and explicitly states that it does not confirm responder arrival or field safety. A proposed assignment alone does not update the resident status. |
| SMS fallback | The mobile UI reports an SMS handoff as awaiting LGU receipt. When an approved, signed gateway later ingests the payload, the backend correlates it through the same device and nonce identity. | Opening the device SMS composer is not treated as provider delivery, gateway receipt, Command Center acknowledgement, or dispatch confirmation. |

## Validation Evidence

The new regression coverage verifies device enrollment, idempotent mobile SOS creation, one-record visibility in the Command Center queue, resident-status redaction, acknowledgement feedback, confirmed-dispatch feedback, and the absence of responder-arrival claims. The complete backend suite passed with **51 tests**, the Command Center suite passed with **29 tests**, the optimized Next.js production build passed its lint and type checks, and the Expo mobile TypeScript check passed.

## Safety Constraints

The current environment remains demo/training-bound. Provider transport, push receipt, gateway receipt, Command Center acknowledgement, response-team acknowledgement, dispatch confirmation, route clearance, and field arrival are distinct facts. None authorizes a public warning or proves resident safety, evacuation compliance, field conditions, or medical outcome.

Native iOS and Android push notifications, inbound SMS gateway credentials, live provider delivery, native background execution, and LGU production approval are not activated by this audit. The separate native-push implementation plan and the existing deployment prerequisites remain required before live public operation.
