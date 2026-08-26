import { describe, expect, it } from "vitest";
import { clearLayerVisibility, emergencyLayerVisibility, toggleCrisisLayer } from "../client/src/lib/crisisMapState";

describe("Crisis Map UI interaction state", () => {
  it("restores critical layers with Emergency Default", () => {
    expect(emergencyLayerVisibility).toEqual({ weather: true, flood: true, faultLines: false, evacuationCenters: true, responseTeams: true, roadClosures: true, incidents: true });
  });
  it("clears all layers then toggles one requested overlay", () => {
    const faultOnly = toggleCrisisLayer(clearLayerVisibility, "faultLines");
    expect(faultOnly).toEqual({ weather: false, flood: false, faultLines: true, evacuationCenters: false, responseTeams: false, roadClosures: false, incidents: false });
  });
});
