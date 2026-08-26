import { describe, expect, it } from "vitest";
import { aggregateRouteLegs, calculateClosureAwareRoute, calculateRoadNetworkSafeRoute } from "./safe-route";

const origin = { latitude: 11.1086, longitude: 125.3877, label: "Balangiga town center" };
const destination = { latitude: 11.185, longitude: 125.286, label: "Lawaan reference area" };

describe("closure-aware route guidance", () => {
  it("adds a detour waypoint around an active verified closure lying on the direct route", () => {
    const route = calculateClosureAwareRoute(origin, destination, [{ id: "verified-1", name: "Coastal approach", barangay: "Poblacion", latitude: 11.145, longitude: 125.338, severity: "warning" }]);
    expect(route.avoidedClosures.map((closure) => closure.id)).toEqual(["verified-1"]);
    expect(route.waypoints).toHaveLength(3);
    expect(route.guidance).toMatch(/keeps clear/i);
  });

  it("keeps a direct reference route when no verified closure intersects it", () => {
    const route = calculateClosureAwareRoute(origin, destination, [{ id: "far-1", name: "Northern road", barangay: "Quinapondan", latitude: 11.3, longitude: 125.6, severity: "watch" }]);
    expect(route.avoidedClosures).toEqual([]);
    expect(route.waypoints).toEqual([origin, destination]);
    expect(route.guidance).toMatch(/No active verified closure/i);
  });
  it("uses a road-network geometry result with verified-closure detours when directions are available", async () => {
    const route = await calculateRoadNetworkSafeRoute(origin, destination, [{ id: "verified-1", name: "Coastal approach", barangay: "Poblacion", latitude: 11.145, longitude: 125.338, severity: "warning" }], async () => ({ status: "OK", encodedPath: "_p~iF~ps|U_ulLnnqC_mqNvxq`@", distanceMeters: 2300, durationSeconds: 480, steps: [{ instruction: "<b>Turn left</b> toward Lawaan", distanceMeters: 900, durationSeconds: 240 }] }));
    expect(route.source).toBe("road-network");
    expect(route.durationMinutes).toBe(8);
    expect(route.estimatedDistanceKm).toBe(2.3);
    expect(route.waypoints.length).toBeGreaterThan(2);
    expect(route.steps).toEqual([{ instruction: "Turn left toward Lawaan", distanceMeters: 900, durationSeconds: 240 }]);
  });
  it("aggregates distance, travel time, and every maneuver across closure-detour route legs", () => {
    const totals = aggregateRouteLegs([{ distance: { value: 1200 }, duration: { value: 240 }, steps: [{ html_instructions: "First leg", distance: { value: 1200 }, duration: { value: 240 } }] }, { distance: { value: 1800 }, duration: { value: 360 }, steps: [{ html_instructions: "Second leg", distance: { value: 1800 }, duration: { value: 360 } }] }]);
    expect(totals).toEqual({ distanceMeters: 3000, durationSeconds: 600, steps: [{ instruction: "First leg", distanceMeters: 1200, durationSeconds: 240 }, { instruction: "Second leg", distanceMeters: 1800, durationSeconds: 360 }] });
  });
});
