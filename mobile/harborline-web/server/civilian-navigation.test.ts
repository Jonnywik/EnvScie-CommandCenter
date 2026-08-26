import { describe, expect, it } from "vitest";
import { civilianNavigation, mobileNavigationStateClasses } from "../client/src/components/drrm/CivilianShell";

describe("civilian navigation", () => {
  it("keeps dedicated Directions and Crisis Map entries as distinct real navigation destinations", () => {
    expect(civilianNavigation.find((item) => item.key === "directions")?.href).toBe("/directions");
    expect(civilianNavigation.find((item) => item.key === "explore")?.href).toBe("/crisis-map");
    expect(civilianNavigation).toHaveLength(6);
  });

  it("uses a high-visibility coral card only for the active mobile tab", () => {
    expect(mobileNavigationStateClasses(true, true)).toContain("bg-[#e97f63]");
    expect(mobileNavigationStateClasses(true, true)).toContain("text-white");
    expect(mobileNavigationStateClasses(false, true)).not.toContain("bg-[#e97f63]");
    expect(mobileNavigationStateClasses(false, false)).toContain("text-white/75");
  });
});
