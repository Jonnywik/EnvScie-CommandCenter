# Command Map Data Configuration, Verification, and Remaining Improvement Roadmap

## Purpose

This guide explains how Command Center operators and maintainers should configure and verify the **Project NOAH reference hazards** and the **official Balangiga health-facility registry**. It also translates the remaining Command Map roadmap into an ordered implementation sequence. The map is a decision-support workspace: no layer, route, registry listing, or visualization alone authorizes a dispatch, public warning, route-clearance decision, or claim of field safety.

> Treat every geographic layer as evidence to be checked, not as an operational instruction.

## Current Source Inventory

| Data set | Active map representation | API / map path | What it provides | Explicit limit |
| --- | --- | --- | --- | --- |
| Project NOAH flood | `noah-flood-100yr` ground overlay | `GET /v1/gis/noah/context`; `/v1/gis/noah/overlays/noah-flood-100yr` | Modeled 100-year rain-return flood exposure reference | Not a current flood observation or route-clearance finding |
| Project NOAH landslide | `noah-landslide` ground overlay | `GET /v1/gis/noah/context`; `/v1/gis/noah/overlays/noah-landslide` | Shallow and structurally controlled landslide-susceptibility reference | Does not confirm current slope failure or access |
| Project NOAH storm surge | `noah-storm-surge` ground overlay | `GET /v1/gis/noah/context`; `/v1/gis/noah/overlays/noah-storm-surge-scenarios` | Advisory scenarios 1–4 | Does not substitute for an issued warning or local evacuation order |
| Official health-facility registry | Hospital and rural-health-unit markers | `GET /v1/gis/facilities/official-registry` | Source-backed Balangiga facility reference records | Inclusion does not confirm availability, staffing, capacity, access, or mission suitability |

The Project NOAH overlays are locally bounded derivatives of published Eastern Samar geometry and retain provider, dataset, license, attribution, source-date, extent, and decision-limit metadata.[1] The facility layer currently comprises the two government-confirmed health records described below; it is deliberately narrower than an all-facilities inventory.[2] [3]

## Operator Configuration Workflow

### Project NOAH hazard overlays

Open **Command Map**, then select the right-side **Layers** control. In the **Project NOAH reference context** section, turn on only the overlay relevant to the question under review: flood, landslide, or storm-surge scenario. More than one overlay may be shown, but operators should avoid treating combined colors as a calculated composite risk score; they are separate reference models.

Before using an overlay in a briefing, open its metadata card and record the provider, source date, scenario, coverage, and limitation in the incident notes. Confirm that the selected map extent is the Balangiga operating area. Where the map is used with a live SOS, responder, or evacuation-center pin, verify the reported position, data age, and on-the-ground conditions separately. The visual overlap alone does not establish exposure, access, or an action.

| Operator check | Pass condition | If the check fails |
| --- | --- | --- |
| Layer enabled | The intended NOAH control is visibly enabled and an attribution/provenance card is available | Do not use the layer in a decision brief; refresh and report the unavailable reference context |
| Extent | The map is centered on the intended Balangiga incident, resource, or facility location | Reset the map or search/select the correct operational record |
| Provenance | Provider, source date, scenario, and decision limit are visible | Treat the layer as unavailable rather than relying on an unlabeled rendering |
| Operational corroboration | A field report, center coordinator, authorized bulletin, or other appropriate evidence is recorded | Keep the conclusion as unverified reference context; do not change routing or tasking solely from the overlay |

### Official facility registry

Select **Facilities** from the map tool rail, then enable **Show source records**. Use the **Hospitals** and **Rural health units** category filters to reduce marker clutter. Select a marker to open its reference sheet. The sheet identifies the facility category, public source, reference address, provisional map placement where applicable, and **LGU verification required** status.

For every facility considered in an incident, the duty officer should confirm the location pin with the LGU/DRRMO or facility contact, then separately verify operating status, staffing, capacity, access route, communications, supplies, and the specific capability needed. A source registry confirms that the listed facility is recognized in the cited government directory; it does not prove present readiness.[2] [3]

| Facility verification field | Required confirmation method | Status to record |
| --- | --- | --- |
| Pin location | LGU/DRRMO mapping review or direct facility confirmation | `location verified` or `location needs correction` |
| Current availability | Direct facility or DRRMO contact | `reported available`, `reported constrained`, or `unconfirmed` |
| Capacity and capability | Current facility/DRRMO report, including time | `reported` with timestamp, or `unconfirmed` |
| Access and route | Field team, road authority, or authorized local report | `field verified`, `avoid`, or `unconfirmed` |
| Evidence source | Operator note, call log, or authorized report | Link or reference retained in incident/audit record |

## Maintainer Configuration and Release Checks

The source APIs are read-only and must continue to expose provenance and decision-limit fields. A source refresh or registry expansion should follow the sequence below rather than editing map geometry or facility details directly in the browser.

1. **Acquire data through a documented, permitted source.** Preserve the original source URL, publisher, license, publication or observation date, geographic scope, and retrieval date. Do not scrape NOAH Studio or bypass a registry CAPTCHA.
2. **Validate the import before exposure.** Check schema, coordinate reference system, geometry validity, Balangiga/Eastern Samar bounds, duplicate facility identifiers, source timestamps, and category mapping. Keep an import manifest and reject rows that lack a source or fall outside approved coverage.
3. **Store provenance with every visible record.** Hazard layers require provider, license, data/model date, scenario, coverage, and limitation. Facilities require source URL, category, reference address, placement origin, coordinate-validation state, and an explicit non-operational decision limit.
4. **Run automated checks.** Run backend endpoint tests, frontend map-context and compact-UI tests, TypeScript validation, and a production build. Verify the NOAH context endpoint, each approved overlay path, and the facility-registry endpoint return expected records and reject unsupported paths.
5. **Run hosted checks.** Open the layer drawer; enable each NOAH overlay; toggle facility records and both category filters; select a facility marker; and test dark/light appearance plus a narrow viewport. Confirm no control overlaps the responder radar, navigation dock, or map sheets.
6. **Record the release.** Update source metadata, import date, validation outcome, known limitations, and operator communication. Roll back or disable a layer if the source is unavailable, inconsistent, expired, or unauthorized.

## Verification Commands and Evidence

Maintainers can verify the server contracts locally through the existing service endpoints:

```bash
curl -fsS http://127.0.0.1:8000/v1/gis/noah/context
curl -fsS -o /tmp/noah-flood.png \
  http://127.0.0.1:8000/v1/gis/noah/overlays/noah-flood-100yr
curl -fsS http://127.0.0.1:8000/v1/gis/facilities/official-registry

cd frontend && pnpm test && pnpm exec tsc --noEmit
cd frontend && NODE_ENV=production pnpm exec next build
cd backend && pytest -q
```

The command examples validate transport and application contracts only. They do not verify the current real-world condition of a hazard, road, facility, or responder.

## Remaining Map Feature Improvements

The following sequence completes the map as an operational decision-support tool while keeping human verification and authorization at the center of every consequential action.

| Priority | Workstream | Implementation detail | Dependency | Acceptance criterion |
| --- | --- | --- | --- | --- |
| 1 | Unified map state and fast triage | Persist extent, basemap, layers, selected entity, freshness filters, and verified-only state; connect selection to Incident, Field Response, and Community Safety workspaces | Existing map controls and five-workstream navigation | An operator can filter and open a selected entity in the correct workspace without losing spatial context |
| 2 | Layer catalogue and source health | Standardize provider, license, coverage, refresh interval, last success, freshness, outage state, and limitations for every layer | Existing NOAH, RainViewer, PAGASA, and facility metadata | Every enabled layer visibly exposes source, age, limitation, and fallback state |
| 3 | Incident map workspace and evidence packet | Build an incident-focused map view with accuracy radius, hazards, nearby resources, center context, notes, and a timestamped evidence packet | Incident/audit records | The packet captures what was shown and states that it is not a dispatch or safety authorization |
| 4 | Facility-registry maturation | Add a role-controlled import/validation workflow; expand only through an authorized NHFR, LGU/DRRMO, or other government source; retain category, coordinate, and readiness-validation state separately | Authorized registry export or LGU data-sharing agreement | New records are provenance-backed, deduplicated, locally validated, and never shown as live-ready by default |
| 5 | Proposed-route comparison and center suitability | Display several proposed routes with data age, hazard intersections, constraints, and manual review status; explain center suitability criteria | Existing route contract; verified road/center inputs | No route is labeled clear or automatically issued; field verification is explicit and auditable |
| 6 | Resource history and review geofences | Add low-clutter breadcrumb history, accuracy bands, tracking-health panel, and auditable review-only geofence events | Telemetry retention and role controls | A geofence event becomes a review item, never an automatic reroute, warning, or dispatch |
| 7 | Authorized field observations | Allow authorized reports of water depth, obstruction, bridge condition, center status, and communications gaps with source, confidence, expiry, and review state | Role model, audit log, file storage, offline conflict handling | Unverified observations are distinct and cannot silently change a route or hazard state |
| 8 | Time, offline, and handover | Add historical-time selector, age-labeled offline package, reconciliation workflow, and duty-officer handover summary | Retention policy, cached basemap/reference data, conflict review | Cached context is never labeled live and handover preserves open map evidence and stale-data warnings |
| 9 | Performance and accessible equivalents | Add clustering, viewport-based loading, geometry simplification, load shedding, keyboard marker list, text equivalents, reduced motion, and high-contrast checks | Spatial query/telemetry load profile | Critical SOS/resource/hazard context stays responsive under load and remains accessible without visual map interaction |

## Provider-Onboarding Gate for Future Layers

New weather, radar, lightning, station, satellite, or facility feeds must remain disabled until the provider contract, permitted use, coverage, attribution, refresh behavior, rate limit, outage behavior, and data-quality limits are documented. For public layers that do not provide an official event stream, use a bounded periodic refresh with a cache and visible last-success timestamp. Use continuous/event-driven ingestion only where the provider supports it and the operational need justifies authentication, idempotency, retry queues, and monitoring.

## Safety Controls That Must Remain Non-Negotiable

- Never auto-dispatch a team, message the public, issue an order, or change a safety status from map output alone.
- Never call a proposed route clear from imagery, missing hazard geometry, or a modeled reference overlay.
- Never treat a registry listing as evidence of present facility readiness.
- Never present cached, replayed, or stale data as live.
- Keep every manual verification, route review, facility update, and field observation attributable and auditable.

## References

[1]: https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps "BetterGov.PH — Project NOAH Hazard Maps"
[2]: https://ro8.doh.gov.ph/list-of-rural-health-units/ "Department of Health Eastern Visayas CHD — List of Rural Health Units"
[3]: https://ntp.doh.gov.ph/resources/facilities/?yiiwp-page=7 "Department of Health National Tuberculosis Control Program — Facilities"
