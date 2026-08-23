# Project NOAH Command Map Integration

## Implemented Reference Hazard Context

The Command Map now includes three independently controlled Project NOAH reference overlays for the Balangiga operating area: a **100-year rain-return flood exposure** layer, a **shallow and structurally controlled landslide-susceptibility** layer, and **storm-surge advisory scenarios 1–4**. The source geometry is drawn from the published Eastern Samar assets in the Project NOAH Hazard Maps collection and is rendered as bounded local overlays to avoid loading province-wide multipart geometry in the operator’s browser.[1]

Each overlay is exposed through a provenance-aware API contract that records the provider, dataset title, dataset URL, ODbL 1.0 license, attribution, source geometry dates, operating-area extent, scenario label, and decision limit. The map drawer shows the source/permission label and repeats that these are modeled reference layers, not live observations, route-clearance findings, facility-status confirmations, dispatch orders, or public warnings.

## Hosted Validation

The hosted Command Map loaded the Project NOAH section after the FastAPI service was restarted from the updated backend. Its drawer displayed the three accessible controls, a Project NOAH / UP Resilience Institute ODbL 1.0 provenance link, and the facility-source notice. The production API returned the expected context metadata and bounded overlay endpoints; automated regression coverage verifies source provenance, known overlay allow-list behavior, PNG delivery, missing-layer rejection, and safety language.

The flood reference toggle was enabled in the hosted Google Maps canvas. Its control reported an enabled state and the selected source overlay was registered through the bounded `/api/v1/gis/noah/overlays/noah-flood-100yr` map-overlay path. The imagery is intentionally not interpreted as a current flood observation.

## Critical-Facility Data Status

NOAH Studio presents critical-facility context, but the research performed for this release did not identify a documented machine-readable Project NOAH facility download or service endpoint that could be reused safely. The Command Map therefore **does not scrape the NOAH Studio web map and does not fabricate a facility list**. The drawer exposes a direct NOAH Studio reference link and clearly identifies the facility feed as source-access unconfirmed.

When an authorized facility dataset or documented service is supplied, the next safe increment is to onboard it through a versioned import with category mapping, provenance, local LGU verification, conflict review, and a source/validation state on every facility record. Existing local evacuation-center information remains separate and is never represented as Project NOAH facility data.

## Data Limits

> These modeled layers provide geographic exposure context only. Field verification, center-coordinator confirmation, and authorized command decisions remain required before changing routes, tasking responders, or communicating to the public.

## References

[1]: https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps "BetterGov.PH — Project NOAH Hazard Maps"
