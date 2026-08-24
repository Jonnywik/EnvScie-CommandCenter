# Triage Queue Dispatch Team Selector Placement

The **Dispatch response team** action in the Triage Queue SOS drawer now opens the team-selection panel directly. This replaces the former immediate `acknowledged → dispatched` status action with a safe, reviewable proposal workflow at the point where a coordinator triages an acknowledged SOS.

The selector retains all released decision-support details: reported-location ETA estimate, role roster, equipment inventory, search, and availability filters. Selecting an eligible team creates a **pending confirmation proposal**, not a dispatch order. The proposal must still be reviewed and confirmed through the separate human dispatch-lifecycle control.

> Triage Queue selection does not update the SOS to `dispatched`, send a notification, establish route clearance, or verify field safety. It records only the coordinator’s selected candidate for later human confirmation.

The correction was validated with the frontend regression suite, TypeScript validation, optimized production build, and a hosted smoke test. The hosted test opened an acknowledged SOS, selected **Dispatch response team**, and confirmed that the selector renders in the drawer with two eligible reported teams, ETA, roster and equipment details, filters, and no automated tasking action.
