import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("initial Code for Resilience load animation", () => {
  const appSource = readFileSync(resolve("client/src/App.tsx"), "utf8");
  const styles = readFileSync(resolve("client/src/index.css"), "utf8");

  it("wraps the application in the dedicated initial-load animation class", () => {
    expect(appSource).toContain('className="drrm-app-load min-h-screen"');
  });

  it("animates the entry only when motion is allowed and disables it for reduced motion", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).toContain(".drrm-app-load { animation: drrm-app-load 340ms");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".drrm-app-load, .drrm-enter, .circle-sos-alert, .circle-sos-alert-icon { animation: none !important; }");
  });
});
