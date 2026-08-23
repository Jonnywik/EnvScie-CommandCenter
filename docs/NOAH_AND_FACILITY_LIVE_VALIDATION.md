# Project NOAH and Official Facility Registry — Live Validation

**Status:** Passed after targeted Project NOAH overlay-rendering restoration  
**Validation target:** Hosted EnvScie Command Center, Command Map  
**Validation date:** 23 August 2026, Philippine Standard Time (PST)

## Project NOAH Live-Map Evidence

The hosted Command Map loaded Google Maps road tiles, operational markers, the Project NOAH layer drawer, and the official-facility entry point. The same-origin `GET /api/v1/gis/noah/context` contract returned HTTP 200 and three approved overlay records: `noah-flood-100yr`, `noah-landslide`, and `noah-storm-surge-scenarios`. Each record declared the Balangiga focus bounds and a same-origin overlay endpoint.

The layer drawer displayed the Project NOAH / UP Resilience Institute attribution, the ODbL-1.0 provenance label, and an explicit statement that these layers are modeled reference context only. All three controls were exercised individually, with each switch changing to `aria-checked="true"`, each approved same-origin image endpoint requested by the browser, and each ground overlay visibly painted over the Google map. The flood-return and landslide controls were then disabled individually and their active map image nodes were removed.

| Reference layer | Approved map endpoint observed live | Render result | Removal result |
|---|---|---|---|
| Flood · 100-year rain return | `/api/v1/gis/noah/overlays/noah-flood-100yr` | Rendered as a `699 × 712` GroundOverlay image. | Switch returned to `false`; no active flood image remained. |
| Landslide susceptibility | `/api/v1/gis/noah/overlays/noah-landslide` | Rendered as a `699 × 712` GroundOverlay image. | Visual removal confirmed before the next layer was enabled. |
| Storm-surge scenarios 1–4 | `/api/v1/gis/noah/overlays/noah-storm-surge-scenarios` | Rendered as a `699 × 712` GroundOverlay image. | Disabled cleanly before the official-facility workflow check. |

The initial live test disclosed three related implementation defects: constructed GroundOverlay instances were not attached to the map, image URLs were not resolved to absolute same-origin URLs, and the Command Map bridge did not forward the three Project NOAH switch states to the Google renderer. The renderer now calls `setMap(map)`, resolves each approved overlay URL against `window.location.origin`, and forwards `noahFlood`, `noahLandslide`, and `noahStormSurge`. Regression, type, and production-build checks passed after the repair.

## Official Facility Registry — Live Evidence

The hosted `GET /api/v1/gis/facilities/official-registry` contract returned two records and a clear decision limit. Albino M. Duran Memorial Hospital is a `hospital` sourced from the DOH National Tuberculosis Control Program directory at `https://ntp.doh.gov.ph/resources/facilities/?yiiwp-page=7`; Balangiga Rural Health Unit is a `rural_health_unit` sourced from the DOH Eastern Visayas rural-health-unit list at `https://ro8.doh.gov.ph/list-of-rural-health-units/`. Both records are public facilities whose `coordinate_validation_status` is `needs_lgu_verification`.

When **Show source records** was enabled, the map presented separate, accessible marker hints for both facilities, each explicitly labelled as an official registry reference requiring LGU verification. The **Hospitals** and **Rural health units** controls were exercised independently: either category could be hidden, both categories could be hidden with no official markers remaining, and enabling Hospitals alone restored only the hospital marker.

Selecting the hospital marker opened the **Official facility registry information sheet**. The sheet stated the hospital category and public ownership; identified its pin as `needs lgu verification`; displayed its provisional coordinates and address; linked to the official DOH source; explained the coordinate source; and stated that registry inclusion does not confirm staffing, access, capacity, supplies, communications, or mission suitability. Its close control was available and successfully closed the sheet.

With Hospitals hidden and Rural health units enabled, the map showed only the Balangiga Rural Health Unit marker. Its inspector supplied the `rural health unit` category and public ownership, `needs lgu verification` status, provisional placement (`11.10936, 125.38648`), map-search-referenced address, DOH Eastern Visayas source link, coordinate source, and the same prohibition on inferring readiness or suitability. The close control also dismissed this information sheet successfully.

The facility drawer opened after the Project NOAH drawer closed, confirming the expected mutually exclusive panel behavior. In the hosted desktop layout, the facility controls, inspector, Google Map, and responder-radar drawer occupied separate regions without overlap.

## Safety Boundary

Project NOAH overlays are retained as static modeled decision-support context. They are not presented as a live hazard observation, route-clearance finding, facility-status confirmation, dispatch order, or public warning. The official facility registry validation follows the same reference-only and LGU/DRRMO verification boundary.

## Validation Conclusion

The hosted Command Map passed the requested Project NOAH and official-facility workflow checks after the three renderer defects were corrected. The map now visibly renders each approved, bounded NOAH reference overlay when its control is enabled and removes it when disabled. The two integrated official facility references load from their documented government sources, filter independently, and expose the required provenance and LGU-verification safeguards in their inspector sheets. No automatic dispatch, route-clearance, public-warning, or facility-readiness claim was introduced or observed.
