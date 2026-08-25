import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesSource = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("shared Command Center shell contrast", () => {
  const pairs = [
    ["dark header title", "#efffff", "#071923"],
    ["dark sidebar label", "#c3dadd", "#071923"],
    ["dark header utility", "#d9ffff", "#0a3942"],
    ["light header title", "#0b2535", "#f7fcfa"],
    ["light sidebar label", "#486874", "#ffffff"],
    ["light utility control", "#0b6570", "#ffffff"],
  ] as const;

  it.each(pairs)("keeps %s at or above the WCAG AA 4.5:1 normal-text threshold", (_label, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("retains the tested shared color assignments in the stylesheet", () => {
    expect(stylesSource).toContain("color: #efffff;");
    expect(stylesSource).toContain("color: #c3dadd;");
    expect(stylesSource).toContain("color: #0b2535;");
    expect(stylesSource).toContain("color: #486874;");
    expect(stylesSource).toContain("color: #0b6570;");
  });
});
