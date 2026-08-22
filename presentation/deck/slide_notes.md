# 1 - Code for Resilience

When ordinary systems fail during a crisis, our communities need more than temporary fixes. We are presenting an architecture and command-center platform built specifically for Balangiga and Eastern Samar. This platform delivers local action even when the network goes dark. Let us examine how we maintain resilience where it matters most.

# 2 - The operating reality is fragmented during a crisis

Typhoons and flash floods create a rapidly fragmenting operating reality on the ground. When power and signal drop, residents lose access to reliable updates just as local risks spike. Responders need a shared operational picture rather than isolated alert feeds. This challenge demands a dedicated local response loop.

# 3 - One system connects warning, movement, and assistance

We connect warning, movement, and assistance into one continuous system. Residents receive verified alerts and request help, while municipal teams triage and dispatch responders. Resilient transport shifts seamlessly from internet to compact SMS when connectivity degrades. Cached information remains vital, but every record stays visibly marked for re-verification.

# 4 - A layered architecture keeps critical actions local

A layered architecture keeps critical actions local during major disruptions. The system separates the React Native mobile client, the resilient transport layer, the FastAPI service, and the PostGIS spatial core. This structure ensures an outage in one layer never stops local response work.

# 5 - Offline SOS turns a weak signal into an actionable record

Offline SOS turns a weak signal into an actionable dispatch record. We capture a minimal emergency packet, encode it for a single SMS, and protect it with CRC validation. The durable outbox preserves the request until delivery while keeping the original channel visible to operators.

# 6 - Spatial intelligence routes people away from active flood zones

Spatial intelligence routes people away from active flood zones by applying a strict safety constraint. We store flood and landslide areas as versioned PostGIS polygons alongside open evacuation centers. Before any route calculation runs, the system filters out road segments intersecting active flood zones. Then Dijkstra runs over the remaining local road graph to return the nearest safe center. And because our routing is explainable by design, the command view clearly shows the active hazard, the excluded crossings, and the selected path. Building on how offline SOS captures critical emergency records, this spatial core turns coordinates into safe navigation. Let us now look at how the LGU dashboard manages these incoming signals.

# 7 - The LGU dashboard turns incoming signals into a triage queue

The LGU dashboard turns incoming signals into a triage queue that gives responders a single, scannable operational picture. We combine situation metrics, live hazard maps, and a priority SOS queue so dispatchers can assess severity, age, channel, and confidence at a glance. Responders use the triage drawer to acknowledge incidents, dispatch teams, resolve cases, and preserve full history. Official LGU alerts remain strictly separated from community reports to maintain information trust during a crisis. Following our spatial routing rules, incident urgency and information trust are both visible before anyone is dispatched. This forms the foundation of our rapid response loop.

# 8 - The response loop is designed for the first critical minutes

The response loop is designed for the first critical minutes of an emergency. We turn raw reports into safer actions by linking verification, location, routing, dispatch, and continuous operational updates. Responders verify alert sources, read exact coordinates and channel confidence, and route evacuees away from active hazards. Then they dispatch the right team and reconcile new reports and shelter capacities in real time. Building on the triage queue we just reviewed, this cycle ensures that the newest verified hazard information constrains every single decision. Let us examine the actual technical foundation that makes this workflow possible.

# 9 - The current build is a runnable foundation

The current build is a runnable foundation rather than a black box. We have implemented a FastAPI backend with dashboard, alert, evacuation, route, SOS, and triage endpoints. The Next.js command center provides a responsive LGU view with map visualization and interactive triage controls. On the mobile side, the Expo prototype includes cached feeds, connectivity monitoring, and a durable SOS outbox with SMS fallback. All backend tests pass, the dashboard production build is stable, and our TypeScript checks pass cleanly. Building upon our critical response loop, this demo baseline proves that our core workflows operate end-to-end today. Let us now turn to what it takes to reach full operational readiness.

# 10 - From prototype to operational readiness

From prototype to operational readiness requires importing validated municipal GIS layers, center records, and official alert feeds. We must secure our municipal operations with role-based access, audit logs, and rate limits while testing SMS gateways across delayed or duplicated traffic. Conducting field exercises with barangays, carriers, and responders will ensure our architecture performs under real-world stress. A resilient system is ultimately ready when the safest next action remains available even when the network is not.
