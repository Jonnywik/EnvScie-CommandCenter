# Field Response Finalization Plan

## Purpose and completion standard

This plan completes the **Field Response** workspace as a single operator journey across Fleet Safety, Teams & Assets, Resource Logistics, and Communications. The goal is not to add automatic field authority. The final workspace must make the next human decision clear, show whether its inputs are fresh enough to use, record the decision and its outcome, and carry the operator to the appropriate confirmation surface without losing context.

> **Operational boundary.** Field Response may surface reported location, telemetry, routes, communications, recommendations, and notification receipt. It must not claim route clearance, field safety, mobile delivery, public-warning release, or responder movement unless a configured provider and a named human decision support that action.

The tab is considered final only when every consequential control has an explicit scope, confirmation or safe draft boundary where needed, auditable feedback, keyboard access, and a responsive treatment at desktop and narrow mobile widths.

## Audit summary

The current workspace has a strong operational foundation. Fleet Safety already joins roster information, telemetry, active hazard geometry, route previews, safety-hail confirmation, and dispatch-lifecycle acknowledgement. Teams & Assets provides roster filters, readiness guards, team detail, and assignment delivery history. Resource Logistics shows supply position and communications-release status. Communications includes filterable logs, an audio rehearsal feed, outbound message composition, and explainable response-group recommendations.

The remaining work is mainly **workflow consolidation and precision**, rather than additional dashboard panels. Legacy contextual views still use a different header and state model than Fleet Safety. Several controls are direct legacy actions rather than an explicit draft, proposal, confirmation, and outcome sequence. The strongest risk is semantic ambiguity: labels such as “Force Reroute” and “Push to Mobile” visually imply operational authority even though their implementation correctly produces an advisory route review or an audited non-delivery draft. The finalization pass must resolve that mismatch.

| Priority | Finalization gap | Current evidence | Required outcome |
| --- | --- | --- |
| P0 | Safety language and stale-data handling | Fleet route and mobile controls are bounded in supporting text, while their labels can imply execution; missing timestamps can fall through age calculations. | Use non-authoritative labels and treat missing position/check-in data as a review trigger. |
| P0 | One human-controlled assignment lifecycle | Teams & Assets and Communications can initiate assignment actions independently, while Incident Triage owns the guarded lifecycle. | All Field Response assignment starts become an identified draft/proposal that hands off to Triage for confirmation. |
| P0 | Cross-workspace operational context | Selected group, incident, resource, and communication context is local to each view. | Preserve a selected entity and deep-link safely among Field Response and Incident Triage. |
| P1 | Logistics accountability workflow | Resource actions create audit entries but do not expose a structured request owner, quantity, rationale, expected receipt, or reconciliation state. | Add an auditable request/review lifecycle without inferring stock movement. |
| P1 | Coordinator attention management | Stale counts, low resources, failed delivery, and channel degradation are distributed across subviews. | Add a compact, dismissible-in-view attention strip that links to the relevant existing record. |
| P1 | Accessibility and narrow-screen refinement | Fleet’s row selection is pointer-led; legacy tables and dense action rows need more deliberate mobile and keyboard behavior. | Support keyboard selection, focus restoration, live status announcement, and mobile card alternatives where tables become unreadable. |
| P2 | Dense-log scalability and review | Communications filters are useful, but there is no incident-centric timeline view or bounded review/pagination strategy. | Add incident/group filters, a stable recent-window limit, and links to the immutable record rather than loading an unbounded log. |

## Target state by contextual view

### Fleet Safety

Fleet Safety becomes the **reported unit-safety review surface**. The deployment matrix should offer an explicit “requires review” filter and sort state, including units with no reported position or check-in time. The selected-unit console should distinguish reported telemetry, inferred display values, and unavailable data. A safety hail remains a separately confirmed urgent coordination request; it does not resolve a review flag automatically.

Route controls should be renamed to reflect actual behavior: **“Review alternative route”** for the existing reroute-preview action and **“Record route handoff draft”** for the non-delivery audit record. The route card should state the source time, hazard-record time, number of blocked segments, and a persistent “field verification still required” condition. Where an assignment is pending or confirmed, Fleet Safety should deep-link to that lifecycle record in Triage rather than expose a competing dispatch path.

### Teams & Assets

Teams & Assets becomes the **personnel and capability selection surface**, not a second independent dispatch authority. Its selected-team panel should show a compact readiness explanation: roster availability, location age, check-in age, constraint count, equipment fit, and current commitment. The “Assignment desk” should create or prefill a **dispatch proposal** and open the Triage confirmation flow for SOS incidents. For non-SOS tasking, it should create a named draft tasking record that still requires a coordinator confirmation before a notification is queued.

The roster should retain filter state, selection, and scroll position while an operator moves to Triage or returns. A “clear filters” action, zero-state explanation, and visible data-generated timestamp will reduce recovery time in a high-volume event.

### Resource Logistics

Resource Logistics becomes an auditable **resource-accountability and request desk**. “Check,” “Reserve,” and “Resupply” should open a compact structured sheet containing the reported count, requested amount or hold, destination, named owner, reason, expected review time, and confirmation. The status does not change until a coordinator records a reported update or the responsible owner confirms receipt; the UI must make this distinction visible.

The final view should calculate and display the last report age for each resource. A below-threshold condition should create an attention item rather than a claim that replenishment is underway. Communications releases must remain separate from a public warning: their lifecycle should show draft, reviewed, approved for release, released, and reported acknowledgement coverage, with named operator and time.

### Communications

Communications becomes the **traceable coordination ledger and message-preparation desk**. The composer should show a pre-send summary of recipient scope, reported channel health, incident link, and simulation/live-provider state. Consequential outbound messages should use a confirmation step that captures the operator’s intent; a failed or unavailable channel must retain the draft and offer a non-duplicating retry path.

Audio remains explicitly rehearsal/simulation until a secured voice gateway exists. Recommendation cards must remain advisory. Instead of directly accepting a top-ranked team from Communications, the recommendation should carry the selected incident, team, score factors, and freshness warnings into the shared Triage selection-and-confirmation flow, where the coordinator may choose any eligible team.

## Finalization work packages

### Work package 1 — Safety semantics and data quality

This package removes authority-implying labels, normalizes the “reported / unavailable / stale” presentation, and treats absent timestamps as an explicit review condition. It also adds a visible generated-at/freshness label to each contextual tab and protects the behavior with unit tests for missing location and check-in times.

**Acceptance criteria:** A unit with a missing or stale location/check-in cannot appear as clear by omission; all route and mobile controls use advisory or draft terminology; every safety indicator identifies whether it is reported, computed from reference geometry, or unavailable; no button claims it changed a route, unit movement, or field safety unless an approved integration actually did so.

### Work package 2 — Shared Field Response context and guarded lifecycle handoff

This package introduces a small Field Response context model for `selectedGroupId`, `selectedIncidentId`, `selectedResourceId`, active filters, and return location. It upgrades legacy contextual headers to the shared Command Center header treatment and makes navigation consistent across all four views. SOS assignment actions are converted into a proposal or Triage handoff, preserving the existing no-duplicate-proposal backend guard.

**Acceptance criteria:** Selecting a group, resource, incident, or communication preserves a recoverable context across navigation; every SOS assignment is confirmed only through the documented human-controlled lifecycle; notification receipt is never displayed as field acknowledgement; returning from Triage restores the relevant Field Response record and filters.

### Work package 3 — Structured resource and message decisions

This package replaces generic audit-only resource buttons with compact, accessible review sheets and introduces a message preflight/confirmation surface. Both forms retain draft values on validation or provider failure and create explicit audit events. It also introduces a clear status taxonomy for resource requests and communication releases.

**Acceptance criteria:** Resource requests always capture an owner, rationale, target, and review time; a request is visibly different from a completed resupply or reserve; a communications release cannot be represented as a public warning without the appropriate separate authority; failed deliveries and unavailable channels expose a retry or escalation path without silently duplicating a message.

### Work package 4 — Attention, accessibility, and responsive refinement

This package adds an in-view attention strip that aggregates existing stale telemetry, safety reviews, low stock, failed/pending delivery, and degraded channel indicators without creating new alerts. It converts pointer-only record selection into keyboard-operable controls, implements focus management for new confirmation sheets, and provides mobile-card presentations for dense resource and roster rows below the established narrow breakpoint.

**Acceptance criteria:** The attention strip only changes the view and does not mutate operational records; all selected records are usable via keyboard with visible focus; dialogs trap focus, close with Escape, restore focus to their trigger, and announce outcomes; `375 × 812`, `495 × 825`, tablet, and desktop checks show no horizontal overflow, clipped actions, or unreadable dense tables.

### Work package 5 — Review performance and release evidence

This package bounds long communication histories, adds incident/group-centric filtering and immutable-record links, and completes the release evidence. It adds regression coverage for safety semantics, lifecycle handoff, retained context, responsive layouts, and non-mutating attention navigation.

**Acceptance criteria:** Large event lists use a documented recent window and incremental review pattern; filters have clear/reset behavior; frontend tests, TypeScript validation, optimized production build, and relevant backend tests pass; dark/light and mobile visual checks are recorded; no test creates a new SOS, dispatch proposal, notification, status transition, route-clearance claim, or field-safety claim in hosted demo data.

## Recommended implementation sequence

| Stage | Scope | Dependencies | Verification evidence |
| --- | --- | --- | --- |
| 0 | Freeze a representative Field Response snapshot and audit all current actions. | None. | Action-to-API map; baseline desktop/mobile screenshots; no state changes. |
| 1 | Deliver work package 1. | Existing Fleet telemetry, GIS, and CSS tokens. | Unit tests for absent/stale timestamps; wording review; Fleet dark/light/mobile checks. |
| 2 | Deliver work package 2. | Incident Triage lifecycle and shared navigation contract. | No competing SOS proposal path; retained context and return-path tests. |
| 3 | Deliver work package 3. | Auditable backend contracts and provider boundaries. | Structured validation tests; retry/draft retention; audit-event verification. |
| 4 | Deliver work package 4. | Shared context and finalized control semantics. | Keyboard, focus, screen-reader, and responsive visual checks. |
| 5 | Deliver work package 5 and release documentation. | All prior packages. | Full frontend/backend suites, production build, hosted smoke check, release note, and GitHub synchronization. |

## Explicitly deferred boundaries

The finalization plan does not convert the demo workspace into an autonomous dispatch, radio, SMS, push, public-warning, facility-status, or route-clearance system. Those capabilities require separately approved providers, credential handling, real responder devices, authority rules, operating procedures, and production validation. The finalized Field Response workspace will instead make those limitations explicit while preserving auditable human decision support.
