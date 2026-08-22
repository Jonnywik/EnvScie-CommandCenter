# Code for Resilience — Mobile Flow and Offline State Machine

## Primary user flow

```text
<MobileApp>
├── BootstrapGate
│   ├── HydrateOfflineToolkit
│   ├── HydrateLastVerifiedAlerts
│   ├── HydrateEvacuationSnapshot
│   ├── RegisterConnectivityListener
│   └── RegisterLocationPermissionState
├── <HomeScreen>
│   ├── ConnectionBanner
│   ├── LastVerifiedAlertCard
│   ├── PrimarySOSButton
│   ├── QuickActions
│   │   ├── OpenRiskMapAction
│   │   ├── FindEvacuationCenterAction
│   │   ├── EmergencyHotlinesAction
│   │   └── OfflineToolkitAction
│   └── SyncStatusFooter
├── <AlertCenterScreen>
│   ├── AlertFilterChips
│   ├── VerifiedAlertList
│   │   └── VerifiedAlertCard
│   └── AlertDetailsSheet
├── <RiskMapScreen>
│   ├── MapCanvas
│   │   ├── UserLocationMarker
│   │   ├── FloodRiskLayer
│   │   ├── LandslideRiskLayer
│   │   ├── StormSurgeLayer
│   │   └── EvacuationCenterMarkers
│   ├── MapLegend
│   ├── SafeRouteCard
│   └── RecenterButton
├── <EvacuationScreen>
│   ├── CenterSearch
│   ├── CenterStatusCard
│   ├── CapacityMeter
│   ├── DirectionsButton
│   └── OfflineSnapshotWarning
├── <SOSFlow>
│   ├── SOSConfirmSheet
│   │   ├── EmergencyTypePicker
│   │   ├── OptionalShortMessage
│   │   ├── LocationAccuracyLabel
│   │   └── HoldToConfirmButton
│   ├── SOSSendingState
│   ├── SOSSubmittedState
│   ├── SMSFallbackState
│   └── SOSFailureRecoveryState
└── <ToolkitScreen>
    ├── FirstAidGuideList
    ├── FirstAidGuideDetail
    ├── HotlineDirectory
    ├── GoBagChecklist
    └── OfflineVersionLabel
```

The SOS control should be a deliberate hold-to-confirm action rather than a single tap. It should provide an immediate local acknowledgement before the network or SMS send completes. The resident must see whether the event is **queued**, **sent over the internet**, **handed to SMS**, or **not yet delivered**.

## State model

The mobile client should use a small event-driven store, such as Redux Toolkit, Zustand with Immer, or Riverpod if Flutter is selected. The important design property is not the library; it is that durable offline state is separated from ephemeral screen state and that every queued operation has an idempotency key.

```text
AppState
├── connectivity
│   ├── status: online | degraded | offline
│   ├── lastOnlineAt: ISO timestamp | null
│   └── transport: internet | sms | ble | none
├── verifiedAlerts
│   ├── entities: Alert[]
│   ├── lastSuccessfulSyncAt: ISO timestamp | null
│   ├── sourceFreshness: fresh | stale | unknown
│   └── syncState: idle | syncing | failed
├── evacuation
│   ├── centers: EvacuationCenter[]
│   ├── riskLayersVersion: string | null
│   ├── lastMapSyncAt: ISO timestamp | null
│   └── route: SafeRoute | null
├── sosOutbox
│   ├── items: SosOutboxItem[]
│   ├── activeItemId: string | null
│   └── lastDeliveryAttemptAt: ISO timestamp | null
├── location
│   ├── permission: unknown | denied | granted
│   ├── lastFix: { latitude, longitude, accuracy, capturedAt } | null
│   └── fixState: idle | acquiring | ready | failed
├── toolkit
│   ├── bundleVersion: string
│   ├── content: OfflineToolkit
│   └── integrity: verified | invalid | unknown
└── ui
    ├── currentScreen
    ├── selectedAlertId
    ├── selectedCenterId
    └── sosConfirmationOpen
```

## Durable SOS outbox item

```ts
export type SosTransport = "internet" | "sms" | "mesh" | "none";
export type SosDeliveryState =
  | "draft"
  | "queued"
  | "sending"
  | "sent"
  | "acknowledged"
  | "failed";

export interface SosOutboxItem {
  localId: string;                 // UUID generated before any network call
  nonce: string;                   // 6–8 chars included in SMS payload
  devicePublicId: string;
  emergencyType: string;
  shortMessage?: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  clientOccurredAt: string;
  createdAt: string;
  deliveryState: SosDeliveryState;
  attemptedTransports: SosTransport[];
  retryCount: number;
  lastErrorCode?: string;
  serverSosId?: string;
}
```

## Exact offline-first transitions

| Trigger | Guard | State transition | Side effect |
|---|---|---|---|
| App launch | Toolkit bundle hash is valid | `bootstrap → ready` | Hydrate local snapshots before network calls |
| App launch | Toolkit invalid/missing | `bootstrap → degraded` | Keep hotline/first-aid fallback bundled in the binary |
| Connectivity change | Network probe succeeds | `offline → online` | Refetch verified alerts, centers, and pending SOS status |
| Connectivity change | Network probe fails | `online → offline` | Stop nonessential requests; keep cached data visible |
| SOS hold complete | Location fix is available | `confirming → queued` | Write outbox item transactionally before transport selection |
| SOS hold complete | No location fix | `confirming → location_error` | Offer retry; do not send an unlocated SOS unless user explicitly confirms |
| Outbox worker | Online and API reachable | `queued → sending → sent` | POST idempotent SOS request with `localId`/nonce |
| Outbox worker | API timeout/5xx | `sending → queued` | Exponential retry with jitter; retain item |
| Outbox worker | Online but server rejects schema | `sending → failed` | Show actionable validation error; do not loop forever |
| Outbox worker | Offline | `queued → queued` | Schedule next connectivity-triggered attempt |
| SMS fallback | SMS capability and user approval | `queued → sending` | Encode CFR1 payload and open native SMS composer/gateway flow |
| SMS fallback | SMS handoff successful | `sending → sent` | Show “handed to SMS”; do not claim LGU receipt until acknowledged |
| SMS fallback | SMS unavailable | `sending → failed` | Show hotline and safe next steps from offline toolkit |
| Server acknowledgement | Matching nonce/localId | `sent → acknowledged` | Store server SOS ID and timestamp |
| User cancellation | Before transport handoff | `queued → cancelled` | Retain audit record locally; no network send |

## Sync policy

Use a read-through local cache. On launch, the home screen should render the last verified alert and offline toolkit immediately; network refresh is a background action. When a new alert arrives, persist it before presenting the push/banner so the user can still reopen it after a crash or power interruption. Cache headers should include `sourceName`, `issuedAt`, `expiresAt`, and `retrievedAt`; the interface must show those timestamps rather than simply saying “current.”

The outbox worker must be single-flight on each device. It should lock the row currently being sent, use a bounded retry schedule such as 0 s, 5 s, 30 s, 2 min, 10 min, and then require user attention, and stop retries for permanent errors. The API must treat the nonce/device pair as idempotent so duplicate internet and SMS deliveries create one incident record.
