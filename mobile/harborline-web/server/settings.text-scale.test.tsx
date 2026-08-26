// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import Settings from "../client/src/pages/Settings";
import { AccessibilityProvider } from "../client/src/contexts/AccessibilityContext";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";
import { ThemeProvider } from "../client/src/contexts/ThemeContext";

vi.mock("../client/src/components/drrm/CivilianShell", () => ({ CivilianShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../client/src/components/drrm/DrrmDomain", () => ({ DrrmNotice: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside> }));

function renderSettings() {
  return render(<ThemeProvider switchable><LocaleProvider><AccessibilityProvider><Settings /></AccessibilityProvider></LocaleProvider></ThemeProvider>);
}

beforeEach(() => { localStorage.clear(); document.documentElement.className = ""; document.documentElement.style.removeProperty("--harborline-text-scale"); window.history.replaceState({}, "", "/settings"); });
afterEach(() => cleanup());

describe("Settings text-size slider", () => {
  it("updates the app-wide scale and persists the resident preference", () => {
    renderSettings();
    const slider = screen.getByLabelText("Text size") as HTMLInputElement;
    expect(slider.value).toBe("100");
    fireEvent.change(slider, { target: { value: "135" } });
    expect(screen.getByText("135%")).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue("--harborline-text-scale")).toBe("135%");
    expect(localStorage.getItem("harborline-text-scale")).toBe("135");
  });

  it("keeps the large-text switch compatible with the slider minimum", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /Large text/i }));
    expect(screen.getByText("118%")).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue("--harborline-text-scale")).toBe("118%");
  });
});
