# Code for Resilience — LGU Dashboard Component Tree

## Product shell

```text
<AppRoot>
└── AuthProvider
    └── QueryProvider
        └── RealtimeProvider
            └── NotificationAnnouncer
                └── CommandCenterLayout
                    ├── SkipToContent
                    ├── HeaderBar
                    │   ├── MunicipalityBrand
                    │   ├── ConnectionHealthBadge
                    │   ├── VerifiedFeedTimestamp
                    │   ├── ActiveResponderCount
                    │   └── UserMenu
                    ├── LeftNavigation
                    │   ├── OverviewNavItem
                    │   ├── LiveSOSNavItem
                    │   ├── AlertsNavItem
                    │   ├── MapNavItem
                    │   ├── EvacuationCentersNavItem
                    │   ├── ResourcesNavItem
                    │   └── AuditLogNavItem
                    └── MainContent
                        └── DashboardRoute
```

The command center should remain usable on an unreliable connection. Every panel displays the freshness of its data and its source. “Live” means the browser has a healthy socket; “cached” means the panel is showing a last-known-good snapshot; “stale” means the snapshot has crossed its operational freshness threshold and must not be presented as current.

## Overview route

```text
<DashboardRoute>
├── SituationSummaryStrip
│   ├── ActiveCriticalAlertCard
│   ├── UntriagedSOSCard
│   ├── OpenCentersCard
│   ├── ResidentsAtRiskCard
│   └── LastVerifiedSyncCard
├── PrioritySOSQueue
│   ├── QueueToolbar
│   │   ├── SeverityFilter
│   │   ├── TypeFilter
│   │   ├── BarangayFilter
│   │   ├── StatusFilter
│   │   └── AcknowledgeAllVisibleButton
│   ├── SOSQueueTable
│   │   └── SOSQueueRow
│   │       ├── SeverityBadge
│   │       ├── ReceivedAge
│   │       ├── EmergencyType
│   │       ├── LocationConfidence
│   │       ├── ChannelBadge
│   │       ├── AssignedResponder
│   │       └── TriageActions
│   └── QueueEmptyState
├── LiveSituationMap
│   ├── MapToolbar
│   │   ├── HazardLayerToggle
│   │   ├── SOSLayerToggle
│   │   ├── EvacuationLayerToggle
│   │   └── FitToActiveEventsButton
│   ├── FloodPolygonLayer
│   ├── LandslidePolygonLayer
│   ├── StormSurgeLayer
│   ├── EvacuationCenterLayer
│   ├── SOSClusterLayer
│   ├── SelectedEventCallout
│   └── MapLegend
└── VerifiedAlertFeed
    ├── AlertSourceBadge
    ├── AlertFreshnessLabel
    ├── AlertSeverityBadge
    ├── AffectedAreaChip
    └── AlertDetailsDrawer
```

## SOS details and dispatch workflow

```text
<SOSDetailsDrawer>
├── SOSIdentityHeader
│   ├── SOSReference
│   ├── SeverityBadge
│   ├── ChannelBadge
│   └── ReceivedTimestamp
├── PersonAndDevicePanel
│   ├── CallerIdentityOrUnknown
│   ├── SenderPhoneMasked
│   ├── DeviceLastSeen
│   └── LocationAccuracy
├── LocationPanel
│   ├── Coordinates
│   ├── BarangayResolver
│   ├── NearestSafeCenter
│   └── SafeRoutePreview
├── TriageForm
│   ├── ConfirmedEmergencyTypeSelect
│   ├── StatusSelect
│   ├── AssignedTeamSelect
│   ├── DispatchBoatOrVehicleSelect
│   ├── ResponderNotes
│   └── SaveTriageButton
├── AcknowledgementTimeline
│   └── SOSStatusEventItem
└── SafetyConfirmationDialog
```

A dispatcher sees **acknowledge**, **assign**, and **resolve** as separate transitions. The UI must never let an operator accidentally mark an SOS resolved when it has only been acknowledged. The backend remains the source of truth for allowed status transitions; the frontend renders a disabled or explanatory state when a transition is rejected.

## State boundaries

| Concern | Preferred owner | Persistence | Failure behavior |
|---|---|---|---|
| User/session identity | Auth provider | Secure cookie or token store | Lock command functions if session expires |
| SOS queue snapshot | Server-state cache | IndexedDB/local storage snapshot | Render last-known queue with stale badge |
| Live SOS events | Realtime provider | No durable client-only state | Reconnect with exponential backoff and refetch snapshot |
| Map layer visibility | URL state + local preference | Local storage | Restore previous layer selection |
| Selected SOS drawer | Route/query state | URL | Deep-link can reopen the event |
| Form draft | Component/form state | Session storage | Preserve draft on refresh; never silently discard |
| Audit timeline | Server-state cache | IndexedDB optional | Show cached timeline with source timestamp |

## Figma translation notes

Use a 12-column desktop grid with a fixed left navigation rail, a 64 px header, and a two-column content canvas. The right rail is reserved for verified alerts and event details. Severity must not be conveyed by color alone: pair the color with a text label, icon, and numeric priority. Each map overlay receives an independent legend row and an accessible description.
