// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import Directions from "../client/src/pages/Directions";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";
import { civilianNavigation } from "../client/src/components/drrm/CivilianShell";

let centerData: Array<{ id: number; name: string; barangay: string; availableSlots: number; operationalStatus: "open" | "limited" | "full" | "closed"; latitude: number; longitude: number; contactPhone: string; accessibility: { wheelchair: boolean; medicalSupport: string; accessibleToilet: boolean } }> = [{ id: 9, name: "Poblacion Elementary School", barangay: "Poblacion", availableSlots: 24, operationalStatus: "open", latitude: 11.109, longitude: 125.388, contactPhone: "0917 117 0807", accessibility: { wheelchair: true, medicalSupport: "Barangay health team on call", accessibleToilet: true } }];

vi.mock("../client/src/lib/trpc", () => ({ trpc: { centers: { list: { useQuery: () => ({ data: centerData, isFetching: false }) } }, closures: { listVerified: { useQuery: () => ({ data: [] }) } } } }));
vi.mock("../client/src/components/drrm/CivilianShell", () => ({ CivilianShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, civilianNavigation: [{ href: "/directions", key: "directions" }, { href: "/crisis-map", key: "explore" }] }));
vi.mock("../client/src/components/drrm/DrrmPrimitives", () => ({ AppCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("../client/src/components/drrm/DrrmDomain", () => ({ DrrmNotice: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside> }));
vi.mock("../client/src/components/Map", () => ({ MapView: ({ onMapError }: { onMapError?: () => void }) => { React.useEffect(() => onMapError?.(), [onMapError]); return <div data-testid="primary-directions-map" />; } }));
vi.mock("react-leaflet", async () => { const React = await import("react"); return { MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="fallback-directions-map">{children}</div>, TileLayer: () => null, CircleMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>, Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>, Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }; });

afterEach(() => { cleanup(); vi.restoreAllMocks(); centerData = [{ id: 9, name: "Poblacion Elementary School", barangay: "Poblacion", availableSlots: 24, operationalStatus: "open", latitude: 11.109, longitude: 125.388, contactPhone: "0917 117 0807", accessibility: { wheelchair: true, medicalSupport: "Barangay health team on call", accessibleToilet: true } }]; });

describe("Directions page", () => {
  it("separates Directions from Crisis navigation, selects response destinations, and hands off when the primary map is unavailable", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<LocaleProvider><Directions /></LocaleProvider>);
    expect(civilianNavigation.find((item) => item.key === "directions")?.href).toBe("/directions");
    expect(civilianNavigation.find((item) => item.key === "explore")?.href).toBe("/crisis-map");
    expect(screen.getByTestId("fallback-directions-map")).toBeTruthy();
    expect(screen.getByTestId("availability-marker-center-9").textContent).toBe("24 slots open");
    fireEvent.change(screen.getByLabelText("Search evacuation centers or landmarks"), { target: { value: "Poblacion" } });
    expect(screen.getAllByText("Poblacion Elementary School").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 slots open").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Search evacuation centers or landmarks"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Balangiga LGU operations/i }));
    expect(screen.getByText("Response office")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Directions" }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining("Balangiga%20Municipal%20Hall"), "_blank", "noopener,noreferrer");
  });

  it("shows center contact and accessibility details, then warns when a navigating center becomes full", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const view = render(<LocaleProvider><Directions /></LocaleProvider>);
    expect(screen.getByText("Call 0917 117 0807")).toBeTruthy();
    expect(screen.getByText("Wheelchair access available")).toBeTruthy();
    expect(screen.getByText("Barangay health team on call")).toBeTruthy();
    expect(screen.getByText("Accessible toilet available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Poblacion Elementary School/i }));
    fireEvent.click(screen.getByRole("button", { name: "Directions" }));
    expect(screen.getByTestId("navigation-capacity-alert").textContent).toContain("Availability stays checked every 30 seconds");
    expect(open).toHaveBeenCalled();
    centerData = [{ ...centerData[0], availableSlots: 0, operationalStatus: "full" }];
    view.rerender(<LocaleProvider><Directions /></LocaleProvider>);
    expect(screen.getByTestId("navigation-capacity-alert").textContent).toContain("is now full");
    expect(screen.getByRole("alert").textContent).toContain("Confirm another evacuation center");
    fireEvent.click(screen.getByRole("button", { name: /Balangiga LGU operations/i }));
    fireEvent.click(screen.getByRole("button", { name: "Directions" }));
    expect(screen.queryByTestId("navigation-capacity-alert")).toBeNull();
  });
});
