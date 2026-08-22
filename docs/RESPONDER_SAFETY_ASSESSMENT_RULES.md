# Verified SOS Responder-Safety Assessment Rules

## Purpose and operating boundary

The Command Center will calculate an **explainable responder-safety decision-support score** for a verified SOS incident. It is not a prediction of safety, an automatic dispatch authorization, or a field clearance. The duty officer remains responsible for confirming current conditions, approving a task plan, and stopping or changing an assignment when conditions worsen.

## Design basis

UNDRR defines disaster risk as a function of hazard, exposure, vulnerability, and capacity. For responder safety, the Command Center will retain those concepts but use a bounded operational score with explicit controls:

> **Responder safety risk = weighted hazard + exposure + vulnerability − readiness and protective controls.**

The score is an operational prioritization aid rather than a scientific hazard model. Every displayed risk band must include the contributing factors, source timestamps, missing-data warnings, and the protective controls needed before a coordinator may assign a team.

| Dimension | Proposed incident or team evidence | Score effect |
|---|---|---|
| Hazard | Verified SOS urgency, active hazard-zone overlap, flood-risk review state, current weather/typhoon evidence | Increases risk |
| Exposure | Distance to the incident, unsafe or constrained route, time in hazard-prone areas | Increases risk |
| Vulnerability | Team specialty mismatch, low readiness, unavailable equipment, low communications confidence | Increases risk |
| Capacity and controls | Relevant specialty, readiness, route confirmation, communications check, buddy/team accountability, protective equipment confirmation | Reduces risk |

## Freshness and uncertainty gates

The assessment must return **REVIEW REQUIRED** rather than a low-risk recommendation when any decisive weather, route, position, readiness, or communications input is missing or stale. Project NOAH layers remain static flood-susceptibility and return-period context; they do not prove current water level, route passability, or a safe approach.

## Required task information

For a reviewed responder assignment, the Command Center view must show the verified incident location and urgency, designated team and specialty, current position and readiness, hazard and route constraints, communications channel and check-in cadence, recommended protective controls, medical or extraction contingency, and the named coordinator responsible for approval. The field-team view must state that it is a task briefing for verification, not a safety clearance.

## Required safeguards

The assessment must not send a public message, change an SOS verification state, dispatch a unit, or mark a route safe. It must create an auditable assessment record with the exact factors, score, risk band, timestamps, uncertainty state, and task-control checklist. A coordinator must explicitly approve any later assignment through the existing guarded dispatch workflow.

## Sources

1. UNDRR, [Disaster risk terminology](https://www.undrr.org/terminology/disaster-risk), which describes disaster risk as a function of hazard, exposure, vulnerability, and capacity.
2. UNDRR, [Exposure terminology](https://www.undrr.org/terminology/exposure), which explains that exposed people and assets can be combined with vulnerability and capacity when estimating risk.
3. OSHA, [Emergency Preparedness and Response: Getting Started](https://www.osha.gov/emergency-preparedness/getting-started), which emphasizes hazard assessment, assigned emergency responsibilities, communication, route planning, and worker accounting.
