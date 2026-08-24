# Dispatch Selector ETA and Detail Release

The dispatch team selector now presents an ETA planning estimate for each reported response group. The value is recalculated from the group’s latest reported location to the selected SOS coordinates whenever the selector is opened. It displays direct-distance kilometres and an estimated travel time using a documented asset-class planning speed plus a short setup allowance.

| Asset signal | Planning speed used | What the estimate is not |
|---|---:|---|
| Boat or marine asset | 18 km/h | A navigation, water-access, launch-authority, or pier-safety finding. |
| Ambulance, truck, or van | 28 km/h | A road-routing, traffic, hazard, or route-clearance finding. |
| Other reported asset | 12 km/h | A commitment, deployment order, notification, or field-safety confirmation. |

The selector now supports free-text search across team name, call sign, asset, and specialty, together with availability filters for available-and-ready, limited, assigned, and all reported non-offline teams. Only records reported as both `available` and `ready` expose the team-selection action; other visible rows explain why they cannot be selected.

Each team row has an expandable **View roster & equipment inventory** section. Roster entries are role-level counts and readiness states rather than personal identity records. The production model adds `response_group_roster` so an authorized data workflow can store role title, count, readiness, source reference, and verification timestamp. When a live source does not provide roster details, the interface states that the information is unavailable rather than inventing personnel data.

> ETA, availability, equipment, and roster information remain decision-support context. Selecting an eligible group still creates only a pending proposal; an explicit human confirmation is required before a dispatch record is made.

Validation completed with 39 backend tests, 17 frontend tests, TypeScript validation, an optimized production build, and hosted restart availability.
