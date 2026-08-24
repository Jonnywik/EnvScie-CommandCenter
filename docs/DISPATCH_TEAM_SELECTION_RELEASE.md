# Dispatch Team Selection Release

The Triage & Dispatch workspace now changes the primary recommendation action from immediate proposal creation to **Select dispatch team**. After the existing LGU verification checklist is complete, the control opens a contained list of response groups currently reported as both `available` and `ready`.

Each selection row shows the group’s asset, personnel count, reported location, readiness score, specialty list, last check-in age, and its advisory rank when it appears in the recommendation result. Selecting a group creates a **pending dispatch proposal only**. The existing human confirmation panel remains the sole path for recording the dispatcher’s confirmation, and notification or reported-unit acknowledgement remains separate.

> Selection does not dispatch a unit, establish route clearance, prove field safety, or send a notification. Operators must verify current field conditions and use the explicit confirmation step before recording any dispatch decision.

The implementation passed frontend regression tests, TypeScript validation, and an optimized production build. The hosted Command Center was restarted and opened to verify the updated Incidents workflow is available.
