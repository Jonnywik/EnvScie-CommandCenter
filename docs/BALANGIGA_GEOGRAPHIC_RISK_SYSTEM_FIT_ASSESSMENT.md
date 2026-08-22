# Balangiga, Eastern Samar: Geographic Risk Profile and Command Center System-Fit Assessment

**Prepared by:** Manus AI  
**Date:** 20 August 2026  
**Purpose:** To explain Balangiga’s physical setting and likely priority hazards, identify operational features that would strengthen Code for Resilience, and state clearly whether the current system is sufficient for municipal or province-wide operations.

> **Scope clarification.** Balangiga is a municipality in the Province of Eastern Samar, not a province. This assessment evaluates the platform first for **Balangiga municipal operations** and then for possible expansion to the whole Province of Eastern Samar. It is a planning assessment, not an official hazard map, evacuation order, or engineering certification.

## Executive assessment

Balangiga is a coastal, river-mouth municipality on the southern edge of Samar facing Leyte Gulf. Its settlement pattern combines low coastal and estuarine areas with agricultural and wetland/open-land areas and a more rugged hinterland. This geography makes the municipality’s priority emergency problem a **compound coastal-rainfall event**: a typhoon can bring destructive wind, storm surge and waves, intense rain, river or local flooding, road isolation, power loss, and communications interruption at the same time. The municipality’s location at the mouth of the Balangiga River strengthens the need to treat coastal flooding and inland runoff as one operational problem rather than two separate ones. [1] [2] [4]

The current Command Center is a **strong municipal coordination prototype and training platform**. It already supports the core command workflow: manually entered and resident-originated SOS reports, alert verification, hazard and safe-route review, evacuation-capacity review, resource and response-team status, field communications, advisory dispatch recommendations, notification tracking, and a durable audit trail. It can therefore support real municipal preparedness exercises and supervised response coordination **after local data and operating procedures are loaded and validated**. It is **not yet a deployment-ready provincial emergency operating system** because it does not yet contain the required authoritative live hazard layers, instrument feeds, provincial governance model, data-sharing agreements, multi-municipality access controls, or field-validated response procedures.

| Decision question | Assessment | Why it matters |
|---|---|---|
| Can the system support Balangiga today? | **Yes, as a supervised municipal coordination, exercise, and structured-logging system.** | Its existing incident, map, shelter, team, communications, notification, and audit workflows match the basic municipality command cycle. |
| Can it make autonomous life-safety decisions? | **No.** | Hazard thresholds, routes, field conditions, capacity, and team availability must be verified by authorized personnel before public warning or dispatch. |
| Can it operate province-wide today? | **Not yet.** | A provincial rollout needs 22 municipalities plus Borongan City, provincial roles and escalation, shared data standards, larger-scale GIS and roster coverage, and tested inter-LGU workflows. [2] |
| Is the architecture expandable? | **Yes, conditionally.** | The existing FastAPI/PostGIS, hazard-zone, unit-position, notification, audit, and recommendation patterns are suitable foundations, but capability is different from operational readiness. |

## 1. Geographic and topographic layout

Balangiga lies on the **southern coast of Samar**, faces **Leyte Gulf**, and sits at the **mouth of the Balangiga River**. Its municipal neighbors are Lawaan to the west, Llorente to the north, and Quinapondan and Giporlos to the east. The municipality has 13 barangays. [1] The latest official census table located for this review records **14,341 residents in 2020**; the provincial profile’s older table shows 14,085 in 2015. [3] [2]

The municipal and provincial source material supports a practical four-part operations layout. The exact boundaries below should be digitized from authoritative LGU, NAMRIA, MGB, and GeoRiskPH layers before use as an operational map.

| Operational landscape | Evidence and physical character | Principal disruption pathway | Command Center implication |
|---|---|---|---|
| **River-mouth town and coastal barangays** | Balangiga’s town setting is coastal and at the Balangiga River mouth, facing Leyte Gulf. [1] | Storm surge, waves, tidal backwater, wind damage, and river/coastal flooding can overlap. | Show storm-surge, river/flood, tide, road-closure, evacuation and shoreline access layers together. |
| **Coastal lowlands, wetland/open-land and agricultural areas** | A local municipal profile reports 40.23% agricultural land and 32.41% grassland/swamp, although these land-use figures are historic and need updating. [4] | Saturated ground, crop and fishery loss, local inundation, difficult last-mile access, and shelter demand. | Track barangay crop/fishery impacts, passable roads, boat availability, potable water and relief delivery. |
| **Rugged hinterland and interior access corridors** | The local municipal profile describes coastal lowlands with rugged mountainous hinterlands and reports elevations up to 300 m. [4] | Rain-induced slope failure, debris flow, fallen trees, road isolation, delayed rescue and resupply. | Maintain road-segment status, landslide/debris-flow layers, bridge status, travel-time confidence and alternate routes. |
| **Coastal ecosystem interface** | Local sources describe a marine/coastal economy; published work includes Balangiga in Eastern Samar studies of mangrove and typhoon-related coastal resilience. [4] [11] | Loss of natural wave buffering, damage to livelihoods, difficult coastal access, and post-event environmental health issues. | Include mangrove/coastal-buffer condition, fishery landing access, shoreline damage reports, and recovery tasks. |

The local municipal profile describes the municipality as coastal lowland with a rugged hinterland. It also gives a “lowest elevation” of 100 m, which is inconsistent with a river-mouth coastal settlement; that number should **not** be used operationally until it is checked against a current digital elevation model and official local survey data. [4] This illustrates a core principle for the system: the Command Center should display the **source, publication date, resolution, and confidence** of every hazard layer rather than treating all map data as equally reliable.

## 2. Disaster-risk profile

Balangiga should plan for disaster **chains**, not isolated hazards. A strong tropical cyclone can produce severe wind, storm surge, coastal waves, intense rainfall, river overflow, local flooding, landslides on access routes, communications loss, shelter crowding, and public-health risks in one operating period. Research on Haiyan shows that Leyte Gulf’s bathymetry can locally amplify storm surge; the study estimated 5–6 m surge levels in the gulf context. That is a warning about regional mechanism, **not** a site-specific prediction for every Balangiga barangay. [5]

| Priority | Hazard or compound event | Why Balangiga should plan for it | Essential operational questions |
|---|---|---|---|
| **1** | **Typhoon wind, extreme rain, storm surge and coastal waves** | Balangiga faces Leyte Gulf in a province heavily affected by typhoons. Haiyan research documents severe coastal behavior in Leyte Gulf and Eastern Samar. [2] [5] [7] | Which coastal/river-mouth zones must evacuate first? Which shelters remain safe under wind and surge scenarios? Which roads, boats, power sites and communications nodes are exposed? |
| **1** | **Riverine and local rainfall flooding** | The town is at the Balangiga River mouth; heavy rain and coastal water levels can combine and restrict drainage. [1] | What is the river level, local rainfall, tide/surge forecast, flood extent, road status and evacuation trigger for each barangay? |
| **2** | **Rain-induced landslide and debris flow** | A rugged hinterland and interior roads create a credible route-isolation and slope-failure risk. Government MGB layers explicitly include landslide susceptibility and debris-flow paths. [4] [8] | Which slopes and roads are unsafe? Who is isolated? What alternative route, boat or pre-positioned stock is available? |
| **3** | **Earthquake and tsunami** | These are lower-frequency but high-consequence coastal and lifeline risks. They require location-specific PHIVOLCS/GeoRiskPH assessment, not a generic provincial label. [9] | Which facilities and coastal assembly zones are in assessed exposure areas? Is the public warning and vertical/landward evacuation protocol current? |
| **4** | **Drought, heat, water, health and service-continuity stress** | Agriculture, fishing, water and health services may be affected by prolonged dry periods, heat, disease outbreaks and post-storm sanitation problems. PAGASA provides climate-extremes and planning materials, but local thresholds still need calibration. [4] [10] | Is potable water sufficient? Are clinics, cold chain, sanitation, medicine, vulnerable households, and power/telecom backup being monitored? |

Government resources can make this ranking location-specific. HazardHunterPH provides government-generated assessments for seismic, volcanic and hydrometeorologic hazards, while the MGB portal exposes coastal physical vulnerability, flood susceptibility, rain-induced landslide susceptibility and debris-flow information. [8] [9] Before any public-facing use, Balangiga should obtain the current map layers, clip them to official municipal and barangay boundaries, document the source date and scenario, and validate them with municipal engineering, DRRM, barangay and community observations.

## 3. Current system coverage against Balangiga’s needs

The table below separates what the Code for Resilience build can already do from what must still be connected, validated, or governed. “Available” means the workflow is implemented in the current build; it does **not** mean that a live government feed, field sensor, or authoritative local dataset is already connected.

| Risk-management need | Current Command Center coverage | Readiness | Gap to close before field use |
|---|---|---|---|
| Receive emergency reports from residents, radio, walk-ins and staff | SOS workflow plus coordinator manual emergency intake with source labels, location, reporter, urgency and audit trail. | **Available** | Connect actual SMS gateway, radio protocol and community reporting channels; train users and publish data-retention rules. |
| Verify warnings and share official information | Verified Alerts, feed-health review, bulletin workflow, notification delivery state and audit record. | **Workflow available** | Connect PAGASA, NDRRMC, PHIVOLCS, MGB and provincial/LGU verified sources with source timestamp, failure alarm and human verification rules. |
| Visualize hazards, resources and safe movement | Hazard zones, GIS resource positions, evacuation-center map context and advisory route preview. | **Platform available** | Load authoritative Balangiga flood, surge, landslide, tsunami, road, bridge, center and critical-facility layers; validate route network condition in the field. |
| Manage surge/flood evacuation | Center capacity review, center verification, resupply requests, alert/SOS workflow and manual coordination actions. | **Partially ready** | Add scenario-based evacuation triggers, transport manifests, household/assistance registries, pet/livestock and accessible-evacuation support, and shelter WASH/health status. |
| Manage isolated-road/landslide response | Resource inventory, team location/check-in, route review, communication log and recommendation engine. | **Partially ready** | Add road/bridge closure reporting, slope/debris-flow layer, route confidence expiration, pre-positioning plan, and helicopter/boat/alternate-access coordination fields. |
| Match teams to incidents | Response groups, specialty/readiness/freshness/constraint-aware recommendations and notification contracts. | **Available with guardrails** | Integrate verified roster, radio callsign, qualifications, real location, duty period, vehicle/boat condition and mutual-aid arrangements. Recommendations must remain advisory. |
| Sustain operations during power or signal loss | Offline-oriented SOS design, SMS/push/in-app notification pathways, communications log and cached operational view. | **Partially ready** | Implement field-tested offline mobile synchronization, message-delivery reconciliation, backup power status, radio gateway integration and regular communications drills. |
| Maintain accountability across shifts | Audit records, handover review, remembered workspace, quick keys, and copyable shift-handoff brief. | **Available** | Adopt a duty-officer handover policy, retention schedule, incident naming convention and supervisor review procedure. |

The current implementation has 18 auditable actions across eight areas: Overview, Live SOS, Verified Alerts, Risk Map, Evacuation Centers, Resources, Response Groups and Communications. Its dispatch recommendations explicitly retain constraints and freshness checks, and units that are stale, constrained, assigned or offline are not presented as unconditional deployment clearance. These are sound safety properties for Balangiga’s hazard environment. The remaining issue is **operational data maturity**, not the absence of a command workflow. [12]

## 4. Recommended hazard-specific additions

The following additions are the highest-value improvements because they turn the current general-purpose coordination system into a Balangiga-specific, compound-hazard operating picture.

| Feature addition | Hazards served | What it should do | Prerequisite | Success measure |
|---|---|---|---|---|
| **Compound coastal-flood board** | Storm surge, wave overtopping, river and rainfall flooding | Combine PAGASA warning, wind/rain forecast, tide, river level, surge scenario, affected barangays, road closures and evacuation readiness in one timestamped panel. | Authoritative feeds, local thresholds, river/tide observations and approved SOPs. | Duty officer can identify evacuation priority, trigger basis and data freshness in under two minutes. |
| **Barangay exposure and assisted-evacuation registry** | All life-safety hazards | Link households and critical persons to barangay, zone, shelter plan, transport and contact protocol with strict privacy controls. | Data-sharing authority, consent/retention policy, barangay validation and access controls. | Every high-risk zone has a verified evacuation and follow-up coverage percentage. |
| **Road, bridge, boat and access-status map** | Flood, landslide, surge, earthquake | Let field teams report blockage, passability, travel mode, clearance status, photo/evidence and expiry time for every key access segment. | Baseline road/bridge/shore access inventory; field reporting protocol. | Route guidance never uses a segment with expired confidence; an alternate is visible where one exists. |
| **Evacuation-center operating status** | Typhoon, flood, tsunami, public-health emergency | Add structural status, wind/surge/flood exposure, water/sanitation, power, medical needs, gender/safeguarding, accessibility and supply days remaining. | Center inspection checklist, WASH/health SOPs and regular reporting. | Capacity is not treated as available unless safety and WASH checks are current. |
| **Landslide and isolated-barangay watch** | Intense rainfall, landslide, debris flow | Join MGB susceptibility/flow paths with rain thresholds, road status, pre-positioned supplies and radio check schedule. | MGB layers, local rain thresholds and barangay access plan. | At-risk routes are flagged before isolation, with a documented pre-positioning decision. |
| **Warning-to-action playbooks** | Typhoon, surge, flood, earthquake/tsunami | Convert authorized warning levels into reviewed task checklists: who verifies, who warns, who evacuates, who opens centers and who reports completion. | LGU-approved contingency plan and incident-command roles. | Every warning action is assigned, timestamped, acknowledged and escalated if overdue. |
| **Provincial mutual-aid and escalation module** | Large events across municipalities | Add municipality, provincial, and regional coordination views; resource-request forms; capability registry; and handover/escalation statuses. | MOAs, role-based access, provincial EOC operating model and shared data standard. | A municipality can request, receive and close mutual aid with a complete traceable record. |

## 5. Phased roadmap

The safest implementation path is to improve **data quality and operating discipline before automation**. A system that looks real but carries stale maps or unverified capacity can create more risk than a simpler system with reliable status information.

| Phase | Indicative horizon | Deliverables | Gate before moving forward |
|---|---|---|---|
| **0. Local data and governance foundation** | 0–60 days | Official boundaries; barangay names/codes; verified centers; road/bridge/shore access inventory; response roster; SOPs; data-owner agreements; source metadata standard. | LGU DRRM, engineering, health, social welfare, police/fire and barangay representatives sign off on data ownership and update duties. |
| **1. Balangiga compound-hazard operations** | 2–4 months | Coastal-flood board; MGB/GeoRiskPH layers; center operating status; access-status reports; official-feed verification; warning-to-action checklists; drills. | Tabletop and field exercise demonstrate accurate information flow from warning to shelter/accountability without unsafe automatic dispatch. |
| **2. Resilient field communication and recovery tracking** | 4–8 months | Offline mobile synchronization, radio/SMS gateway, power/telecom status, delivery reconciliation, recovery task board, livelihood and WASH monitoring. | Simulated communications outage demonstrates message retention, later reconciliation and audit completeness. |
| **3. Eastern Samar provincial scale-up** | 8–18 months | Multi-municipality tenancy, provincial EOC view, standard incident IDs, mutual-aid request workflow, shared resource registry, provincial GIS catalogue, role-based access and training program. | A multi-LGU drill demonstrates controlled data sharing, escalation, resource handoff and consistent situation reporting. |

## 6. Bottom-line answer

**For Balangiga:** The current system can genuinely support coordination if it is used as a human-supervised command tool and is populated with authoritative local datasets, current rosters, validated center information, and documented emergency procedures. Its present strengths are incident intake, coordinated triage, actionable visibility, responder tracking, shelter monitoring, communication logging, notification follow-up, and auditability.

**For Eastern Samar Province:** The system is technically extendable but should **not** yet be presented as province-ready. Province-wide use requires geographic and organizational scale-up: all municipalities and Borongan City must be represented; data must be governed by role and jurisdiction; provincial mutual aid must be formalized; official hazard/forecast feeds must be monitored; and field exercises must prove that information is current under power and communications failure.

> **Operational rule:** Code for Resilience should recommend, organize, record and escalate. Authorized emergency managers must still verify hazards, route safety, shelter safety, field conditions and responder readiness before they warn the public, dispatch a team or direct evacuation.

## References

[1]: https://easternsamar.gov.ph/balangiga-2/ "Province of Eastern Samar — Balangiga municipal profile"
[2]: https://easternsamar.gov.ph/geography/ "Province of Eastern Samar — Geography"
[3]: https://psa.gov.ph/system/files/phcd/2022-12/Table%2520B%2520-%2520Population%2520and%2520Annual%2520Growth%2520Rates%2520by%2520Province%252C%2520City%252C%2520and%2520Municipality%2520-%2520By%2520Region_AGBA_rev.xlsx "Philippine Statistics Authority — Population and annual growth rates by municipality"
[4]: http://balangiga.yolasite.com/municipal-profile.php "Municipality of Balangiga — Municipal profile (historical local profile; values require current validation)"
[5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC4373162/ "Mori et al. (2014), Local amplification of storm surge by Super Typhoon Haiyan in Leyte Gulf"
[6]: https://nhess.copernicus.org/articles/15/1473/2015/ "Lapidez et al. (2015), Identification of storm surge vulnerable areas in the Philippines"
[7]: https://esurf.copernicus.org/articles/3/543/2015/ "May et al. (2015), Block and boulder transport in Eastern Samar during Supertyphoon Haiyan"
[8]: https://experience.arcgis.com/experience/c48f83f81f1548bdb0a76c61638d52d6 "DENR-MGB Geohazard Portal"
[9]: https://hazardhunter.georisk.gov.ph/ "DOST-PHIVOLCS HazardHunterPH"
[10]: https://www.pagasa.dost.gov.ph/climate/climate-change/dynamic-downscaling "DOST-PAGASA climate projections and climate-extremes resources"
[11]: https://link.springer.com/article/10.1007/s13280-021-01608-9 "Community perceptions of long-term mangrove cover changes in a typhoon-prone province"
[12]: ../../frontend/docs/final-action-audit.md "Code for Resilience — Final Command Center Action Audit (internal implementation evidence)"
