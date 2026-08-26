export type RoutePoint = { latitude: number; longitude: number; label: string };
export type ActiveClosure = { id: string; latitude: number; longitude: number; name: string; barangay: string; severity: "advisory" | "watch" | "warning" | "critical" };
export type RouteStep = { instruction: string; distanceMeters: number; durationSeconds: number };
export type SafeRoute = { waypoints: RoutePoint[]; avoidedClosures: ActiveClosure[]; estimatedDistanceKm: number; guidance: string; source: "road-network" | "reference-fallback"; durationMinutes: number; steps: RouteStep[] };
export function aggregateRouteLegs(legs: Array<{ distance: { value: number }; duration: { value: number }; steps: Array<{ html_instructions: string; distance: { value: number }; duration: { value: number } }> }>) { return { distanceMeters: legs.reduce((total, leg) => total + leg.distance.value, 0), durationSeconds: legs.reduce((total, leg) => total + leg.duration.value, 0), steps: legs.flatMap((leg) => leg.steps.map((step) => ({ instruction: step.html_instructions, distanceMeters: step.distance.value, durationSeconds: step.duration.value }))) }; }

const earthKm = 6371;
const radians = (value: number) => value * Math.PI / 180;
const distanceKm = (from: RoutePoint, to: RoutePoint) => {
  const lat = radians(to.latitude - from.latitude);
  const lon = radians(to.longitude - from.longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(lon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function proximityToSegment(point: ActiveClosure, origin: RoutePoint, destination: RoutePoint) {
  const x = origin.longitude; const y = origin.latitude;
  const dx = destination.longitude - x; const dy = destination.latitude - y;
  const length = dx * dx + dy * dy;
  const projection = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.longitude - x) * dx + (point.latitude - y) * dy) / length));
  const nearest = { latitude: y + projection * dy, longitude: x + projection * dx, label: "nearest" };
  return { projection, distance: distanceKm({ latitude: point.latitude, longitude: point.longitude, label: point.name }, nearest) };
}

export function calculateClosureAwareRoute(origin: RoutePoint, destination: RoutePoint, closures: ActiveClosure[]): SafeRoute {
  const onCourse = closures.map((closure) => ({ closure, ...proximityToSegment(closure, origin, destination) })).filter((item) => item.distance <= 3.5).sort((a, b) => a.projection - b.projection);
  const detours = onCourse.map(({ closure, projection }, index) => {
    const latitudeOffset = index % 2 === 0 ? 0.018 : -0.018;
    const longitudeOffset = projection < 0.5 ? -0.018 : 0.018;
    return { latitude: closure.latitude + latitudeOffset, longitude: closure.longitude + longitudeOffset, label: `Detour around ${closure.name}` };
  });
  const waypoints = [origin, ...detours, destination];
  const segments = waypoints.slice(1).map((waypoint, index) => Math.round(distanceKm(waypoints[index]!, waypoint) * 1000));
  const estimatedDistanceKm = segments.reduce((total, meters) => total + meters, 0) / 1000;
  const steps = waypoints.slice(1).map((waypoint, index) => { const distanceMeters = segments[index] ?? 0; return { instruction: index === waypoints.length - 2 ? `Continue to ${destination.label}.` : `Use the detour around ${waypoint.label.replace("Detour around ", "")}.`, distanceMeters, durationSeconds: Math.max(60, Math.round(distanceMeters / 8.33)) }; });
  const durationMinutes = Math.max(1, Math.round(steps.reduce((total, step) => total + step.durationSeconds, 0) / 60));
  return { waypoints, avoidedClosures: onCourse.map((item) => item.closure), estimatedDistanceKm: Math.round(estimatedDistanceKm * 10) / 10, guidance: onCourse.length ? "Reference detour keeps clear of active verified closures. Confirm actual road access with the LGU before travel." : "No active verified closure intersects this reference route. Confirm actual road access with the LGU before travel.", source: "reference-fallback", durationMinutes, steps };
}

const decodePolyline = (encoded: string): RoutePoint[] => { let index = 0; let lat = 0; let lng = 0; const points: RoutePoint[] = []; while (index < encoded.length) { let shift = 0; let result = 0; let byte: number; do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); lat += result & 1 ? ~(result >> 1) : result >> 1; shift = 0; result = 0; do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); lng += result & 1 ? ~(result >> 1) : result >> 1; points.push({ latitude: lat / 1e5, longitude: lng / 1e5, label: "Road-network path" }); } return points; };

const cleanInstruction = (instruction: string) => instruction.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export async function calculateRoadNetworkSafeRoute(origin: RoutePoint, destination: RoutePoint, closures: ActiveClosure[], directionsRequest: (origin: RoutePoint, destination: RoutePoint, detours: RoutePoint[]) => Promise<{ status: string; encodedPath?: string; distanceMeters?: number; durationSeconds?: number; steps?: RouteStep[] }>): Promise<SafeRoute> {
  const reference = calculateClosureAwareRoute(origin, destination, closures);
  try {
    const response = await directionsRequest(origin, destination, reference.waypoints.slice(1, -1));
    if (response.status !== "OK" || !response.encodedPath) return reference;
    const steps = response.steps?.map((step) => ({ ...step, instruction: cleanInstruction(step.instruction) })).filter((step) => step.instruction) ?? reference.steps;
    return { ...reference, waypoints: decodePolyline(response.encodedPath), estimatedDistanceKm: Math.round((response.distanceMeters ?? reference.estimatedDistanceKm * 1000) / 100) / 10, durationMinutes: response.durationSeconds ? Math.max(1, Math.round(response.durationSeconds / 60)) : reference.durationMinutes, steps, guidance: reference.avoidedClosures.length ? "Road-network route rerouted around active verified closures. Confirm conditions with the LGU before travel." : "Road-network route has no active verified closure on its current path. Confirm conditions with the LGU before travel.", source: "road-network" };
  } catch { return reference; }
}
