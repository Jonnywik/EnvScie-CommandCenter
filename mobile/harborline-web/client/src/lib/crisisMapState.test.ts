import { describe, expect, it } from "vitest";
import { clearLayerVisibility, emergencyLayerVisibility, toggleCrisisLayer } from "./crisisMapState";
describe("Crisis Map layer state", () => {
  it("enables only immediate-response overlays for the emergency default", () => { expect(emergencyLayerVisibility).toEqual({ weather: true, flood: true, faultLines: false, evacuationCenters: true, responseTeams: true }); });
  it("clears all overlays and supports individual layer restoration", () => { const restored = toggleCrisisLayer(clearLayerVisibility, "faultLines"); expect(clearLayerVisibility).toEqual({ weather: false, flood: false, faultLines: false, evacuationCenters: false, responseTeams: false }); expect(restored.faultLines).toBe(true); expect(restored.weather).toBe(false); });
});
