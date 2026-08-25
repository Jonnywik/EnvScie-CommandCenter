# Mobile Alert-System Integration Status

## Verified application boundary

The mobile application can retrieve a verified-alert and evacuation-center snapshot from `GET /v1/sync/bootstrap`, render the resulting alerts, and persist the last successful snapshot locally through AsyncStorage. It also supports an outbound SOS outbox: when online, it submits queued SOS records to the API; when offline or when the user chooses the fallback, it composes a compact SMS payload and invokes the device SMS handoff.

This is a functional **in-app alert synchronization and offline SOS fallback** boundary. It is not a completed native public-alert delivery system.

## Unintegrated production alert-delivery components

The mobile package does not include `expo-notifications` or another native push client. The native application configuration does not declare notification permissions, notification plugins, push-token registration, device-token storage, background notification handling, alert receipt processing, or a notification inbox. The backend bootstrap route is snapshot/poll based and does not enroll mobile devices or fan out public alerts to them.

The backend does contain a separate responder-assignment notification service that records SMS, push, and in-app channels. In demo mode it simulates delivery; in live mode unconfigured SMS and push provider URLs fail safely. That service does not establish a native citizen-mobile alert enrollment or delivery pipeline.

## Validation performed

Mobile TypeScript validation passed. Backend alert synchronization, completion-audit, and configuration-safety tests passed (`9 passed`). Those tests verify alert ingestion/bootstrap and controlled notification contracts, but they do not prove real provider delivery, device enrollment, background receipt, or field-device behavior.

## Production prerequisites

Before describing mobile alerts as fully integrated, the project requires an authorized SMS/push provider, sender and device enrollment, consent and recipient validation, provider sandbox delivery and retry drills, mobile push-token registration, Android/iOS permission configuration, background/terminated-state receipt handling, and an offline mobile/SMS field exercise. Current deployment documentation continues to classify the environment as demo/training until these requirements are approved and evidenced.
