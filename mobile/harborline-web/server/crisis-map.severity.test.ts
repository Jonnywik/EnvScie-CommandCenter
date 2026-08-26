import { describe, expect, it } from "vitest";
import { listCrisisMapFeatures } from "./drrm.catalog";
import { emergencyCrisisSeverities, toggleCrisisSeverity } from "../client/src/lib/crisisMapSeverity";

const balangigaBounds = { west: 125.18, south: 10.93, east: 125.68, north: 11.34 };

describe("Balangiga Crisis Map severity filtering", () => {
  it("returns only warning and critical hazard or safe-zone records for the emergency severity preset", () => {
    const features = listCrisisMapFeatures({ ...balangigaBounds, layers: ["weather", "flood", "evacuationCenters"], severities: emergencyCrisisSeverities });
    expect(features.map((feature) => feature.id)).toEqual(expect.arrayContaining(["flood-balangiga-01", "center-balangiga-01"]));
    expect(features.every((feature) => feature.severity === "warning" || feature.severity === "critical")).toBe(true);
  });

  it("keeps response placeholders available independently of the severity filter", () => {
    const features = listCrisisMapFeatures({ ...balangigaBounds, layers: ["responseTeams"], severities: ["critical"] });
    expect(features).toHaveLength(2);
    expect(features.every((feature) => feature.properties.placeholder === true)).toBe(true);
  });

  it("returns barangay road closures and community incidents when their severity is enabled", () => {
    const features = listCrisisMapFeatures({ ...balangigaBounds, layers: ["roadClosures", "incidents"], severities: ["watch", "warning"] });
    expect(features.map((feature) => feature.id)).toEqual(expect.arrayContaining(["road-balangiga-pob-01", "road-lawaan-01", "incident-balangiga-01", "incident-giporlos-01"]));
  });

  it("adds and removes individual severity chips predictably", () => {
    expect(toggleCrisisSeverity(["watch"], "warning")).toEqual(["watch", "warning"]);
    expect(toggleCrisisSeverity(["watch", "warning"], "watch")).toEqual(["warning"]);
  });
});
