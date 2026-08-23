# Command Center Functional Tab Consolidation Plan

**Status:** Revised proposal for approval; no interface or navigation code has been changed.  
**Goal:** Replace the twelve peer-level workspace entries with **five tabs whose contents share the same operational function**, then use those workstreams to deliver faster response, clearer role-specific incident information, and safer decision support. No existing capability, safety guard, or audit path will be removed.

## 1. Functional consolidation principle

The current navigation mixes work that belongs to the same task flow with work that serves different purposes. For example, SOS intake, verification, and triage appear separately even though they are stages of incident management; field fleet, response groups, resources, and communications are all facets of directing an operational response.

The revised navigation groups features only where an operator uses them to answer the same functional question. Each tab therefore represents one workstream, with small internal views for the stages or records within that workstream.

> **Safety boundary:** Consolidating navigation does not combine verification with action. SOS verification, source freshness, response-group constraints, safety holds, manual dispatch approval, and immutable audit evidence remain separate states inside their functional workstream.

## 2. Proposed five-tab model

| Primary tab | Shared operational function | Existing features combined | Internal views |
| --- | --- | --- | --- |
| **Command Map** | Maintain a real-time spatial operating picture. | Overview / current Command Map. | Map, operational summary, responder radar, map layers, pin information sheets. |
| **Incidents** | Receive, assess, verify, and prioritize emergency signals and public alerts. | Live SOS, Incident Triage, Verified Alerts. | SOS Queue, Triage & Dispatch, Verified Alerts. |
| **Field Response** | Coordinate available teams, vehicles, equipment, assignments, and response communications. | Fleet & Responder Safety, Resources, Response Groups, Communications. | Fleet Safety, Teams & Assets, Resource Logistics, Communications. |
| **Community Safety** | Protect residents through weather/hazard awareness and evacuation support. | Provincial Weather, Risk Map, Evacuation Centers. | Weather & Warnings, Risk Context, Evacuation Centers. |
| **Intelligence** | Monitor system health, maintain accountability, analyze operations, and prepare records. | DRRMO Intelligence. | System Health, Audit Ledger, Reports & Exports. |

This cuts the primary navigation from **12 to 5 choices** while preserving all 12 functional surfaces. The sidebar contains only the five tabs; internal views are shown only after the relevant workstream is selected.

## 3. Why each combination is functionally coherent

| Combination | Rationale | Must remain distinct inside the tab |
| --- | --- | --- |
| **Live SOS + Incident Triage + Verified Alerts → Incidents** | All begin with a signal that needs review, source assessment, prioritization, and accountable next steps. | An incoming SOS is not automatically verified; verified alerts remain source-controlled; recommendations never become automatic dispatches. |
| **Fleet Safety + Resources + Response Groups + Communications → Field Response** | All concern the people, vehicles, equipment, readiness, location, constraints, and communications required to execute a field response. | Fleet safety breaches, group assignment confirmation, resource accountability, and communications acknowledgement retain their individual safeguards. |
| **Provincial Weather + Risk Map + Evacuation Centers → Community Safety** | These features jointly support civilian protection: understand weather/hazard context, assess affected areas, and coordinate shelter capacity. | Weather/risk layers remain decision support; static hazard references remain distinct from live conditions; capacity does not prove center safety or accessibility. |
| **Overview → Command Map** | The current Overview is already a map-first spatial operating picture, which is a distinct command function. | Map pins, overlays, broadcasts, and quick links retain their current safety constraints and contextual details. |
| **DRRMO Intelligence → Intelligence** | System health, audit records, compliance, analytics, and reporting are a governance function rather than an immediate field-control task. | Immutable audit history, export limitations, and role-based controls remain unchanged. |

## 4. Navigation behavior

The sidebar will display five tabs in this order: **Command Map**, **Incidents**, **Field Response**, **Community Safety**, and **Intelligence**. This follows the operational sequence from situation awareness, to incident handling, to field execution, to population protection, to accountability.

Each selected tab shows a compact secondary view selector in the workspace header. The selector is not a second full sidebar. It is visible only for tabs that combine multiple existing features, and shows a maximum of four contextual choices. This keeps the first navigation decision simple while preserving direct access to each capability.

| Tab | Default internal view | Compact status indicator |
| --- | --- | --- |
| Command Map | Map | Existing source/system-health state. |
| Incidents | SOS Queue | Untriaged SOS count; critical count remains visible inside the queue. |
| Field Response | Fleet Safety | Safety-breach count takes priority; otherwise active deployment count. |
| Community Safety | Weather & Warnings | Active official-warning or shelter-capacity-exception count, with timestamps inside the view. |
| Intelligence | System Health | No permanent badge by default; actionable issues appear in System Health. |

## 5. Exact migration map

| Current visible tab | New primary tab | New internal view | Function preserved |
| --- | --- | --- | --- |
| Overview | Command Map | Map | Map-first spatial operations, responder radar, global search, broadcast draft. |
| Live SOS | Incidents | SOS Queue | Incoming emergency intake and authorized manual intake. |
| Incident Triage | Incidents | Triage & Dispatch | Verification checklist and explainable recommendations. |
| Verified Alerts | Incidents | Verified Alerts | Authoritative, time-bounded public-alert control. |
| Fleet & Responder Safety | Field Response | Fleet Safety | Telemetry, hazard proximity, safety breaches, and route review. |
| Response Groups | Field Response | Teams & Assets | Availability, specialty, readiness, constraints, and assignments. |
| Resources | Field Response | Resource Logistics | Asset, relief-stock, and accountability management. |
| Communications | Field Response | Communications | Dispatch log, simulated audio feed, acknowledgement, and communication state. |
| Provincial Weather | Community Safety | Weather & Warnings | Official weather context, source freshness, and warning review. |
| Risk Map | Community Safety | Risk Context | Hazard/reference context, route constraints, and spatial planning. |
| Evacuation Centers | Community Safety | Evacuation Centers | Capacity, readiness, amenities, and transport-gap monitoring. |
| DRRMO Intelligence | Intelligence | System Health | Health indicators, audit, reports, and exports. |

## 6. Implementation phases

| Phase | Planned work | Exit criteria |
| --- | --- | --- |
| **1. Functional navigation model** | Define five primary-workstream IDs, internal view IDs, defaults, badges, and a one-to-one compatibility map for all twelve current labels. | Every current capability maps to exactly one tab and one internal view. |
| **2. Shared navigation shell** | Refactor `CommandCenterNavigation` and `Dashboard` to use the five tabs, retain collapse preferences, and add an accessible contextual-view selector. | Keyboard, focus, active state, collapsed navigation, dark/light modes, and mobile layout remain correct. |
| **3. Compose existing feature views** | Mount current feature components inside their functional tab/view wrappers rather than rewriting operational behavior. | All twelve feature views remain available; data loading, permissions, audit actions, and safeguards are unchanged. |
| **4. Migrate entry points** | Update quick links, map-pin actions, selected SOS links, notifications, global search, manual intake completion, and return buttons to route to `{workstream, view}`. | No action links to a missing view or uses an obsolete visible tab label. |
| **5. Validate and release** | Run regression, accessibility, desktop/tablet/mobile, and hosted workflow checks; provide a short first-use orientation. | Every capability is reachable within two intentional navigation actions and no safety text or review step is lost. |

## 7. Component and state changes

| Current area | Planned change | Constraint to preserve |
| --- | --- | --- |
| `CommandCenterNavigation.tsx` | Replace twelve navigation entries with the five functional workstreams; add only contextual status badges. | Preserve collapsed state, `aria-current`, focus styles, labels, dark/light behavior, and mobile containment. |
| `Dashboard.tsx` | Replace flat visible-tab state with `workstream` + `view` state; add legacy-tab compatibility resolver. | Preserve data loading, notifications, manual intake, source health, audit logging, roles, and safe error states. |
| `CommandMap.tsx` | Keep Command Map as the Command Map default; route quick links using the new semantic destination model. | Preserve Google Maps, overlays, satellite, pin sheets, zoom/reset, navigation, and warning language. |
| Incident components | Present existing SOS, triage, and alert components under Incidents. | Never collapse verification status into triage or dispatch status. |
| Fleet, resources, groups, communications components | Present existing views under Field Response. | Preserve fleet safety holds, assignment confirmation, acknowledgement, and resource-accountability rules. |
| Weather, risk, center components | Present existing views under Community Safety. | Preserve source timestamps, static-vs-live distinctions, and shelter data limits. |
| Intelligence component | Keep existing subviews within Intelligence. | Preserve immutable ledger and controlled export messaging. |
| Tests and styles | Replace flat navigation assertions with workstream/view reachability tests and responsive selector tests. | Retain all existing map, safety, appearance, accessibility, and navigation-collapse tests. |

## 8. Validation plan

| Area | Validation scenarios | Pass condition |
| --- | --- | --- |
| Feature reachability | Navigate from each of the five tabs to each internal view. | All twelve existing feature surfaces render and remain actionable. |
| Workflow continuity | Open SOS from map, manual intake, alert, group assignment, resource action, warning, and notification pathways. | Each opens its correct functional tab/view with selected context retained. |
| Accessibility | Keyboard use, collapsed sidebar, tab/view selection, active-state announcements, focus return after drawers/sheets close. | No unlabeled controls, focus traps, or incorrect active state. |
| Responsive layout | Desktop, tablet, and 390 px mobile in dark/light appearance. | Primary navigation and internal view selector remain contained; map controls and responder rail do not overlap. |
| Safety integrity | Incident verification, source freshness, fleet safety, weather/risk, evacuation, audit, and export flows. | No guardrail becomes hidden, bypassable, or represented as automatic action. |
| Build verification | Frontend tests, TypeScript, production build, and relevant backend tests after navigation destination changes. | All checks pass before the hosted release. |

## 9. Assumptions and open decision

This proposal assumes the user wants to retain all existing functions and reduce only the number of **primary** tabs. It also keeps **Communications** under Field Response because dispatch traffic, acknowledgement, and coordination serve the same response-execution function as teams, fleet, and resources.

The only remaining naming decision is whether the fourth tab should be called **Community Safety** (recommended, because it speaks to civilian protection) or **Weather & Shelters** (more literal but narrower). The recommended label is **Community Safety** because it accurately contains weather, risk, and evacuation support without implying that map/weather context proves safety.

## 10. Response-optimization additions by functional tab

The feature additions below are prioritized by their ability to reduce time from signal receipt to an accountable human decision, while giving field responders and coordinators a shared, source-aware picture. They are planned as enhancements within the five functional tabs rather than new standalone tabs.

| Priority | Functional tab | Addition | Response-time benefit | Safety and data rule |
| --- | --- | --- | --- | --- |
| **P0** | Incidents | **Incident response packet** that consolidates the selected SOS/alert’s location confidence, report time, contact/communication status, severity, verification evidence, affected people, active hazards, responder-risk summary, recommended capable groups, and latest action log. | Eliminates cross-tab lookup before a coordinator can assign the next verified action. | Display confidence and source age beside every field; never label an unverified report as confirmed. |
| **P0** | Field Response | **Responder readiness card** with live/last-known position, check-in age, personnel count, specialty, vehicle/equipment capability, fuel/battery, communications channel, current assignment, risk hold, and ETA confidence. | Lets dispatch identify a suitable available team in one view. | A readiness score remains explainable; an unavailable/held unit is never silently recommended. |
| **P0** | Community Safety | **Barangay impact and evacuation brief** combining official warning area, static risk reference, affected-population estimate if approved, center capacity, transport gap, accessibility report, and last field verification. | Reduces handoff time between weather monitoring and evacuation coordination. | Model/static context must not be presented as live flood extent, center safety, or a mandatory evacuation order. |
| **P0** | Command Map | **Selected-incident map brief** that links pin information sheets to the incident response packet, nearest capable units, centers, active hazards, route context, and source times. | Keeps map-based decisions spatially anchored without forcing operators to open several windows. | Route and imagery remain advisory; field confirmation is required before movement decisions. |
| **P1** | Incidents | **Duplicate and related-report clustering** that groups nearby, time-adjacent reports while preserving every original record and confidence level. | Reduces duplicate triage during high-volume events. | A human must approve any merge, split, priority change, or closure; all decisions are audited. |
| **P1** | Field Response | **Unit check-in and safety-watch workflow** with scheduled but manually acknowledged departure, arrival, on-scene, return, and overdue-check-in states. | Makes missing acknowledgement visible early and improves responder accountability. | Overdue status triggers an operator review prompt, never an automated deployment or public message. |
| **P1** | Field Response | **Capability and mutual-aid matrix** mapping water rescue, medical, ropes, chainsaw, evacuation transport, radio, generator, and heavy-equipment capabilities to teams and external partners. | Speeds matching of incident needs to actual available capability. | Capability availability, condition, and partner confirmation are separate fields; no assumed readiness. |
| **P1** | Community Safety | **Official source timeline and discrepancy panel** for PAGASA products, local observations, station age, radar/satellite status, warning changes, and field reports. | Shows whether response planning is based on current evidence or stale/conflicting sources. | Preserve provider links, timestamps, coverage, and static-vs-observed-vs-forecast labels. |
| **P1** | Intelligence | **Operational performance dashboard** measuring time-to-triage, time-to-verification, time-to-assignment, check-in compliance, failed communications, center occupancy trend, and source freshness. | Identifies bottlenecks during and after an event. | Use quality indicators and data-completeness notes; do not turn incomplete logs into staff performance conclusions. |
| **P2** | All tabs | **Offline incident briefing bundle** cached on authorized field devices, containing the last verified incident packet, local maps, contacts, checklists, and source times. | Maintains common operating context during a signal/power interruption. | Show cache age prominently; do not imply that offline data is current. |
| **P2** | Command Map and Community Safety | **Verified field-observation layer** for timestamped water depth, road blockage, shelter condition, damage, and access reports with photo/voice evidence where consent and retention rules permit. | Adds local evidence directly where external weather layers have limited municipal resolution. | Every observation carries reporter, time, location accuracy, verification state, and expiry; reports never become ground truth automatically. |

## 11. Incident-specific response packets

The standard incident response packet should use a common core, then add an emergency-specific section. This prevents critical details from being buried in generic notes while avoiding a new tab for every emergency type.

| Emergency type | Essential coordinator information | Essential responder information | Additional safeguard |
| --- | --- | --- | --- |
| **Flood, flash flood, or storm surge** | Water-level/field-observation age, official warning status, rain/radar context, tide/coastal context where approved, affected barangays, evacuation-center capacity, transport/boat availability, route constraints, and last confirmed road/landing-point reports. | PPE and water-rescue capability, boat/vehicle limits, fuel, water-current or tide briefing where available, buddy/check-in requirements, and nearest safe staging point. | Do not infer water depth, current, road passability, or safe navigation from imagery or static hazard data. |
| **Typhoon or severe-weather event** | PAGASA bulletin issue time, wind/rain warning areas, projected operational period, source freshness, communication/power status, center readiness, exposed facilities, and pending community actions. | Wind limits for vehicles/boats, shelter-in-place/recall instruction state, radio fallback channel, task timing, and verified safe staging point. | Official warning products remain primary; comparison tracks and models are contextual only. |
| **Medical emergency or mass-casualty report** | Patient count, triage category as reported, location confidence, access constraints, ambulance/medical-team availability, facility capacity when integrated, required supplies, and contact status. | Clinical scope, equipment loadout, patient handover field, access approach, destination confirmation, and communications channel. | Protect health information through role-based access, minimum necessary fields, and audited viewing; medical triage remains a qualified human function. |
| **Trapped, missing, or rescue request** | Last known point/time, number of people, dependents/vulnerabilities, caller contact, structure/terrain/water context, search sectors, available specialist teams, and verified observation history. | Search assignment, team composition, search grid/sector, check-in interval, hazards, communications fallback, and extraction capability. | Preserve original reports and uncertainty; do not treat a last-known location as a current position. |
| **Landslide, road blockage, or structural damage** | Exact reported location, slope/road/static susceptibility context, rainfall history/source age, affected population/facilities, utility information if verified, alternative access reports, and specialist equipment need. | Exclusion-zone instruction, geotechnical/structural assessment requirement, heavy-equipment capability, spotter/check-in procedure, and safe approach report. | Static susceptibility maps cannot certify instability, clearance, or structural integrity. |
| **Fire, hazardous-material, or industrial incident** | Incident classification, facility/material information if verified, wind context, exposure radius as an operator-planned reference, water supply/resources, evacuation/shelter implications, and mutual-aid status. | Applicable PPE, apparatus/capability, staging point, hazard notes, water source, accountability roster, and communications plan. | Hazard classification and exclusion perimeter require qualified incident command; do not calculate or publish them automatically from incomplete data. |
| **Evacuation-center or displacement issue** | Occupancy/capacity, population needs, accessible beds, food/water/medical/sanitation status, transport queue, protection concerns, center staff contact, and last condition report. | Assigned transport/relief task, loading count, special-needs handling, destination confirmation, center check-in, and return task. | Capacity is a reported operational field; it does not prove that the site is accessible, safe, or supplied. |
| **Communication or power outage** | Affected coverage area, reporting source, last successful contact, repeater/generator/battery state, fallback channels, affected critical facilities, and provider/lifecycle status where integrated. | Primary and fallback radio/SMS/mesh procedure, check-in interval, battery conservation instruction, and relay point. | No silent transmission or automatic recipient confirmation; delivery and acknowledgement remain explicit. |

## 12. Cross-cutting optimizations for faster decisions

| Optimization | Proposed implementation approach | Expected operational effect | Constraint |
| --- | --- | --- | --- |
| **One-action incident brief** | Open the selected incident packet from the map, SOS queue, verified alert, responder view, or notification, with the same source-aware fields everywhere. | Reduces handoff and context switching. | Different roles see only authorized fields. |
| **Progressive disclosure** | Show three to five critical facts first; reveal evidence, history, source links, and analytics in expandable sections. | Reduces cognitive load under time pressure without removing evidence. | Critical warnings and stale/source status must remain visible without expansion. |
| **Role-aware views** | Highlight coordinator, field-unit, shelter-manager, and information-officer actions/views within the same incident record. | Gives each role an actionable brief without duplicating records. | Roles guide presentation; they do not bypass authorization checks. |
| **Shared cache and delta refresh** | Use a composite response and changed-record updates for map/incident data; honor provider refresh limits and `Retry-After`. | Lowers avoidable request load and improves response during traffic spikes. | Cached, stale, and rate-limited states must be explicit. |
| **Prepared response checklists** | Attach non-automated, incident-type checklists to the packet, with completion evidence and responsible operator. | Reduces omission of critical checks. | Checklist completion does not itself verify a report or authorize action. |
| **Communications templates** | Provide editable, approval-required radio/SMS/bulletin templates populated from verified incident fields. | Speeds consistent communication preparation. | No automatic sending, public warning, or false delivery confirmation. |
| **Post-action timeline** | Maintain a visible immutable event sequence: report, verification, assignment, acknowledgement, field update, and resolution review. | Makes current status and accountability immediately understandable. | Timestamp/source corrections append an audit event rather than overwrite history. |

## 13. Recommended delivery order

| Release increment | Scope | Why it is first | Validation gate |
| --- | --- | --- | --- |
| **R1 — Navigation and incident packet** | Implement five functional tabs, compatibility routing, and common incident response packet with source/freshness fields. | Produces the largest reduction in context switching without requiring new external data contracts. | Existing workflows, map pins, manual intake, triage, and safety tests pass. |
| **R2 — Field response readiness** | Add enriched unit cards, capability matrix, check-in workflow, and communication acknowledgement improvements. | Directly reduces dispatch matching and field-accountability delays. | Safety-hold, role, acknowledgement, and audit tests pass; no automatic dispatch. |
| **R3 — Community safety brief** | Add barangay impact, center/transport brief, official source timeline, and discrepancy view. | Connects weather/hazard context to civilian-protection decisions. | Source terms, freshness display, static/live distinctions, and disaster-SOP review pass. |
| **R4 — Evidence and offline support** | Add verified field-observation layer, offline briefing bundle, richer analytics, and post-event reports. | Improves resilience and sustained operations after the core fast-response flows are stable. | Privacy, retention, offline-age, performance, and field exercise review pass. |

## 14. Information sufficiency and risk statement

No system can provide *all* information necessary for every emergency with certainty, especially when field conditions, telecommunications, and provider feeds change quickly. The target is therefore **the best available, source-labelled, role-relevant decision packet**, not a claim of omniscience or automatic safety.

The implementation must favor: current source time over polished but stale data; field verification over modelled inference; explicit uncertainty over false precision; and operator approval over automated dispatch, evacuation orders, public messages, or route-clearance claims.
