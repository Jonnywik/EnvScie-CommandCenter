import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("referenced command-center dark theme", () => {
  it("defines a low-glare command-surface palette and preserves explicit emergency colors", () => {
    expect(styles).toContain("html.dark { background: #07151c; color-scheme: dark; }");
    expect(styles).toContain(".dark .drrm-command-strip");
    expect(styles).toContain(".dark .drrm-primary-header");
    expect(styles).toContain(".dark .drrm-mobile-nav-link--urgent");
    expect(styles).toContain("background-color: #d86c5d !important;");
  });
});
