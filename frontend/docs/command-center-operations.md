# Command Center Operations Model

The Command Center is organized around the municipal incident-management loop: **detect, verify, decide, dispatch, communicate, shelter, and account**. Every subtab should answer three questions for the duty officer: what is happening now, what decision is required next, and who owns the follow-through.

## Subtab responsibilities

| Subtab | Primary operating question | Required information | Core actions |
| --- | --- | --- | --- |
| Overview | What is the current operational picture? | Incident phase, operating period, objectives, key metrics, open tasks, latest sync | Refresh snapshot, open the highest-priority queue item, publish an approved bulletin |
| Live SOS | Who needs assistance and what is the next life-safety action? | Severity, status, channel, location confidence, barangay, summary, responder ownership, age | Acknowledge, dispatch, resolve, mark false alarm, record handover note |
| Verified Alerts | Which hazards and public warnings are trusted? | Source health, severity, hazard, issue/expiry, affected area, public instruction, verification status | Review feed health, re-sync configured feeds, prepare a bulletin, record verification |
| Risk Map | Where are hazards, requests, centers, and safe routes relative to one another? | Active hazard layers, road constraints, SOS positions, center locations, route safety timestamp | Toggle layers, inspect hazard action, preview safe route, record map verification |
| Evacuation Centers | Can each center safely receive the next group of evacuees? | Capacity, occupancy, status, amenities, center manager, intake readiness, supply gaps | Verify capacity, open/close center, assign barangay, record resupply request |
| Resources | Which people, vehicles, equipment, medical, relief, and communications assets are ready? | Available/total, location, owner, deployment state, replenishment threshold | Deploy, reserve, request resupply, record accountability check |

## Operational guardrails

The interface keeps cached data visibly labeled, shows the last verified timestamp, and records consequential actions in the audit trail. Demo mode uses the same action shapes as live mode so that drills exercise the actual decision flow without implying that seed data is a live government feed. Production deployment still requires authenticated users, verified external feeds, real center-manager updates, and an approved public-information workflow.

## Operating-period rhythm

The dashboard exposes a short list of incident objectives, a prioritized task board, communications acknowledgements, barangay readiness, hazard verification, and team status. Together these provide a compact common operating picture for shift handover, briefing, dispatch coordination, and after-action review.
