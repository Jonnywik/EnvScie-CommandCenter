# Official Facility Registry — Command Map Validation

## Scope and Sources

The Command Map now presents a small, explicitly bounded government-reference registry for Balangiga: **Albino M. Duran Memorial Hospital** from the DOH National Tuberculosis Control Program directory and **Balangiga Rural Health Unit** from the DOH Eastern Visayas rural-health-unit list.[1] [2] The record set is intentionally limited to the facility categories and entities confirmed in those sources.

| Facility | Government reference source | Map placement | Validation state |
| --- | --- | --- | --- |
| Albino M. Duran Memorial Hospital | DOH National Tuberculosis Control Program facility directory | Google Maps Plus Code `494R+XGH`, derived from official facility name and address | **LGU verification required** |
| Balangiga Rural Health Unit | DOH Eastern Visayas rural-health-unit list | Google Maps Plus Code `495P+PHX`, derived from official facility name | **LGU verification required** |

## Functional Checks

The read-only endpoint `/v1/gis/facilities/official-registry` returned the registered provider, scope, decision limit, two facility records, official source URLs, category values, and the `needs_lgu_verification` coordinate status. Backend regression coverage confirms that source URLs are HTTPS, both facilities remain source-backed, and the API does not represent either record as a readiness or availability claim.

In the hosted Command Map, the **Facilities** control opened without displacing the command header, responder radar, map navigation rail, or broadcast control. Its panel exposed a source-record switch, independent Hospital and Rural health unit filters, a limited-official-coverage description, and an explicit decision limit. Enabling the source-record layer placed the `H` hospital and `+` rural-health-unit markers, which remained visually distinct from operational resource markers. Selecting the hospital opened an inspector containing its cited DOH source, provisional placement, pin-validation status, and a warning that registry inclusion does not confirm staffing, access, capacity, supplies, communications, or mission suitability.

The hosted light appearance retained readable treatment for the facility trigger, registry panel, category filters, source link, and inspector, while the facility markers and validation warning remained visible over the light road basemap.

## Safety Boundary

> This registry is **reference context**. It must not be used alone to infer facility readiness, shelter capacity, patient capability, road access, communications, or field safety. The LGU/DRRMO must validate the pin and current status before operational use.

## Validation Results

| Check | Result |
| --- | --- |
| Frontend Vitest suite | 16 tests passed |
| Frontend TypeScript check | Passed |
| Backend pytest suite | 35 tests passed |
| Next.js production build | Passed |
| Hosted facility-control, filters, marker, inspector, provenance, and safeguard checks | Passed |

## References

[1]: https://ntp.doh.gov.ph/resources/facilities/?yiiwp-page=7 "Department of Health National Tuberculosis Control Program — Facilities"
[2]: https://ro8.doh.gov.ph/list-of-rural-health-units/ "Department of Health Eastern Visayas CHD — List of Rural Health Units"
