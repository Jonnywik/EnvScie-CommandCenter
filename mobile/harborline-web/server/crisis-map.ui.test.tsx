// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { DetailSheet, LayerSheet, OfflineMapDownload } from "../client/src/pages/CrisisMap";
import { OpenStreetMapSurface, type CrisisSurfaceFeature } from "../client/src/components/drrm/OpenStreetMapSurface";
import { SafeRouteSheet } from "../client/src/components/drrm/SafeRouteSheet";
import { IncidentEvidenceSheet } from "../client/src/components/drrm/IncidentEvidenceSheet";

const routeRefetch = vi.hoisted(() => vi.fn());

vi.mock("react-leaflet", async () => {
  const React = await import("react");
  type LayerProps = { children?: React.ReactNode; eventHandlers?: { click?: () => void }; url?: string };
  const LayerButton = ({ eventHandlers }: LayerProps) => <button type="button" data-testid="map-overlay" onClick={() => eventHandlers?.click?.()}>feature</button>;
  return {
    MapContainer: ({ children }: LayerProps) => <div data-testid="leaflet-map">{children}</div>,
    TileLayer: () => <div data-testid="live-tiles" />,
    ImageOverlay: ({ url }: LayerProps) => <img data-testid="cached-regional-snapshot" alt="Cached CAMANAVA regional map snapshot" src={url} />,
    Circle: LayerButton,
    CircleMarker: LayerButton,
    Polyline: LayerButton,
  };
});

vi.mock("../client/src/lib/trpc", () => ({
  trpc: { useUtils: () => ({ crisisMap: { features: { invalidate: vi.fn() } }, closures: { listVerified: { invalidate: vi.fn() } } }), weather: { hybrid: { useQuery: () => ({ data: { forecast: { freshness: "live", temperatureC: 28, precipitationMm: 0, observedAt: "2026-08-23T00:00:00.000Z" }, advisory: { status: "Official advisory context" } } }) } }, mapIncidents: { submit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } }, safeRoutes: { calculate: { useQuery: () => ({ data: undefined, isFetching: false, refetch: routeRefetch }) } } },
}));

const evacuationCenter: CrisisSurfaceFeature = {
  id: "center-1", layer: "evacuationCenters", latitude: 14.66, longitude: 120.97, status: "open", properties: { name: "Bagong Barrio Elementary School", availableSlots: 42 },
};
const responsePlaceholder: CrisisSurfaceFeature = {
  id: "team-1", layer: "responseTeams", latitude: 14.7, longitude: 120.99, status: "staging", properties: { name: "Caloocan DRRMO — placeholder" },
};
const roadClosure: CrisisSurfaceFeature = {
  id: "road-1", layer: "roadClosures", latitude: 11.108, longitude: 125.381, severity: "warning", status: "active", properties: { name: "Poblacion coastal approach", barangay: "Poblacion, Balangiga", cause: "Surface flooding reference" },
};
const incident: CrisisSurfaceFeature = {
  id: "incident-1", layer: "incidents", latitude: 11.111, longitude: 125.395, severity: "warning", status: "active", properties: { name: "Flooding report reference", barangay: "Maybunga, Balangiga", summary: "Community-reported standing water reference" },
};

function SelectionHarness({ feature }: { feature: CrisisSurfaceFeature }) {
  const [selected, setSelected] = useState<CrisisSurfaceFeature | null>(null);
  return <><OpenStreetMapSurface features={[feature]} onSelect={setSelected} />{selected && <DetailSheet feature={selected} close={() => setSelected(null)} />}</>;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Crisis Map UI", () => {
  it("opens and dismisses an evacuation-center detail sheet through a map-marker selection", () => {
    render(<SelectionHarness feature={evacuationCenter} />);
    fireEvent.click(screen.getByTestId("map-overlay"));
    expect(screen.getByText("Bagong Barrio Elementary School")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close detail sheet" }));
    expect(screen.queryByText("Bagong Barrio Elementary School")).toBeNull();
  });

  it("opens and dismisses the explicit warning for an LGU response placeholder marker", () => {
    render(<SelectionHarness feature={responsePlaceholder} />);
    fireEvent.click(screen.getByTestId("map-overlay"));
    expect(screen.getByText("Caloocan DRRMO — placeholder")).toBeTruthy();
    expect(screen.getByText("Placeholder position.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close detail sheet" }));
    expect(screen.queryByText("Placeholder position.")).toBeNull();
  });

  it("opens road-closure and incident details through their selectable map overlays", () => {
    const { rerender } = render(<SelectionHarness feature={roadClosure} />);
    fireEvent.click(screen.getByTestId("map-overlay"));
    expect(screen.getByText("Road closure")).toBeTruthy();
    expect(screen.getByText("Poblacion, Balangiga")).toBeTruthy();
    expect(screen.getByText("Surface flooding reference")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close detail sheet" }));
    rerender(<SelectionHarness feature={incident} />);
    fireEvent.click(screen.getByTestId("map-overlay"));
    expect(screen.getByText("Incident report")).toBeTruthy();
    expect(screen.getByText("Maybunga, Balangiga")).toBeTruthy();
    expect(screen.getByText("Community-reported standing water reference")).toBeTruthy();
  });

  it("renders the cached regional snapshot beneath a still-interactive overlay in deterministic offline mode", () => {
    window.history.replaceState({}, "", "/crisis-map?offlineMap=1");
    const selected = vi.fn();
    render(<OpenStreetMapSurface features={[evacuationCenter]} onSelect={selected} />);
    expect(screen.getByTestId("cached-regional-snapshot").getAttribute("src")).toContain("balangiga-eastern-samar-map-snapshot_0cfd6e60.png");
    fireEvent.click(screen.getByTestId("map-overlay"));
    expect(selected).toHaveBeenCalledWith(evacuationCenter);
  });

  it("sends severity-chip and show-all actions from the mobile filter sheet", () => {
    const toggleSeverity = vi.fn();
    const showAllSeverities = vi.fn();
    const toggleLayer = vi.fn();
    render(<LayerSheet preset="custom" visible={{ weather: true, flood: true, faultLines: false, evacuationCenters: true, responseTeams: true, roadClosures: true, incidents: true }} severities={["warning"]} toggleLayer={toggleLayer} toggleSeverity={toggleSeverity} showAllSeverities={showAllSeverities} emergencyDefault={vi.fn()} clearAll={vi.fn()} close={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Watch/i }));
    expect(toggleSeverity).toHaveBeenCalledWith("watch");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(showAllSeverities).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Road closures/i }));
    fireEvent.click(screen.getByRole("button", { name: /Incidents/i }));
    expect(toggleLayer).toHaveBeenCalledWith("roadClosures");
    expect(toggleLayer).toHaveBeenCalledWith("incidents");
  });

  it("provides a direct download link for the Balangiga offline map snapshot", () => {
    render(<OfflineMapDownload />);
    const download = screen.getByRole("link", { name: "Save Balangiga offline map" });
    expect(download.getAttribute("href")).toContain("balangiga-eastern-samar-map-snapshot_0cfd6e60.png");
    expect(download.getAttribute("download")).toBe("harborline-balangiga-eastern-samar-offline-map.png");
  });

  it("requests closure-aware route guidance and exposes location capture for resident evidence", async () => {
    routeRefetch.mockResolvedValueOnce({ data: { waypoints: [{ latitude: 11.1, longitude: 125.3, label: "Origin" }, { latitude: 11.2, longitude: 125.4, label: "Destination" }], avoidedClosures: [], estimatedDistanceKm: 2.5, durationMinutes: 8, steps: [{ instruction: "Head toward Lawaan", distanceMeters: 1200, durationSeconds: 300 }, { instruction: "Continue to destination", distanceMeters: 1300, durationSeconds: 180 }], guidance: "Road-network route has no active verified closure on its current path.", source: "road-network" } });
    const onRoute = vi.fn();
    render(<SafeRouteSheet destinationIndex={0} setDestinationIndex={vi.fn()} close={vi.fn()} onRoute={onRoute} />);
    expect(screen.getByRole("button", { name: "Use my current location" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Calculate reference route" }));
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith(expect.objectContaining({ waypoints: expect.any(Array) })));
    expect(screen.getByText("8 min")).toBeTruthy();
    expect(screen.getByText("Head toward Lawaan")).toBeTruthy();
    cleanup();
    render(<IncidentEvidenceSheet close={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Use current incident location" })).toBeTruthy();
  });
});
