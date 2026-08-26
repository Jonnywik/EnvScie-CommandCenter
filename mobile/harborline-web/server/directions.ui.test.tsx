// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { RouteSteps } from "../client/src/components/drrm/RouteSteps";

describe("directions tab route guidance", () => {
  it("renders numbered, accessible maneuver instructions with distance and time", () => {
    render(<RouteSteps steps={[{ instruction: "Turn left toward Poblacion", meters: 850, seconds: 180 }, { instruction: "Continue to the evacuation center", meters: 1300, seconds: 240 }]}/>);
    expect(screen.getByRole("list", { name: "Turn-by-turn directions" })).toBeTruthy();
    expect(screen.getByText("Turn left toward Poblacion")).toBeTruthy();
    expect(screen.getByText("850 m · 3 min")).toBeTruthy();
    expect(screen.getByText("1.3 km · 4 min")).toBeTruthy();
  });
});
