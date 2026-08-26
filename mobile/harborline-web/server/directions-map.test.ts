import { describe, expect, it } from "vitest";
import { fallbackEvacuationDestination } from "../client/src/lib/directions";
import { findRouteAreaClosures, travelModeMeta } from "../client/src/lib/directionsMap";

describe("Directions map enhancement helpers", () => {
  it("uses the road route as an explicit motorcycle fallback rather than inventing a provider-specific motorcycle mode", () => {
    expect(travelModeMeta.motorcycle).toMatchObject({ label: "Motorcycle", mapsMode: "driving" });
    expect(travelModeMeta.motorcycle.note).toContain("confirm motorcycle access");
  });

  it("returns verified closures near the direct origin-destination corridor", () => {
    const closures = findRouteAreaClosures([{ id: "closure-1", name: "Poblacion approach", barangay: "Poblacion", latitude: 11.109, longitude: 125.388, severity: "warning" }], fallbackEvacuationDestination);
    expect(closures.map((closure) => closure.id)).toEqual(["closure-1"]);
  });
});
