import type { DirectionDestination } from "@/lib/directions";

export type VerifiedClosure = { id: string; latitude: number; longitude: number; name: string; barangay: string; severity: "advisory" | "watch" | "warning" | "critical" };
export type DirectionsTravelMode = "driving" | "walking" | "motorcycle";

export const travelModeMeta: Record<DirectionsTravelMode, { label: string; mapsMode: "driving" | "walking"; note: string }> = {
  driving: { label: "Drive", mapsMode: "driving", note: "Uses the available road route." },
  walking: { label: "Walk", mapsMode: "walking", note: "Walking access may differ from vehicle roads." },
  motorcycle: { label: "Motorcycle", mapsMode: "driving", note: "Uses the road route; confirm motorcycle access locally." },
};

const pointToSegmentKm = (point: VerifiedClosure, origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
  const dx = destination.longitude - origin.longitude; const dy = destination.latitude - origin.latitude;
  const length = dx * dx + dy * dy;
  const projection = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.longitude - origin.longitude) * dx + (point.latitude - origin.latitude) * dy) / length));
  const latitude = origin.latitude + projection * dy; const longitude = origin.longitude + projection * dx;
  const latKm = (point.latitude - latitude) * 111;
  const lonKm = (point.longitude - longitude) * 111 * Math.cos(latitude * Math.PI / 180);
  return Math.sqrt(latKm ** 2 + lonKm ** 2);
};

export function findRouteAreaClosures(closures: VerifiedClosure[], destination: DirectionDestination, origin = { latitude: 11.1086, longitude: 125.3877 }) {
  if (destination.latitude === undefined || destination.longitude === undefined) return [];
  return closures.filter((closure) => pointToSegmentKm(closure, origin, { latitude: destination.latitude!, longitude: destination.longitude! }) <= 3.5);
}
