// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import Directions from "../client/src/pages/Directions";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";

vi.mock("../client/src/lib/trpc", () => ({ trpc: { centers: { list: { useQuery: () => ({ data: [] }) } }, closures: { listVerified: { useQuery: () => ({ data: [{ id: "closure-1", name: "Poblacion approach", barangay: "Poblacion", latitude: 11.11, longitude: 125.388, severity: "warning" }] }) } } } }));
vi.mock("../client/src/components/drrm/CivilianShell", () => ({ CivilianShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../client/src/components/drrm/DrrmPrimitives", () => ({ AppCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("../client/src/components/drrm/DrrmDomain", () => ({ DrrmNotice: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside> }));
vi.mock("../client/src/components/Map", () => ({ MapView: ({ onMapReady }: { onMapReady?: (map: google.maps.Map) => void }) => { React.useEffect(() => onMapReady?.({} as google.maps.Map), [onMapReady]); return <div data-testid="primary-directions-map" />; } }));

function installGoogleDirectionsMock() { const markerContents: HTMLElement[] = []; const route = vi.fn((_request: unknown, callback: (result: unknown, status: string) => void) => callback({ routes: [{ legs: [{ distance: { value: 1200 }, duration: { value: 240 }, steps: [{ instructions: "Head toward Poblacion", distance: { value: 1200 }, duration: { value: 240 } }] }, { distance: { value: 900 }, duration: { value: 180 }, steps: [{ instructions: "Continue to the evacuation center", distance: { value: 900 }, duration: { value: 180 } }] }] }] }, "OK")); class DirectionsService { route = route; } class DirectionsRenderer { setDirections = vi.fn(); } class Geocoder { geocode = vi.fn(); } class AdvancedMarkerElement { addListener = vi.fn(); constructor(options: { content?: HTMLElement }) { if (options.content) markerContents.push(options.content); } } Object.defineProperty(window, "google", { configurable: true, value: { maps: { DirectionsService, DirectionsRenderer, Geocoder, marker: { AdvancedMarkerElement }, TravelMode: { DRIVING: "DRIVING", WALKING: "WALKING" }, event: { trigger: vi.fn() } } } }); return { markerContents, route }; }

afterEach(() => { vi.restoreAllMocks(); delete (window as { google?: unknown }).google; });

describe("Directions page successful route", () => {
  it("renders aggregate ETA and turn-by-turn steps after an in-page route calculation", async () => {
    const { markerContents, route } = installGoogleDirectionsMock();
    render(<LocaleProvider><Directions /></LocaleProvider>);
    await waitFor(() => expect(markerContents.some((marker) => marker.textContent === "Limited · 0 slots")).toBe(true));
    expect(screen.getByTestId("primary-center-popup").textContent).toContain("Call 0917 117 0807");
    expect(screen.getByTestId("primary-center-popup").textContent).toContain("Wheelchair access not confirmed");
    expect(screen.getByTestId("primary-center-popup").textContent).toContain("Medical support: confirm with LGU");
    expect(screen.getByTestId("route-closure-overlay").textContent).toContain("Poblacion approach");
    fireEvent.click(screen.getByRole("button", { name: "Open full-screen map" }));
    expect(screen.getByRole("button", { name: "Exit full-screen map" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit full-screen map" }));
    fireEvent.click(screen.getByRole("radio", { name: "Walk" }));
    fireEvent.click(screen.getByRole("button", { name: "Directions" }));
    await waitFor(() => expect(screen.getByText(/2.1 km · about 7 min via walk/i)).toBeTruthy());
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ travelMode: "WALKING" }), expect.any(Function));
    expect(screen.getByRole("list", { name: "Turn-by-turn directions" })).toBeTruthy();
    expect(screen.getByText("Head toward Poblacion")).toBeTruthy();
    expect(screen.getByText("Continue to the evacuation center")).toBeTruthy();
  });
});
