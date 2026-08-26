import { describe, expect, it } from "vitest";
import { buildCrisisDetailSheet, getCrisisMapSurfaceMode } from "../client/src/lib/crisisMapInteractions";

describe("Crisis Map interactions", () => {
  it("builds the evacuation-center detail sheet from selected map feature properties", () => {
    expect(buildCrisisDetailSheet({
      layer: "evacuationCenters",
      status: "open",
      properties: { name: "Bagong Barrio Elementary School", availableSlots: 42 },
    })).toEqual({
      category: "evacuation-center",
      title: "Bagong Barrio Elementary School",
      statusLabel: "open",
      availableSlots: 42,
      showPlaceholderNotice: false,
    });
  });

  it("builds a clearly labeled LGU placeholder response-team detail sheet", () => {
    expect(buildCrisisDetailSheet({
      layer: "responseTeams",
      status: "staging",
      properties: { name: "Caloocan DRRMO — placeholder" },
    })).toMatchObject({
      category: "response-team",
      title: "Caloocan DRRMO — placeholder",
      statusLabel: "staging",
      availableSlots: null,
      showPlaceholderNotice: true,
    });
  });

  it("switches deterministically from live OSM tiles to the cached regional snapshot on tile failure", () => {
    expect(getCrisisMapSurfaceMode(false)).toBe("live-osm-tiles");
    expect(getCrisisMapSurfaceMode(true)).toBe("cached-regional-snapshot");
  });
});
