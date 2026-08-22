import { describe, expect, it } from "vitest";
import { BALANGIGA_REFERENCE_POINT, clampViewportTransform, EASTERN_VISAYAS_REGIONAL_BBOX, esriWorldImageryExportUrl, isWithinBbox, rainViewerTilesForBbox } from "./mapContext";

describe("regional satellite map context", () => {
  it("keeps Balangiga inside the declared Eastern Visayas context extent", () => {
    expect(isWithinBbox(BALANGIGA_REFERENCE_POINT, EASTERN_VISAYAS_REGIONAL_BBOX)).toBe(true);
  });

  it("creates an attributed-provider image export request at the requested map dimensions", () => {
    const url = new URL(esriWorldImageryExportUrl(EASTERN_VISAYAS_REGIONAL_BBOX, 860, 430));
    expect(url.hostname).toBe("server.arcgisonline.com");
    expect(url.pathname).toContain("World_Imagery/MapServer/export");
    expect(url.searchParams.get("bbox")).toBe("123.9,9.7,126.9,12.7");
    expect(url.searchParams.get("size")).toBe("860,430");
    expect(url.searchParams.get("f")).toBe("image");
  });

  it("builds the documented RainViewer tile path for a Balangiga map viewport", () => {
    const tiles = rainViewerTilesForBbox([125.382, 11.12, 125.41, 11.145], "https://tilecache.rainviewer.com", "/v2/radar/1710000000", 10);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0].url).toMatch(/^https:\/\/tilecache\.rainviewer\.com\/v2\/radar\/1710000000\/512\/10\/\d+\/\d+\/4\/1_0\.png$/);
    expect(tiles.every((tile) => tile.west < tile.east && tile.south < tile.north)).toBe(true);
  });

  it("keeps zoom and pan inside the map viewport guardrails", () => {
    expect(clampViewportTransform({ x: 9999, y: -9999, scale: 50 }, 860, 430)).toEqual({ x: 0, y: -3010, scale: 8 });
    expect(clampViewportTransform({ x: -9999, y: 9999, scale: .1 }, 860, 430)).toEqual({ x: -215, y: 107.5, scale: .5 });
  });
});
