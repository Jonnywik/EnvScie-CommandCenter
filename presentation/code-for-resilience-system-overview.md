# Code for Resilience

## System Features and How the Platform Works

**Prepared by:** Manus AI  
**System:** Code for Resilience — Balangiga LGU Disaster-Management Platform  
**Operational context:** Balangiga, Eastern Samar, Philippines  
**Document purpose:** Provide a practical, system-level explanation of the platform’s components, features, workflows, controls, and operating model.

> **Code for Resilience** is a coordinated disaster-management platform that connects resident emergency reporting, verified hazard information, evacuation intelligence, geographic response operations, communications, resource accountability, and auditable LGU dispatch workflows in one operational picture.

## 1. Executive summary

Code for Resilience is designed for a coastal municipality that must coordinate response during typhoons, storm surge, flooding, landslides, infrastructure damage, and communications disruption. The platform addresses the operational gap between an incident occurring in a barangay and the Local Government Unit being able to verify, prioritize, route, assign, communicate, and record the response.

The system has two principal user surfaces. Residents use the mobile experience to view verified alerts, find evacuation centers, inspect risk information, access an offline emergency toolkit, and submit an SOS through internet or SMS fallback. LGU dispatchers and responders use the Command Center website to maintain a shared operating picture, triage SOS incidents, verify alerts, monitor hazards and resources, assign response groups, communicate with field units, and preserve an audit record of consequential actions.

The FastAPI backend is the coordination layer. It exposes authenticated REST endpoints, WebSocket channels for live operational events, GIS and route services, notification lifecycle endpoints, alert and evacuation data, and audit actions. In live mode, PostgreSQL/PostGIS provides durable relational and spatial storage. In demo mode, the same operational flow is preserved using deterministic in-memory state so the system can be demonstrated without pretending that simulated delivery is a real external notification.

## 2. The problems the system is designed to solve

The platform focuses on five linked disaster-response problems rather than treating them as isolated software features.

| Operational problem | Consequence during an incident | Code for Resilience response |
| --- | --- | --- |
| Weather and hazard information is delayed, inconsistent, or difficult to verify. | Residents and responders may act on stale or unverified information. | Source-health indicators, verified alert records, freshness timestamps, severity and hazard filtering, and explicit review actions. |
| Residents do not have a dependable view of open evacuation options. | Movement decisions are delayed, and centers can become overloaded or misunderstood. | Center status, current occupancy, total capacity, amenities, location, readiness context, and safe-route guidance. |
| Emergency requests arrive through fragmented channels. | SOS reports can be missed, duplicated, or triaged inconsistently. | A normalized SOS record with severity, channel, location accuracy, status transitions, queue ordering, and a Command Center triage drawer. |
| Power, signal, or commercial communications may be unreliable. | A resident may be unable to complete an ordinary network request. | Cached mobile data, durable SOS outbox state, SMS payload compression, SMS handoff, and explicit delivery states. |
| Dispatch actions are difficult to reconstruct after the event. | Supervisors cannot easily verify who acted, what was sent, or why a decision was made. | Auditable operations actions, notification records, acknowledgement timestamps, retry history, and actor identity. |

## 3. System architecture

The platform is organized as a set of cooperating layers. Each layer has a defined responsibility so that the user interface is not responsible for making safety-critical decisions that belong in backend services or operational policy.

| Layer | Main technology or module | Responsibility |
| --- | --- | --- |
| Resident mobile experience | React Native / Expo-oriented mobile contracts | Presents verified alerts, evacuation information, risk layers, emergency toolkit content, connectivity state, location state, and SOS submission or fallback. |
| LGU Command Center | Next.js and React | Provides the operational dashboard used for triage, verification, GIS monitoring, dispatch, communications, resource accountability, and audit actions. |
| API and coordination layer | FastAPI, Pydantic, async SQLAlchemy | Authenticates users, validates requests, exposes operational snapshots, accepts incident updates, coordinates dispatch actions, and publishes realtime events. |
| Durable storage | PostgreSQL with PostGIS in live mode | Stores users, devices, SOS requests, alerts, evacuation centers, hazards, resource positions, assignments, communications, notifications, and audit events. |
| Demo state layer | Deterministic in-memory demo services | Preserves the same request, response, status, notification, and audit flow for demonstrations without requiring a production provider or database. |
| Realtime transport | WebSocket channels | Delivers SOS, GIS, response-group, coordination, and notification events to connected Command Center clients. |
| External and field integrations | Alert feeds, SMS gateway, push-compatible provider, GPS/radio/manual position sources | Brings verified information into the platform and sends or receives operational updates when configured for live use. |

The browser’s API contract is centralized in the frontend client layer. It applies the configured API base URL, attaches the stored bearer token, disables stale browser caching for operational requests, and exposes typed functions for the Command Center’s data surfaces.[1]

### 3.1 Logical flow

```text
Resident mobile app / field source
          │
          ├── online SOS, cached sync, GPS, SMS fallback
          │
          ▼
FastAPI coordination API ─────── WebSocket event manager
          │                                │
          ├── auth and role checks          ├── SOS events
          ├── operational snapshots         ├── GIS events
          ├── GIS and safe routing          ├── response-group events
          ├── notification lifecycle        ├── coordination events
          ├── alert and center data         └── notification events
          ├── audit actions
          ▼
PostgreSQL/PostGIS in live mode
or deterministic demo state
          │
          ▼
LGU Command Center operational picture
```

### 3.2 Authentication and roles

The platform models the principal roles as **resident**, **dispatcher**, **responder**, and **admin**. The Command Center authenticates through the backend and stores the returned access token in browser storage for subsequent API requests. Role checks are applied to actions such as operational logging, resource position updates, group assignment, notification acknowledgement, notification retry, and outbound communications.[1] [2]

The demo login is intentionally a demonstration mechanism. It allows the user to select a role so the system can exercise the operational flow. Live deployments must replace demo credentials and secrets with configured authentication and operational identity controls.

## 4. Command Center features

The Command Center is organized into eight tabs. Each tab represents a distinct operational question, while the Overview tab provides the common operating picture.

| Tab | Primary question | Main capabilities |
| --- | --- | --- |
| Overview | What is the current situation? | Metric cards, incident objectives, operational task board, responder posture, GIS map, SOS queue, verified alerts, and evacuation capacity. |
| Live SOS | Which emergency requests need a decision now? | Severity and status-oriented triage queue, channel and location confidence, incident selection, valid state transitions, dispatch guardrails, and handover actions. |
| Verified Alerts | Which official warnings can be trusted and acted upon? | Feed-health cards, alert source and freshness information, severity/hazard filtering, verification actions, and public-bulletin queueing. |
| Risk Map | Where are hazards, people, resources, and safe movement options? | Hazard polygons, SOS locations, resource markers, evacuation centers, route layers, center/resource filters, available-only filtering, and safe-route optimization. |
| Evacuation Centers | Where can people move, and what capacity is available? | Center status, occupancy and capacity, amenities, readiness context, transport gaps, capacity verification, and resupply actions. |
| Resources | What supplies and operational assets are available? | Category filtering, available-versus-total counts, location and owner, readiness state, check/reserve/resupply actions, communications plans, and team posture. |
| Response Groups | Which unit is available and suitable for the assignment? | Roster search, availability and specialty filters, readiness scores, personnel counts, position freshness, equipment and constraints, assignment desk, and notification status. |
| Communications | What has been said, what needs acknowledgement, and what should be sent next? | Communication log, channel health, simulated audio dispatch feed, waveform controls, outbound composer, linked incident selection, recommendation engine, and assignment handoff. |

The visual system uses the disaster-resilience emblem as its identity source. Navy provides the stable command surface, teal signals verified or constructive action, coral is reserved for life-safety urgency, and slate or mist tones support calm scanning during high-pressure operations.

## 5. Resident mobile experience

The mobile experience is organized around the resident’s most important sequence: **Alert → Map → Evacuation → SOS**. The mobile design keeps essential information usable when connectivity is degraded instead of treating a network request as a prerequisite for every screen.

### 5.1 Mobile bootstrap

At launch, the mobile client hydrates its offline toolkit, last verified alerts, and evacuation snapshot. It registers connectivity and location-permission listeners, displays the cached state immediately, and then attempts a background refresh. The mobile API currently exposes a bootstrap synchronization endpoint, online SOS submission, SMS payload encoding and handoff, and safest-center route retrieval.[3]

The mobile local store keeps two durable categories of state:

| Durable state | Purpose |
| --- | --- |
| Cached snapshot | Retains verified alerts, evacuation centers, source information, cursor, and last synchronization time so the resident can see the last known trusted state during connectivity loss. |
| SOS outbox | Retains each emergency request with a local ID, nonce, location, accuracy, timestamp, delivery state, attempted transports, retry count, and eventual server SOS ID. |

The interface should display the source and retrieval timestamps of cached records. “Cached” is not the same as “current”; a resident or dispatcher must be able to see when information was last verified.[4]

### 5.2 Mobile screens and features

The resident flow includes a home screen with the latest verified alert, connection banner, SOS action, quick links, and sync status. The alert center provides filters and alert details. The risk map combines the resident location with flood, landslide, and storm-surge layers and evacuation markers. The evacuation screen provides center search, status, capacity, directions, and an offline-snapshot warning. The emergency toolkit keeps first-aid guidance, hotline information, and go-bag guidance available without requiring a live request.

The SOS action is deliberately designed as a hold-to-confirm interaction. This reduces accidental activation while giving the user an immediate local acknowledgement before the transport is finished. The user should see whether the report is queued, sent over the internet, handed to SMS, acknowledged by the server, or failed with recovery guidance.[4]

## 6. How the major workflows work

### 6.1 Alert and verification workflow

1. A configured source, such as an official hazard or weather feed, is polled or synchronized by the backend’s alert services.
2. The backend normalizes the record into a verified alert with source name, source event ID, title, body, severity, hazard, issue time, expiry time, and optional source URL.
3. Feed health tracks the last successful retrieval, last error, content hash, and stale state.
4. The Command Center displays only the operational alert information needed for scanning and provides explicit **Verify** and **Queue bulletin** actions.
5. The action is recorded with the actor, resource type, resource identifier, metadata, and timestamp.
6. The resident mobile client receives or refreshes the verified record and persists it before displaying the alert so it remains available after a crash or power interruption.

The result is a separation between “a source produced a record” and “the LGU has reviewed and is willing to operationalize that record.”

### 6.2 Evacuation and safe-route workflow

1. Evacuation centers are represented as points with name, barangay, status, total capacity, current occupancy, amenities, and coordinates.
2. Hazard areas are represented as polygons with hazard type, severity, status, verification time, and an operational action.
3. The GIS snapshot combines centers, SOS points, resource positions, and active hazard polygons in one geographic frame.
4. The resident or dispatcher supplies an origin location, and the route service selects or evaluates an evacuation center.
5. In live mode, the routing service uses spatial data to avoid active flood, storm-surge, landslide, and road-closure constraints. The response includes distance, estimated travel time, avoided-hazard count, blocked segments, route status, freshness, and warnings.[5]
6. The UI shows the route as a separate layer and keeps the warning that field conditions must be confirmed immediately before departure.

The route is therefore a decision aid, not a promise that the road remains passable. Freshness and field confirmation are explicit guardrails.

### 6.3 Online SOS workflow

1. The resident confirms an emergency type, optional short message, and location.
2. The mobile client writes a durable outbox record before transport selection.
3. If the API is reachable, the client submits an authenticated or device-associated SOS request containing emergency type, message, coordinates, accuracy, client timestamp, device identifier, and channel.
4. The backend validates the payload and creates or deduplicates the SOS record using an idempotency key derived from device and event data.
5. The backend publishes an `sos.received` event to the LGU realtime channel.
6. The Command Center refreshes or receives the incident, places it in the priority queue, and makes the allowed status transitions visible.

The intended SOS lifecycle is `received → acknowledged → dispatched → resolved`, with a controlled `false_alarm` outcome from the applicable states. The UI must not allow arbitrary jumps that bypass triage or dispatch accountability.[6]

### 6.4 SMS fallback workflow

When internet delivery is unavailable, the mobile client encodes a compact `CFR1` payload:

```text
CFR1;device;nonce;type;lat5;lon5;accuracy;unix_seconds;crc32
```

Latitude and longitude are scaled to five decimal places, encoded in base36, and protected by a CRC32 integrity check. The payload is bounded to one SMS segment. The CRC detects corruption; it is not authentication. The backend therefore requires gateway-level authentication or a provider signature before accepting an SMS report as a verified emergency request.[7]

The SMS route performs the following checks:

| Check | Purpose |
| --- | --- |
| Gateway signature | Establishes that the request came through an authenticated SMS gateway rather than a user-controlled header. |
| Payload shape | Confirms that the message follows the `CFR1` wire format. |
| CRC32 | Detects accidental or transport-level corruption. |
| Timestamp age | Rejects reports outside the accepted time window. |
| Dedupe key | Prevents duplicate records when a mobile client retries or both internet and SMS delivery occur. |
| Location and emergency fields | Supplies the incident data needed for triage and map placement. |

The resident sees “handed to SMS” rather than “LGU received” until a server acknowledgement exists. This distinction prevents the interface from overstating delivery confidence.[4]

### 6.5 SOS triage and dispatch workflow

1. The Command Center sorts the queue by severity, age, and triage state.
2. A dispatcher selects an incident and opens the triage drawer.
3. The drawer exposes emergency type, location, accuracy, channel, age, status, route guardrails, and available state transitions.
4. The dispatcher acknowledges or dispatches according to the operational situation.
5. The dispatcher can use the recommendation engine to rank response groups based on incident severity, emergency type, specialty match, proximity, location freshness, readiness, and constraints.
6. The dispatcher selects a group, target, and assignment note through the guarded assignment desk.
7. The backend checks availability, records the assignment, publishes a response-group event, creates notification records, and retains the actor and assignment context.

The recommendation engine is advisory rather than autonomous. It explains scores, matched and missing specialties, response estimate, freshness, reasons, and constraints so the dispatcher can accept, reject, or override the recommendation with an operational record.[1]

### 6.6 Response-group notification workflow

When a group is assigned, the backend creates notification records for configured channels such as SMS and in-app delivery. In demo mode, the notification service queues the records, waits for a configured simulation delay, and deterministically resolves the simulated SMS result. This provides repeatable testing without claiming that a provider delivered a real message.

In live mode, the service uses configured provider settings. A provider failure is converted into an auditable failed state rather than being hidden. The notification lifecycle includes the following states:

```text
queued → sending → delivered → acknowledged
                    └──────→ failed → retry → delivered or failed
```

Each notification can retain creation, sent, delivery, acknowledgement, attempt, error, assignment-note, recipient, and actor information. Retry is bounded by configuration. A responder or dispatcher acknowledgement is a separate operational event from technical delivery.[8]

### 6.7 Communications and recommendation workflow

The Communications tab combines a structured communication log with a simulated audio dispatch feed. Events carry direction, channel, sender, destination, message, priority, status, acknowledgement, linked incident, and operator. Audio items carry duration, transcript, channel, participants, priority, status, and waveform data.

The outbound composer can send a coordination event to a selected channel and unit, link it to an incident, set priority, and optionally create a simulated audio record. The interface clearly labels simulated audio and does not imply that a live radio or voice provider was contacted when the system is operating in demo mode.

The recommendation workspace accepts an incident and returns ranked response groups. Each result includes eligibility, score, distance, estimated response time, specialty match, missing specialties, position freshness, factors, reasons, and constraints. This makes the recommendation explainable and reviewable rather than a hidden black-box decision.

### 6.8 Resource and position verification workflow

GIS resources can represent teams, vehicles, boats, supplies, medical assets, and communications assets. Each resource has a position, reported time, accuracy, state, battery when applicable, current assignment, and source.

When a dispatcher selects a marker and chooses **Mark position checked**, the backend records the position update, publishes a GIS event, and creates an operations audit action. The UI reports position age and accuracy because a marker with no freshness or confidence is not sufficient evidence for a dispatch decision.

## 7. Auditability and operational accountability

Auditability is a platform behavior, not merely a database table. The system records actions that change the operational picture or create a consequential handoff, including:

| Action category | Examples |
| --- | --- |
| Incident handling | SOS acknowledgement, dispatch, resolution, false-alarm handling, and triage notes. |
| Public information | Feed review, alert verification, and bulletin queueing. |
| Evacuation operations | Capacity review, center verification, resupply, and readiness updates. |
| GIS operations | Resource position update, position check, route preview, and hazard review. |
| Dispatch | Response-group assignment, target, assignment note, and actor. |
| Notifications | Queue, delivery update, retry, failure, and acknowledgement. |
| Communications | Outbound communication, linked incident, channel, priority, and operator. |
| Resource accountability | Check, reserve, resupply, or other action recorded against a resource. |

The backend action contract includes an action name, resource type, optional resource ID, optional note, actor identity or role, metadata, and timestamp. In demo mode, the same events are stored in the demo audit stream so the operator can demonstrate the operational flow without a live database.[2]

Audit records support three practical questions after an incident:

1. **What happened?** The event and resource identify the operational change.
2. **Who acted?** The authenticated actor and role are retained.
3. **What evidence supported the action?** Notes, source freshness, location confidence, route warnings, assignment constraints, notification status, and acknowledgement state provide context.

## 8. Realtime behavior

The Command Center obtains a consistent initial snapshot through REST and then subscribes to focused WebSocket channels. The available channels are:

| Channel | Typical events |
| --- | --- |
| `/v1/ws/lgu` | New or updated SOS incidents. |
| `/v1/ws/gis` | Resource position updates and GIS state changes. |
| `/v1/ws/response-groups` | Assignment and response-group changes. |
| `/v1/ws/coordination` | New communication events. |
| `/v1/ws/notifications` | Notification queue, delivery, retry, and acknowledgement events. |

The client uses snapshot refresh as the recovery mechanism when an event is malformed or a realtime connection is interrupted. This is important operationally: a missed event should not permanently corrupt the Command Center’s state. The bootstrap race fix also ensures demo authentication completes before protected data requests and defers realtime subscriptions until the first operational snapshot is available.[1]

## 9. Demo mode and live mode

The system deliberately separates simulation from production integration.

| Concern | Demo mode | Live mode |
| --- | --- | --- |
| Data source | Deterministic in-memory demo state. | PostgreSQL/PostGIS and configured services. |
| Authentication | Demo login for dispatcher/responder/admin flow testing. | Configured identity and secret management. |
| GIS | Demo map snapshot and deterministic route result. | Spatial queries and route logic against live hazard, center, and resource data. |
| SMS delivery | Simulated delay and deterministic success/failure outcome. | Configured SMS provider, sender ID, credentials, and provider error handling. |
| Push or in-app delivery | In-app records can be demonstrated through the notification lifecycle. | Provider-backed delivery where configured, plus persisted records. |
| Communications audio | Clearly labeled simulation mode. | Must be connected to an approved operational communications integration before being treated as live. |
| Audit | In-memory audit stream with the same action vocabulary. | Durable audit records in the database. |

The configuration protects against accidental live startup with unsafe defaults. When demo mode is disabled, the backend requires a configured SMS gateway shared secret and authentication secret, rejects wildcard production CORS, and validates notification retry bounds.[9]

## 10. Operational roles

The platform supports a role-based operating model rather than a single undifferentiated user type.

| Role | Typical responsibilities |
| --- | --- |
| Resident | Read verified alerts, inspect evacuation options, use the offline toolkit, and submit or confirm an SOS. |
| Dispatcher | Triage incidents, verify alerts, assign groups, send communications, review notifications, and record operational actions. |
| Responder | Receive assignments, acknowledge notifications, provide field updates, and report resource position or status. |
| Admin | Manage configuration, provider boundaries, access policy, and system oversight. |
| LGU/DRRM leadership | Review the operating period, objectives, task board, readiness, resource posture, and audit trail. |

The system does not replace command judgment. It provides the shared facts, guardrails, recommendations, and records needed for humans to make faster and more defensible decisions.

## 11. Resilience and safety controls

The most important resilience controls are designed around failure rather than ideal connectivity.

| Control | Why it matters |
| --- | --- |
| Cached mobile snapshots | Residents can access the last verified alert and evacuation information during a connection outage. |
| Durable SOS outbox | An emergency report is not lost merely because the first transport attempt fails. |
| Idempotency and deduplication | Internet retries, SMS fallback, and duplicate taps do not automatically create multiple incident records. |
| Location accuracy and freshness | Dispatchers can see whether a marker is recent and precise enough to inform movement. |
| Route freshness status | A route older than the requested window is marked stale and requires recalculation. |
| Explicit provider boundaries | Demo SMS and simulated audio are labeled so operators do not confuse simulation with real delivery. |
| Bounded retries | Failed notification delivery does not create an uncontrolled retry loop. |
| Role checks | Consequential actions require an appropriate operational role. |
| Audit events | Every consequential handoff can be reconstructed with actor, action, resource, and time. |
| Reduced-motion loading behavior | The branded startup animation can respect accessibility preferences while still communicating initialization. |

## 12. Example operational scenario

Consider a household reporting rising water near a coastal road.

1. The resident opens the mobile app. The last verified alert and center snapshot render from local storage while connectivity is checked.
2. The resident holds the SOS control, selects a trapped-person emergency type, confirms the location, and submits.
3. If internet is available, the app posts the SOS. If not, it queues the record and hands a compressed, CRC-protected payload to SMS after user approval.
4. The backend validates and deduplicates the report, then publishes an SOS event.
5. The dispatcher sees the incident in the Live SOS queue with channel, age, location accuracy, and severity.
6. The GIS panel shows the SOS marker, active flood or storm-surge polygons, available centers, and response assets.
7. The dispatcher runs the recommendation engine. The system ranks groups based on specialty, readiness, proximity, freshness, and constraints, while exposing the reasons for the ranking.
8. The dispatcher assigns the best available group, records an assignment note, and sends notifications through the configured or simulated channels.
9. The responder acknowledges the assignment. The Command Center updates notification state and retains the acknowledgement time.
10. The dispatcher previews a safe route, confirms current field conditions, sends a coordination message, and records the action.
11. After the incident, leadership can review the SOS, alert, GIS, assignment, notification, communication, and audit records as one chain of operational evidence.

## 13. Current implementation and deployment status

The hosted Command Center is available through the Manus sandbox at:

> [https://3001-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer/](https://3001-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer/)

The verified hosted surface includes all eight Command Center tabs, demo authentication, operational snapshots, GIS layers and filters, route optimization, response-group assignment, simulated notification delivery and acknowledgement, communications, recommendation ranking, audit actions, and the emblem-derived loading transition. The FastAPI API is configured separately from the frontend and is intended to be placed behind a controlled public API origin in a production deployment.

The mobile layer contains the resident-facing API, storage, SOS encoding, and offline state-machine contracts described in this document. A production rollout should pair those contracts with the final Expo/React Native screens, device permission flows, platform SMS behavior, provider credentials, field acceptance testing, and a secure deployment configuration.

## 14. Recommended operational adoption sequence

The system should be adopted in stages. First, the LGU should agree on incident statuses, response-group availability definitions, alert verification responsibilities, evacuation-center ownership, and the meaning of each audit action. Second, the municipality should validate the center capacities, hazard polygons, resource locations, radio channels, notification recipients, and escalation procedures. Third, the team should run tabletop exercises in demo mode using realistic scenarios such as coastal flooding, trapped households, medical evacuation, and communications outage. Finally, live integrations should be enabled one at a time, with provider credentials, CORS origins, gateway authentication, monitoring, backups, and incident-response procedures verified before operational reliance.

## Conclusion

Code for Resilience works by turning scattered disaster signals into a sequence of accountable operational decisions. A resident can report an emergency through a resilient transport path. The backend validates, deduplicates, stores, and broadcasts the incident. The Command Center places it in a prioritized queue, combines it with hazards, centers, resources, and communications, recommends an appropriate response group, sends a traceable assignment, and records the result. At each point, the platform exposes freshness, confidence, constraints, and audit context so that the system supports—not replaces—local disaster-management judgment.

## References

[1]: ../frontend/lib/api.ts "Command Center frontend API contracts, endpoint helpers, and WebSocket subscriptions"

[2]: ../backend/app/api/routes.py "FastAPI operational routes, role checks, audit actions, dispatch, notifications, GIS, alerts, centers, and SOS"

[3]: ../mobile/src/api.ts "Resident mobile API, bootstrap synchronization, online SOS, SMS handoff, and safe-route client functions"

[4]: ../mobile/docs/offline-state-machine.md "Resident mobile offline-first state model, SOS outbox, synchronization policy, and user flow"

[5]: ../backend/app/services/routing.py "Backend spatial routing service for nearest safe evacuation-center selection"

[6]: ../backend/app/services/sos_state.py "Allowed SOS incident state transitions"

[7]: ../backend/app/services/sos_codec.py "CFR1 SMS payload encoding, base36 coordinates, CRC validation, and gateway-authentication boundary"

[8]: ../backend/app/services/notifications.py "Demo/live assignment notification delivery, provider boundary, retries, and realtime delivery events"

[9]: ../backend/app/core/config.py "Runtime safety validation, demo/live configuration, CORS, provider, authentication, and retry settings"

[10]: https://3001-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer/ "Hosted Code for Resilience Balangiga Command Center preview"
