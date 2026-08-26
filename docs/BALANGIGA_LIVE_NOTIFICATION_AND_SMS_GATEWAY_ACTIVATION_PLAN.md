# Balangiga Live APNs, FCM, and SMS Gateway Activation Plan

**Purpose.** This is a production-oriented, no-send technical plan for activating native push notifications and a verified inbound SMS gateway for Code for Resilience. It preserves the current FastAPI safety boundaries, resident offline SOS/SMS handoff, LGU approval authority, privacy controls, and audit design.

**Current baseline.** The mobile app currently supports snapshot/alert synchronization, cached information, online SOS submission, a persistent SOS outbox, and a native SMS handoff. It does **not** yet have a live APNs/FCM credential configuration, resident push-token enrollment, provider receipt workflow, or approved live SMS gateway. This plan does not activate providers, create credentials, send notifications, or change production settings.

> **Critical distinction:** A push ticket means a provider intermediary accepted a request. A push-provider receipt means APNs or FCM accepted a payload. An SMS gateway callback means the gateway processed an event. None proves device display, human reading, public-warning approval, field acknowledgement, responder arrival, or rescue completion.[1] [2]

---

## 1. Architecture Decision: Two Viable Push Routes

The LGU must choose the sending route before implementation begins. The mobile client can still use `expo-notifications` under either route.

| Approach | How it works | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|---|
| **A. Expo Push Service** | The app enrolls an `ExpoPushToken`; the FastAPI backend submits approved messages to Expo, which relays them to FCM and APNs. | Fastest cross-platform rollout and simplified server delivery. It adds Expo as an intermediary and still requires FCM/APNs credentials. Provider receipts must be checked. | Expo service itself has no per-message SLA guarantee; Apple/Google developer/provider accounts still apply. | Lower. Recommended for a supervised Balangiga pilot. |
| **B. Direct FCM HTTP v1 + APNs HTTP/2** | The app enrolls native device tokens; FastAPI sends directly to Google FCM and Apple APNs. | More provider-level control and direct payload features; requires two server adapters, OAuth/APNs JWT handling, more error logic, and operational support. | Apple Developer and Google/Firebase requirements apply; additional engineering/operations effort. | Higher. Use when LGU policy, regulator, or technical requirements justify direct control. |

### Recommended staging decision

Start with **Approach A: Expo Push Service**, implemented behind a **provider-neutral backend adapter**. This keeps the first pilot cross-platform and operationally simpler while preserving a future move to direct FCM/APNs without redesigning resident consent, device enrollment, LGU approvals, campaign/outbox records, audit logging, or receipt interpretation.

Do not choose a route only because it is technically available. The release decision must include LGU policy, budget, staffing, provider terms, Apple/Google account ownership, incident support, privacy review, and evidence from device drills.

---

## 2. Non-Negotiable Design Rules

| Rule | Implementation consequence |
|---|---|
| LGU authorization comes before transport | A notification cannot enter a provider queue unless it references an approved alert/campaign version and authorized approver. |
| Resident consent and control | Permission is requested in context, declined permission remains usable, and opt-out/token retirement works. |
| Technical and operational states remain separate | `queued`, `ticketed`, `provider_accepted`, `failed`, and `token_retired` never become `acknowledged`, `dispatched`, or `resolved`. |
| No personal SOS data in push payloads | Use a minimal alert/record identifier and deep-link target; fetch protected content only after the app opens and authenticates as appropriate. |
| No live gateway activation during development | Use sandbox/development environments and no-send tests until function-specific LGU release approval. |
| Provider credentials are secrets | Store only through the approved secret manager; never commit, paste into documentation, mobile bundles, browser code, or screenshots. |
| Fallback remains explicit | Native push failure does not silently trigger SMS; SMS and public-warning action each follow their own approved rules. |

---

## 3. Target Technical Architecture

```text
Approved LGU alert / authorized case state
              │
              ▼
FastAPI notification outbox (idempotent + auditable)
              │
              ├── Push adapter ──► Expo Push Service ──► FCM / APNs ──► device
              │        │                  │
              │        ▼                  ▼
              │    ticket stored      receipt worker → provider state only
              │
              └── SMS adapter ──► approved gateway ──► mobile network
                       ▲                 │
                       │                 └── signed inbound/status webhook → FastAPI
                       └── SMS handoff record / verified receipt only

Resident mobile app
  ├── user consent and channel preference
  ├── stable pseudonymous installation ID
  ├── Expo or native device token enrollment
  ├── local alert inbox + deep-link handler
  ├── cached snapshot and SOS outbox
  └── explicit SMS handoff when data path fails
```

### Required data entities

| Entity | Minimum fields | Safety purpose |
|---|---|---|
| `device_installation` | pseudonymous installation ID, platform, app version, consent status, lifecycle timestamps | Avoids shared/default device identity and supports revocation. |
| `push_token` | installation ID, provider route, token ciphertext or protected reference, token hash, state, last-seen time | Supports token rotation/retirement without exposing raw tokens in logs. |
| `notification_campaign` | source alert ID, approved version, audience rule, approver, scope, scheduled/issued time, status | Ensures an authorized alert—not an ad-hoc technical event—drives delivery. |
| `notification_delivery` | campaign ID, token reference, provider, idempotency key, ticket ID, receipt state, failure code, timestamps | Separates message transport facts from field/response outcomes. |
| `sms_gateway_event` | provider event ID, signature validation result, message/callback type, normalized state, dedupe key, raw payload reference with retention control | Prevents unsigned/replayed callbacks from changing SOS workflow. |
| `consent_preference` | notification purpose, consent/decline time, channel preferences, revocation time, policy version | Makes permission and preference auditable. |

---

## 4. Phase 0 — Governance, Account Ownership, and No-Send Readiness

### 4.1 Name accountable owners

| Asset or decision | Required owner | Backup / review |
|---|---|---|
| Apple Developer organization/account | LGU-designated legal/technical owner | Executive sponsor + documented recovery contact |
| Firebase project and billing/security administration | LGU-designated technical owner | Technical custodian + privacy focal person |
| Expo/EAS organization and project ownership | LGU-designated technical owner | System owner + recovery contact |
| Push/SMS credential secrets | Technical custodian through approved secret manager | Privacy focal person verifies access register |
| Alert template and campaign release | Public-information authority | Authorized alternate |
| Dispatch/safety messaging | MDRRMO/dispatch authority | Authorized alternate |
| Provider contract and cost approval | LGU procurement/budget authority | Executive sponsor |

### 4.2 Complete pre-configuration checklist

1. Approve the alert-publication and dispatch SOPs before connecting a live transport.
2. Confirm the selected build identity: iOS bundle identifier, Android application ID, Expo/EAS project ID, and production versus development environments.
3. Define notification taxonomy: `public_warning`, `preparedness_advisory`, `center_update`, `resident_sos_status`, `responder_assignment`, and `system_test`. Each taxonomy entry must define owner, audience, payload limit, TTL, collapse behavior, consent rule, and prohibited claims.
4. Define message content rules: no resident health/location data in payload; no “help is on the way” language without authorized operational confirmation; no critical-alert entitlement claim unless Apple approves it.
5. Define a retention schedule for token records, delivery records, provider events, and audit logs.
6. Create a non-production environment with development credentials and labelled test devices. Production credentials remain disabled until the release gate.
7. Prepare a rollback plan: disable campaign creation, revoke provider route, retire tokens, and display in-app status without attempting unapproved transport fallback.

---

## 5. Phase 1 — Mobile Client Implementation Plan

### 5.1 Add native notification dependencies and config

For the existing Expo SDK 52 mobile app, add and version-match `expo-notifications` and `expo-constants`. Add the `expo-notifications` config plugin to `app.json`/app configuration. Expo documents these as client requirements for permission, project identification, token acquisition, and notification handling.[1]

| Platform | Required configuration | Test boundary |
|---|---|---|
| Android | Android notification channel, FCM v1 project configuration, `google-services.json`/build configuration as applicable, permission behavior, default icon/color where required. | Development build or physical device; do not treat Expo Go as the production proof path. |
| iOS | Push Notifications capability/APNs entitlement, bundle identifier, Apple developer credentials, physical registered test device, entitlement validation. | Development build on registered physical device; no critical-alert entitlement unless separately approved by Apple. |
| Both | In-app permission explanation, deny/allow/retry states, token enrollment, token refresh, receipt/deep-link handler, local inbox/cache, and logout/revocation cleanup. | Automated type/unit checks plus supervised physical-device test matrix. |

### 5.2 Consent and enrollment flow

1. On first relevant use, explain the purpose in plain language: verified LGU safety updates and resident-safe SOS workflow updates, not guaranteed response.
2. Request native permission only after context; respect denial without blocking SOS, snapshot caching, or SMS handoff.
3. Create/read a stable pseudonymous installation ID from secure persistent local storage.
4. Retrieve a token:
   - **Expo route:** `getExpoPushTokenAsync({ projectId })`.
   - **Direct route:** `getDevicePushTokenAsync()`.
5. Post the enrollment to a protected backend endpoint with installation ID, platform, application version, token type, consent state, and client timestamp.
6. Treat enrollment as idempotent. Token rotation or reinstall must update the same installation lifecycle safely.
7. Offer an in-app switch for optional categories where policy allows; essential emergency messaging policy must be reviewed by LGU legal/privacy authorities.
8. On permission revocation, logout, uninstall indication, or `DeviceNotRegistered`, mark the token inactive and stop delivery attempts.

### 5.3 Client receipt and navigation behavior

| App state | Expected behavior | Prohibited behavior |
|---|---|---|
| Foreground | Display a controlled in-app banner/inbox update; do not interrupt an active SOS form without user action. | Auto-marking a public alert as read/acknowledged. |
| Background | Native banner behavior follows user permission and channel settings. | Putting sensitive SOS details in lock-screen text. |
| Terminated | Open the specific safe screen through a deep link after user taps. | Treating notification transport as proof the user opened it. |
| Offline after tap | Show cached safe information and explain freshness/limits. | Claiming live incident status without refresh. |

### 5.4 Mobile acceptance tests

The test matrix must cover permission granted/denied, Android channel behavior, iOS APNs entitlement, token registration/rotation, foreground/background/terminated receipt, deep links, opt-out, reinstallation, offline cache, and SMS handoff. Tests must use approved test devices and synthetic/training alerts until release approval.

---

## 6. Phase 2 — Backend and Data-Model Implementation Plan

### 6.1 Build provider-neutral interfaces

Create interfaces such as `PushProvider.send_batch()`, `PushProvider.fetch_receipts()`, `SmsProvider.send()` where authorized, and `SmsGatewayVerifier.verify_inbound_callback()`. The Command Center and alert business logic must call these interfaces, not provider-specific API code directly.

### 6.2 Outbox and idempotency pattern

1. An authorized LGU alert version creates a `notification_campaign` record.
2. The audience query selects consented, active tokens using recipient criteria approved in the campaign.
3. For each token/channel, create one `notification_delivery` with an idempotency key derived from campaign version + installation + channel.
4. A delivery worker reads pending rows in bounded batches.
5. The worker submits only approved content to the configured adapter; it stores the ticket/provider ID and submission timestamp.
6. A receipt worker reads due ticket IDs after the defined delay. Expo recommends checking roughly 15 minutes after send; tickets/receipts must be retained long enough for that workflow.[2]
7. Receipt errors move a delivery to a retryable/permanent-error state. `DeviceNotRegistered` disables the matching token until the client re-enrolls.[2]
8. Dashboard status labels must read **queued**, **provider accepted**, **provider failed**, or **token retired**—never “resident notified” or “responder acknowledged” unless separate evidence exists.

### 6.3 Rate limits and retries

| Control | Initial rule |
|---|---|
| Expo send batch | At most 100 messages per Expo request.[2] |
| Expo receipt retrieval | At most 1,000 ticket IDs per receipt request.[2] |
| Retryable failures | Exponential backoff with jitter for transport errors, HTTP 429, and 5xx responses. |
| Permanent failures | Do not retry malformed payloads, invalid credentials, or a retired/unregistered token until the underlying condition is corrected. |
| Campaign dedupe | One logical delivery per campaign version, channel, and active installation unless a documented retry is required. |
| Kill switch | Configuration flag that stops new sends while preserving audit data. |

### 6.4 Payload taxonomy

| Message type | Payload data | Delivery priority/TTL plan | User-facing boundary |
|---|---|---|---|
| Verified public warning | alert ID, version, route/deep-link type, non-sensitive category | High only when approved and proportionate; short TTL; collapse by alert ID/version. | “Check the official LGU update.” No claim of rescue/safety. |
| Preparedness advisory | alert ID, version, category | Normal; medium TTL; collapse by advisory type. | Plain preparation guidance. |
| Center update | center ID/version, route | Normal; replace stale update. | Verified center information only. |
| Resident SOS status | pseudonymous case route/reference; no sensitive details | High only for an authorized status change; short TTL. | “Received” / “acknowledged” / “coordination in progress,” as defined in SOP. |
| Responder assignment | incident/unit reference only | Separate controlled channel and authorization. | Must not expose resident details beyond unit need. |
| System test | test campaign ID | Development/test environment only. | Clearly labelled test. |

---

## 7. Phase 3 — Provider Configuration

### 7.1 APNs configuration

| Step | Action | Owner | Evidence |
|---|---|---|---|
| A1 | Confirm LGU-controlled Apple Developer organization account and bundle ID ownership. | Executive sponsor + technical custodian | Account/role register. |
| A2 | Enable Push Notifications capability and ensure `expo-notifications` plugin or APNs entitlement is applied. Expo notes APNs entitlement is required for iOS delivery.[3] | Technical custodian | Build configuration and signed entitlement check. |
| A3 | Create/obtain APNs `.p8` key only under approved access policy; record key ID and Apple Team ID. | Technical custodian | Secret-manager reference; never raw key in repo. |
| A4 | Choose development vs production environment explicitly; validate correct bundle topic. | Technical custodian | Environment checklist. |
| A5 | If direct APNs route is selected, implement JWT authorization and HTTP/2 provider client with connection/error handling. | Backend owner | Integration tests against sandbox only. |
| A6 | Install a development build on registered physical iOS devices and test permission/token/deep link behavior. | Mobile test lead | Signed test record. |
| A7 | Conduct a supervised production-like drill before public release. | System owner | After-action report and go/no-go signature. |

Apple’s token-based APNs path uses an APNs signing key, key ID, team ID, and APNs HTTP/2 endpoints; direct-mode design must maintain those credentials only server-side.[3]

### 7.2 FCM HTTP v1 configuration

| Step | Action | Owner | Evidence |
|---|---|---|---|
| F1 | Create or identify an LGU-owned Firebase project tied to the Android application ID. | Technical custodian | Project ownership and recovery register. |
| F2 | Enable FCM HTTP v1 and configure Android credentials/build files correctly. | Technical custodian | Build/configuration checklist. |
| F3 | Use a least-privilege service account; prefer managed/short-lived credentials where deployment supports them. | Technical custodian + privacy focal person | IAM review and secret reference. |
| F4 | If running outside Google infrastructure, store the service-account material only in the approved server secret manager; never in source control. | Backend owner | Secret audit. |
| F5 | For direct FCM, obtain OAuth 2.0 access token using supported authentication and send to the v1 endpoint for the project. | Backend owner | Sandbox integration test. |
| F6 | Validate Android channel, background behavior, token rotation, deep link, and notification permission on physical Android devices. | Mobile test lead | Device-test matrix. |

Firebase documents Application Default Credentials or service-account-based short-lived OAuth authorization for HTTP v1 requests. Non-Google server deployments require careful service-account key protection.[4]

### 7.3 SMS gateway selection and configuration

The LGU should not select an SMS vendor based only on price or send-API availability. The chosen provider must pass a documented acceptance review.

| Acceptance criterion | Minimum requirement |
|---|---|
| Philippine service feasibility | Demonstrated ability to deliver to the LGU’s intended Philippine mobile routes, with clear sender-ID/number constraints. |
| Inbound SMS support | Supports inbound messages/long code/short code or other lawful incoming-message workflow needed for the SMS fallback receipt path. |
| Webhook security | HTTPS endpoint plus verifiable request signature or equivalent authenticated callback. Unsigned callbacks are rejected. |
| Status callbacks | Provides documented outbound status callbacks; status is stored as transport information only. |
| Replay/deduplication | Provider message ID or stable event identifier enables idempotent handling. |
| Data protection | Contract covers data processing, hosting/transfer, retention, incident notification, and authorized access. |
| Operational continuity | Documents support route, outage status, rate limits, sender registration, and disaster-period support. |
| Cost clarity | Separates recurring number/sender, outbound, inbound, callback, and support charges. |
| Exit portability | Provides logs/exports and does not prevent the LGU from changing provider. |

**SMS vendor options to evaluate.**

| Option | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|
| International programmable messaging provider with signed webhooks, such as Twilio | Mature API, inbound callback and status capabilities; Philippine route/sender ID, pricing, contract, and data-processing suitability must be validated. | Usage-based; obtain formal quote. | Medium. |
| Philippines-focused aggregator or telecom-approved gateway | Potentially stronger local routing/sender registration fit; webhook/signature, inbound capability, data terms, and disaster support vary by vendor and must be verified in procurement. | Vendor-specific; obtain competitive quotes. | Medium–high due to local onboarding and verification. |

Twilio is a verified example of a provider that documents signed inbound webhook requests, HTTPS/TLS, and SDK-based signature validation. This is an acceptance pattern, not a recommendation or completed supplier selection.[5]

### 7.4 SMS callback implementation sequence

1. Provision a dedicated non-production inbound route and HTTPS callback endpoint.
2. Store the provider signing secret only in the server secret manager.
3. Validate the signature **before** parsing or persisting a callback as an LGU event.
4. Check provider event/message ID, device/nonce correlation, timestamp window, and replay/deduplication key.
5. Normalize the event to `handoff_received`, `gateway_received`, `transport_status`, `invalid_signature`, `duplicate`, or `failed`.
6. Allow only a verified inbound receipt to create/update the SMS-channel record. It must not create a public alert, dispatch, or field-status update.
7. Log validation result, provider ID, timestamp, and normalized state; protect raw payload storage and retention.
8. Test invalid signature, expired/replayed callback, duplicate callback, malformed payload, provider retry, and endpoint outage.

---

## 8. Phase 4 — No-Send Test Program and Release Gates

### 8.1 Test tiers

| Tier | Environment | Allowed activity | Prohibited activity |
|---|---|---|---|
| T0: Static and unit test | Local/CI | Schema, payload, adapter, signature, dedupe, and status tests. | Real provider call or production credential. |
| T1: Sandbox/config test | Development credentials/dev project | Token registration and provider sandbox validation on named test devices. | Public audience, live case data, or resident campaign. |
| T2: Supervised device drill | Physical iOS/Android test devices | End-to-end approved test campaign, receipt processing, deep link, opt-out, fault injection. | Public warning or uninformed resident send. |
| T3: Limited live-readiness pilot | LGU-approved small invited cohort | Function-specific, consented, clearly scoped test message under monitoring. | Emergency-wide broadcast, automatic escalation, or unapproved SMS fallback. |
| T4: Operational activation | Approved production environment | Only the function that passed its release gate. | Combining unapproved functions or treating technical receipt as field outcome. |

### 8.2 Function-specific release checklist

| Release question | Push | SMS gateway |
|---|---|---|
| LGU authority and SOP approved? | [ ] | [ ] |
| Privacy/consent process reviewed? | [ ] | [ ] |
| Production account is LGU-owned with recovery plan? | [ ] | [ ] |
| Credential stored as a server secret and access logged? | [ ] | [ ] |
| Test devices/cases completed without critical defect? | [ ] | [ ] |
| Transport receipt/callback is stored separately from operational status? | [ ] | [ ] |
| Token/callback retirement, retries, and dedupe tested? | [ ] | [ ] |
| Monitoring and kill switch tested? | [ ] | [ ] |
| After-action review accepted? | [ ] | [ ] |
| Named on-call owner and escalation route available? | [ ] | [ ] |
| Function-specific approval signed? | [ ] | [ ] |

### 8.3 Rollback triggers

Immediately pause a provider route if any of the following occurs: credential exposure; unauthorized campaign; inability to verify SMS callbacks; unbounded duplicate sends; material privacy incident; provider receipt backlog that obscures delivery state; misleading resident wording; unavailable duty ownership; or a failed supervised drill without an agreed interim control.

---

## 9. Monitoring, Metrics, and Honest Status Reporting

| Metric | What it measures | What it does not measure |
|---|---|---|
| Consent rate | Number of eligible installations permitting a category. | Community preparedness or warning comprehension. |
| Active token count | Technically enrolled endpoints. | Residents who will see/read messages. |
| Ticket acceptance rate | Provider intermediary acceptance. | Device delivery or human acknowledgement. |
| Provider receipt success rate | APNs/FCM/provider acceptance. | Device display, reading, evacuation, or response outcome. |
| `DeviceNotRegistered` rate | Token lifecycle hygiene. | Whether a resident needs help. |
| Callback signature failure count | Security rejection signal. | SMS network coverage. |
| Duplicate suppression count | Idempotency effectiveness. | Incident validity. |
| Alert approval time | Workflow speed from verified draft to authorized publication. | Quality of the source or field outcome. |
| Drill completion and corrective-action closure | Readiness process quality. | Guaranteed real-incident performance. |

---

## 10. Implementation Sequence and Estimated Decision Gates

| Sequence | Work product | Decision gate |
|---|---|---|
| 1 | Legal/SOP adoption and notification taxonomy | Charter/SOP authority approved. |
| 2 | LGU account ownership and secret-management register | Named owners and recovery path confirmed. |
| 3 | Mobile notification module, consent, enrollment, local inbox | Type/unit tests and accessibility review passed. |
| 4 | Backend device/token, campaign/outbox, receipt, and audit models | Migration/code review and no-send regression tests passed. |
| 5 | Push route configured in sandbox; FCM/APNs credentials validated | Physical device drill passed. |
| 6 | SMS provider procurement/selection and signed webhook adapter | Invalid/replay/duplicate callback tests passed. |
| 7 | LGU-only supervised drill | After-action issues owned; no critical safety/privacy defect. |
| 8 | Partner/resident limited pilot only if approved | Function-specific release gate signed. |
| 9 | Production rollout in reversible increments | Monitoring, duty roster, kill switch, and review cadence active. |

## References

[1] Expo. *Expo push notifications setup.* https://docs.expo.dev/push-notifications/push-notifications-setup/

[2] Expo. *Send notifications with the Expo Push Service.* https://docs.expo.dev/push-notifications/sending-notifications/

[3] Expo. *Send notifications with FCM and APNs.* https://docs.expo.dev/push-notifications/sending-notifications-custom/

[4] Firebase. *Send a message using FCM HTTP v1 API.* https://firebase.google.com/docs/cloud-messaging/send/v1-api

[5] Twilio. *Secure webhooks.* https://www.twilio.com/docs/usage/webhooks/webhooks-security
