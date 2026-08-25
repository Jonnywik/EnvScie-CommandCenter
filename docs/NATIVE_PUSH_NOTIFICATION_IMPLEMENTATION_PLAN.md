# Native iOS and Android Push-Notification Implementation Plan

## Purpose and current boundary

This plan describes how to move Code for Resilience from its current **in-app alert snapshot and offline SOS fallback** to a governed native notification capability for Android and iOS. It is deliberately designed for a disaster-management context: a technical provider receipt is not a field acknowledgement, a push message is not an evacuation order, and public warnings remain subject to explicit LGU authorization.

The current mobile app retrieves alert snapshots from `GET /v1/sync/bootstrap`, caches them locally, and can submit an SOS online or hand it to device SMS. It does not yet install a native notification package, request notification permission, register or retain a device token, receive background notifications, or receive alert fan-out from the backend.

## Architecture choice: decide before implementation

Two viable delivery models exist. The LGU should select one during the design-approval phase; the client registration, consent, data model, and delivery audit trail remain required in either model.

| Approach | How delivery works | Trade-offs | Cost | Setup complexity |
| --- | --- | --- | --- | --- |
| **Expo Push Service** | The app obtains an Expo push token. The backend submits bounded batches to Expo, which relays to FCM and APNs. | Fastest path for the current Expo application. It adds an Expo relay and requires ticket/receipt reconciliation. | Provider accounts and Apple membership still apply; service terms must be reviewed. | Lower. |
| **Direct FCM v1 + APNs** | The app obtains native device tokens. The backend sends directly to Firebase for Android and APNs for iOS. | More operational control and fewer relays, but requires separate provider credentials, HTTP/2/OAuth handling, delivery code, and lifecycle operations. | Provider/account costs and operational support apply. | Higher. |

For the initial controlled pilot, **Expo Push Service is the lower-risk implementation path** because the existing app uses Expo and its notification API is provider-agnostic. Direct FCM/APNs remains appropriate only if the LGU requires provider-specific capabilities or cannot accept the relay model. Expo documents that its client API can support either model, and that direct providers require native device tokens rather than Expo tokens. [1] [3]

## Phase 0 — Governance and notification policy

1. Appoint an LGU communications owner, privacy owner, mobile technical owner, and after-hours escalation contact. Create an approval matrix that separates information notices, verified hazard advisories, responder assignments, and public-warning authority.
2. Define the exact eligibility rule for a message. For example, only a dispatcher/admin-approved, source-verified alert may enter the public notification queue. Feed ingestion alone must never automatically notify residents.
3. Define user consent and preference categories: critical safety alerts, weather/hazard advisories, evacuation-center updates, and operational/responder assignments. Default all non-critical categories to opt-in. Do not use a technical delivery record as evidence that a resident read or followed a message.
4. Define data minimization and retention. Store only a pseudonymous device installation ID, token, platform, app version, consent state, preference set, last-seen timestamp, token status, and audit metadata. Do not place precise location, medical details, SOS contents, or personal data in notification payloads.
5. Approve message templates in English and the locally approved languages. Keep payloads concise; the app should fetch the authoritative alert detail after the user opens the message. Keep sensitive details inside authenticated in-app content rather than the lock-screen payload.

## Phase 1 — Provider and native-app prerequisites

### Android

1. Create or designate an LGU-controlled Firebase project. Enable FCM HTTP v1 and generate a service account with the minimum required role. Store its credential only in managed secret storage; never commit a JSON key or place it in the mobile bundle.
2. Obtain `google-services.json` from the same Firebase project and associate it with the Android app identifier. The server must use the matching Firebase project when it sends messages. Firebase’s HTTP v1 API supports device-targeted messages and short-lived OAuth authorization derived from a service account. [4]
3. Add `expo-notifications` and `expo-constants` with the Expo-compatible installer. Add the `expo-notifications` config plugin in `mobile/app.json`, configure an Android notification icon and color, and add the Android notification permission required by the selected Expo/Android SDK configuration. [1]
4. Create separate Android notification channels in code before requesting a token: `critical_safety`, `verified_advisory`, and `operations`. Define channel names, importance, sound/vibration behavior, and user-manageable descriptions. Never label an advisory as “critical” merely to bypass user preferences.

### iOS

1. Enroll the LGU-controlled Apple Developer account and register the production bundle identifier. Confirm that the correct team owns the app and that push-notification capability is enabled for the identifier.
2. Create an APNs authentication key (`.p8`), record its key ID and team ID in the secret inventory, and upload/configure the key through the selected delivery route. Expo’s setup documentation notes that a paid Apple Developer Account is required for credentials. [1]
3. Add the same `expo-notifications` config plugin. This gives the iOS app the APNs entitlement through Expo’s managed configuration. The direct-provider alternative instead requires the APNs entitlement to be configured explicitly. [3]
4. Request authorization only after an in-app explanation of value, categories, and emergency limits. Respect a denial without repeated blocking prompts; provide a settings route and retain the consent decision locally and server-side.
5. Plan development-build and TestFlight testing on registered physical devices. Confirm separate development and production credential handling before a production release.

## Phase 2 — Mobile client implementation

1. Add a dedicated `src/notifications.ts` module instead of placing provider logic in `App.tsx`. The module should configure the foreground handler, Android channels, permission state, token registration, response listeners, and safe error states.
2. On first app launch, show a consent screen with explicit categories. When the user chooses to continue, request native permission. If permission is denied, leave alert snapshot sync and SOS features available, show the current permission state, and provide a non-blocking “Open device settings” action.
3. Derive a stable, non-personal installation identifier and obtain the chosen token:
   - **Expo route:** `getExpoPushTokenAsync({ projectId })`.
   - **Direct route:** `getDevicePushTokenAsync()` and tag the token with platform/provider.
   Expo identifies the notification permission and app push token as client requirements; it also recommends supplying the project ID explicitly. [1]
4. Register or refresh the token with the backend after consent, on every app start, when the app resumes, and whenever the platform reports a token change. The registration request must include installation ID, token, platform, app version, permission state, preferences, locale, timezone, and an idempotency key.
5. Configure foreground presentation conservatively. In-app banner/list behavior may be used for critical and verified alerts; do not create a second noisy alert for a message already visible in the current alert screen.
6. Add listeners for notifications received in the foreground and notification responses from background/terminated launches. Deep-link only to a route such as `alert/{publicAlertId}`; fetch the current alert detail from the API and handle expired, withdrawn, or unauthorized items safely.
7. Add an on-device notification inbox backed by the normal alert API and local cache. It must distinguish **received on device**, **opened**, and **user acknowledgement in app**. None of these states should be equated to evacuation compliance or safety.
8. Preserve the existing offline behavior. Push should prompt a refresh when connectivity returns, but never replace the locally cached alert snapshot, SMS SOS fallback, or offline emergency toolkit.

## Phase 3 — Backend data model and API contract

1. Add a migration for `mobile_device_registrations`, `mobile_notification_preferences`, `mobile_notification_deliveries`, and `mobile_notification_receipts`. Use a unique active-device constraint such as `(installation_id, provider, token)` and retain token history/status without duplicating active endpoints.
2. Add authenticated, rate-limited APIs:
   - `POST /v1/mobile/devices/register`
   - `PATCH /v1/mobile/devices/{installation_id}/preferences`
   - `POST /v1/mobile/devices/{installation_id}/unsubscribe`
   - `POST /v1/mobile/notifications/{delivery_id}/opened`
   - `POST /v1/mobile/notifications/{delivery_id}/acknowledged`
   - `GET /v1/mobile/notifications/inbox`
3. Validate token shape, platform/provider combination, ownership or installation proof, consent category, payload size, permitted alert status, and idempotency key. Return no device token to administrative UI endpoints.
4. Add a notification policy service invoked only after an authorized alert state transition. It should select eligible recipients by explicit consent/preference, construct a minimal payload, persist a delivery row before sending, and publish an audit event.
5. Add a durable delivery worker or queue. The worker must batch messages, cap concurrency, apply exponential backoff only to transient failures, and maintain idempotent delivery keys. Do not run mass send/retry loops in a web request handler or an operator browser session.
6. For the Expo route, submit messages in provider-supported batches, persist push ticket IDs, retrieve receipts on a delayed bounded schedule, and deactivate tokens marked `DeviceNotRegistered`. Expo states that tickets only mean Expo accepted the payload and that receipts must be checked; a receipt still does not guarantee a user saw the alert. [2]
7. For direct FCM/APNs, isolate credentials behind provider adapters. Use short-lived OAuth/ADC or a managed service account for FCM; use APNs token authentication and HTTP/2 pooling for Apple. Firebase recommends server-side credentials and targeted registration-token sends through HTTP v1. [4]

## Phase 4 — Controlled delivery, retries, and safety semantics

1. Introduce a controlled “prepare notification batch” action showing recipient count, affected categories, message template, alert reference, operator identity, and a mandatory human confirmation. Public alert publication remains a separate, governed action.
2. Record status transitions as `prepared`, `queued`, `provider_accepted`, `provider_failed`, `device_unregistered`, `opened`, and `in_app_acknowledged`. Do not use `delivered` unless the provider’s own receipt semantics support that term, and do not use it as a human acknowledgement.
3. Retry only bounded transient provider failures. Dead-letter permanent failures, invalid credentials, malformed payloads, invalid tokens, and revoked permissions. Stop sending to invalidated tokens until a new registration is received.
4. Add rate limits by operator, alert, recipient cohort, and device. Add deduplication/collapse keys so a corrected advisory updates a previous alert instead of producing repeated lock-screen messages.
5. Keep emergency/SOS flows separate from outbound public alert delivery. SMS SOS handoff remains a resident-initiated fallback, not a substitute for confirmed inbound gateway receipt.

## Phase 5 — Test and release gates

| Gate | Required evidence | Pass condition |
| --- | --- | --- |
| Unit and contract tests | Registration validation, consent filtering, preference updates, payload policy, retry classification, and token invalidation tests. | All tests pass without real provider calls. |
| Provider sandbox | Android FCM and iOS APNs/Expo sandbox credentials. | A named test device receives a non-emergency test message and the audit record reconciles the provider result. |
| Device matrix | Current Android physical device, Android emulator with required services where applicable, iPhone development build, and TestFlight build. | Permission grant/deny, foreground, background, terminated launch, token refresh, and deep link all behave correctly. |
| Offline drill | Network loss before/after alert arrival, cached snapshot, restart, and SMS SOS fallback. | Offline tools and SOS fallback remain available; no unsafe stale-state claim is shown. |
| Failure drill | Invalid token, revoked permission, provider 429/5xx, malformed payload, unavailable network. | Bounded retry, clear audit status, no retry storm, and no false delivery/acknowledgement claim. |
| Privacy and governance | Consent text, retention, operator authority, provider agreement, incident escalation, and LGU approval. | Written approval is recorded before production activation. |

## Proposed implementation order

1. Approve delivery model, governance policy, consent copy, and owners.
2. Create Firebase and Apple credentials in LGU-controlled accounts; register sandbox devices.
3. Add the native mobile notification package, app configuration, permission UX, channel setup, token module, listeners, and inbox/deep-link behavior.
4. Add database migrations, registration/preferences APIs, notification policy service, queue/worker, provider adapter, and audit model.
5. Add automated client/backend tests, then execute sandbox delivery, receipt reconciliation, invalid-token, and offline drills.
6. Run a supervised pilot with a limited consented device group, complete an after-action review, and only then seek authorization to expand production delivery.

## Definition of “fully integrated”

The system should be called fully integrated only after both platforms have enrolled consented devices, registered current tokens, delivered sandbox-tested messages through the selected provider, reconciled tickets/receipts, handled token revocation and background notification responses, completed the offline/SMS drill, and passed LGU governance, privacy, and operational approval. Until then, it remains a staged integration rather than a live public-alert service.

## References

[1]: https://docs.expo.dev/push-notifications/push-notifications-setup/ "Expo push notifications setup"
[2]: https://docs.expo.dev/push-notifications/sending-notifications/ "Send notifications with the Expo Push Service"
[3]: https://docs.expo.dev/push-notifications/sending-notifications-custom/ "Send notifications with FCM and APNs"
[4]: https://firebase.google.com/docs/cloud-messaging/send/v1-api "Firebase Cloud Messaging HTTP v1 API"
[5]: https://firebase.google.com/docs/cloud-messaging/ios/get-started "Firebase Cloud Messaging for Apple platforms"
