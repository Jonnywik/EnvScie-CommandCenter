import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("managed application title", () => {
  it("uses the Code for Resilience title in managed and standalone companion runtimes", () => {
    expect(process.env.VITE_APP_TITLE ?? "Code for Resilience").toBe("Code for Resilience");
  });

  it("keeps the shared brand lockup and browser metadata under the Code for Resilience identity", () => {
    expect(readFileSync(resolve("client/src/components/drrm/BrandMark.tsx"), "utf8")).toContain("Code for Resilience");
    expect(readFileSync(resolve("client/index.html"), "utf8")).toContain("Code for Resilience — Balangiga Civilian Companion");
  });
});
