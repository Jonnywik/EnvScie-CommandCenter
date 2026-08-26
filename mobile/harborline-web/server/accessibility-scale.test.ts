import { describe, expect, it } from "vitest";
import { LARGE_TEXT_MIN_SCALE, TEXT_SCALE_DEFAULT, TEXT_SCALE_MAX, TEXT_SCALE_MIN, clampTextScale } from "../client/src/contexts/AccessibilityContext";

describe("adjustable text scale", () => {
  it("clamps user-selected text scale to accessible slider steps", () => {
    expect(clampTextScale(TEXT_SCALE_DEFAULT)).toBe(100);
    expect(clampTextScale(87)).toBe(TEXT_SCALE_MIN);
    expect(clampTextScale(142)).toBe(TEXT_SCALE_MAX);
    expect(clampTextScale(117)).toBe(115);
  });

  it("keeps the large-text minimum above the default scale", () => {
    expect(LARGE_TEXT_MIN_SCALE).toBeGreaterThan(TEXT_SCALE_DEFAULT);
  });
});
