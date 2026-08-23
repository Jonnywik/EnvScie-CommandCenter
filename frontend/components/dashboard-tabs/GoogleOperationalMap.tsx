"use client";

import { useEffect, useRef, useState } from "react";
import type { GisMapSnapshot, GisResource, MapOverlaysSnapshot, NoahMapContext, OfficialFacility, OfficialFacilityRegistry, OptimizedRoute, RadarSnapshot, TyphoonSnapshot } from "../../lib/api";
import type { AppearanceMode } from "./AppearanceToggle";

declare global { interface Window { google?: any; } }

type LayerState = { hazards: boolean; resources: boolean; sos: boolean; centers: boolean; route: boolean; radar: boolean; typhoon: boolean; pagasaRadar: boolean; pagasaStations: boolean; pagasaSatellite: boolean; lightning: boolean; noahFlood: boolean; noahLandslide: boolean; noahStormSurge: boolean; officialFacilities: boolean };
type LatLng = { lat: number; lng: number };
export type GoogleBasemap = "roadmap" | "satellite" | "terrain";
const RAINVIEWER_MAX_ZOOM = 7;
let googleMapsPromise: Promise<any> | null = null;
const GOOGLE_MAPS_SCRIPT_ID = "envscie-google-maps-loader";

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) {
        googleMapsPromise = null;
        document.getElementById(GOOGLE_MAPS_SCRIPT_ID)?.remove();
        reject(error);
        return;
      }
      resolve(window.google!.maps);
    };
    const waitForMaps = (attempt = 0) => {
      if (window.google?.maps) return settle();
      if (attempt >= 20) return settle(new Error("Google Maps did not initialize."));
      window.setTimeout(() => waitForMaps(attempt + 1), 100);
    };
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing || document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = "/api/v1/maps/google-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => waitForMaps();
    script.onerror = () => settle(new Error("Google Maps could not be loaded."));
    if (!existing) document.head.appendChild(script);
  });
  return googleMapsPromise;
}

const position = (value: { latitude: number; longitude: number }): LatLng => ({ lat: value.latitude, lng: value.longitude });
const darkMapStyles = [{ elementType: "geometry", stylers: [{ color: "#0b1e26" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#b7d7dc" }] }, { elementType: "labels.text.stroke", stylers: [{ color: "#071318" }] }, { featureType: "water", elementType: "geometry", stylers: [{ color: "#103b4a" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#244d58" }] }, { featureType: "poi", elementType: "geometry", stylers: [{ color: "#122c34" }] }];

export function GoogleOperationalMap({ snapshot, route, layers, radar, typhoon, mapOverlays, noahContext, facilityRegistry, facilityCategories, appearance, basemap, selectedResourceId, selectedCenterId, selectedSosId, onSelectResource, onSelectCenter, onSelectSos, onSelectFacility, onReady, onTilesReady, onError }: { snapshot: GisMapSnapshot; route?: OptimizedRoute | null; layers: LayerState; radar: RadarSnapshot | null; typhoon: TyphoonSnapshot | null; mapOverlays: MapOverlaysSnapshot | null; noahContext: NoahMapContext | null; facilityRegistry: OfficialFacilityRegistry | null; facilityCategories: OfficialFacility["category"][]; appearance: AppearanceMode; basemap: GoogleBasemap; selectedResourceId?: string; selectedCenterId?: string; selectedSosId?: string; onSelectResource: (resource: GisResource) => void; onSelectCenter: (center: GisMapSnapshot["centers"][number]) => void; onSelectSos: (incident: GisMapSnapshot["sos"][number]) => void; onSelectFacility: (facility: OfficialFacility) => void; onReady: (map: any) => void; onTilesReady: () => void; onError: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const overlayTypeRegistryRef = useRef<Record<string, any>>({});
  const hasFittedInitialExtent = useRef(false);
  const hasFittedFacilityExtent = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    const initialize = (attempt: number) => {
      void loadGoogleMaps().then((maps) => {
        if (!active || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, { center: position(snapshot.center), zoom: 13, minZoom: 7, maxZoom: 14, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy", keyboardShortcuts: true, mapTypeId: basemap, styles: appearance === "dark" && basemap === "roadmap" ? darkMapStyles : undefined });
        mapRef.current = map;
        setReady(true);
        onReady(map);
        maps.event.addListenerOnce(map, "tilesloaded", () => window.requestAnimationFrame(() => window.requestAnimationFrame(onTilesReady)));
      }).catch((error) => {
        if (!active) return;
        if (attempt === 0) {
          retryTimer = window.setTimeout(() => initialize(1), 700);
          return;
        }
        onError(error instanceof Error ? error.message : "Google Maps could not be initialized.");
      });
    };
    initialize(0);
    return () => { active = false; if (retryTimer != null) window.clearTimeout(retryTimer); overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null)); overlaysRef.current = []; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!ready || !map || !maps) return;
    overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null));
    overlaysRef.current = [];
    map.setOptions({ styles: appearance === "dark" && basemap === "roadmap" ? darkMapStyles : undefined, mapTypeId: basemap });
    const bounds = new maps.LatLngBounds();
    snapshot.resources.forEach((resource) => bounds.extend(position(resource.position)));
    snapshot.centers.forEach((center) => bounds.extend(position(center.position)));
    snapshot.sos.forEach((incident) => bounds.extend(position(incident.position)));
    if (!bounds.isEmpty() && !hasFittedInitialExtent.current) {
      hasFittedInitialExtent.current = true;
      map.fitBounds(bounds, 56);
      maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom?.() || 14) > 14) map.setZoom(14);
      });
    }
    const visibleFacilities = facilityRegistry?.facilities.filter((facility) => facilityCategories.includes(facility.category)) || [];
    if (!layers.officialFacilities) hasFittedFacilityExtent.current = false;
    if (layers.officialFacilities && visibleFacilities.length && !hasFittedFacilityExtent.current) {
      const facilityBounds = new maps.LatLngBounds();
      facilityBounds.extend(position(snapshot.center));
      visibleFacilities.forEach((facility) => facilityBounds.extend(position(facility.position)));
      map.fitBounds(facilityBounds, 56);
      hasFittedFacilityExtent.current = true;
    }
    if (layers.hazards) snapshot.hazards.forEach((hazard) => overlaysRef.current.push(new maps.Polygon({ map, paths: hazard.polygon.map(position), fillColor: hazard.severity === "critical" ? "#ef4444" : "#f59e0b", fillOpacity: hazard.status === "active" ? .28 : .14, strokeColor: hazard.severity === "critical" ? "#be123c" : "#b45309", strokeOpacity: 1, strokeWeight: 2, clickable: true })));
    const noahBounds = noahContext ? { north: noahContext.focus_bbox.north, south: noahContext.focus_bbox.south, east: noahContext.focus_bbox.east, west: noahContext.focus_bbox.west } : null;
    const addNoahOverlay = (id: NoahMapContext["layers"][number]["id"], enabled: boolean) => {
      const layer = noahContext?.layers.find((item) => item.id === id);
      if (!enabled || !layer || !noahBounds) return;
      overlaysRef.current.push(new maps.GroundOverlay(layer.overlay_url, noahBounds, { opacity: .76, clickable: false }));
    };
    addNoahOverlay("noah-flood-100yr", layers.noahFlood);
    addNoahOverlay("noah-landslide", layers.noahLandslide);
    addNoahOverlay("noah-storm-surge-scenarios", layers.noahStormSurge);
    if (layers.route && route?.route.length) overlaysRef.current.push(new maps.Polyline({ map, path: route.route.map(position), strokeColor: "#0d9488", strokeOpacity: 1, strokeWeight: 5 }));
    if (layers.centers) snapshot.centers.forEach((center) => { const selected = center.id === selectedCenterId; const marker = new maps.Marker({ map, position: position(center.position), title: `${center.name} · ${center.occupancy_current}/${center.capacity_total}`, zIndex: selected ? 20 : undefined, label: { text: "E", color: "#ffffff", fontWeight: "700" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#0f766e", fillOpacity: 1, strokeColor: selected ? "#fef3c7" : "#ffffff", strokeWeight: selected ? 4 : 2, scale: selected ? 13 : 11 } }); marker.addListener("click", () => onSelectCenter(center)); overlaysRef.current.push(marker); });
    if (layers.officialFacilities) visibleFacilities.forEach((facility) => { const marker = new maps.Marker({ map, position: position(facility.position), title: `${facility.name} · official registry reference · ${facility.coordinate_validation_status.replaceAll("_", " ")}`, label: { text: facility.category === "hospital" ? "H" : "+", color: "#ffffff", fontWeight: "800" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: facility.category === "hospital" ? "#155e75" : "#0369a1", fillOpacity: 1, strokeColor: "#d9f5fa", strokeWeight: 2, scale: 10 } }); marker.addListener("click", () => onSelectFacility(facility)); overlaysRef.current.push(marker); });
    if (layers.sos) snapshot.sos.forEach((incident) => { const selected = incident.id === selectedSosId; const marker = new maps.Marker({ map, position: position(incident.position), title: `${incident.summary} · ${incident.status}`, zIndex: selected ? 20 : undefined, label: { text: "!", color: "#ffffff", fontWeight: "900" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#e11d48", fillOpacity: 1, strokeColor: selected ? "#fef3c7" : "#ffffff", strokeWeight: selected ? 4 : 2, scale: selected ? 12 : 10 } }); marker.addListener("click", () => onSelectSos(incident)); overlaysRef.current.push(marker); });
    if (layers.resources) snapshot.resources.forEach((resource) => { const selected = resource.id === selectedResourceId; const marker = new maps.Marker({ map, position: position(resource.position), title: `${resource.label} · ${resource.state}`, zIndex: selected ? 20 : undefined, label: { text: resource.kind === "medical" ? "+" : resource.kind === "boat" ? "⌁" : "•", color: "#ffffff", fontWeight: "900" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: resource.state === "offline" ? "#64748b" : "#2563eb", fillOpacity: 1, strokeColor: selected ? "#fef3c7" : "#ffffff", strokeWeight: selected ? 4 : 2, scale: selected ? 12 : 10 } }); marker.addListener("click", () => onSelectResource(resource)); overlaysRef.current.push(marker); });
    if (layers.typhoon && typhoon?.active && typhoon.latitude != null && typhoon.longitude != null) { if (typhoon.track.length > 1) overlaysRef.current.push(new maps.Polyline({ map, path: typhoon.track.map(position), strokeColor: "#8b5cf6", strokeOpacity: .9, strokeWeight: 3 })); overlaysRef.current.push(new maps.Marker({ map, position: { lat: typhoon.latitude, lng: typhoon.longitude }, title: `${typhoon.name || "Tropical cyclone"} · PAGASA bulletin`, label: { text: "◌", color: "#ffffff" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#7c3aed", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 14 } })); }
    if (layers.pagasaStations && mapOverlays?.pagasa_stations.freshness !== "unavailable") mapOverlays?.pagasa_stations.stations.forEach((station) => overlaysRef.current.push(new maps.Marker({ map, position: { lat: station.latitude, lng: station.longitude }, title: `${station.name} · observed ${station.observed_at}`, label: { text: "S", color: "#ffffff", fontWeight: "700" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#0891b2", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 8 } })));
    if (layers.lightning && mapOverlays?.lightning.freshness !== "unavailable") mapOverlays?.lightning.events.forEach((event) => overlaysRef.current.push(new maps.Marker({ map, position: { lat: event.latitude, lng: event.longitude }, title: `Licensed lightning observation · ${event.observed_at}`, label: { text: "ϟ", color: "#172554", fontWeight: "900" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#facc15", fillOpacity: .92, strokeColor: "#fff7cc", strokeWeight: 2, scale: 6 } })));
    map.overlayMapTypes.clear();
    overlayTypeRegistryRef.current = {};
    const radarFrame = radar?.frames.at(-1);
    const transparentTile = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'/%3E";
    const registerTileOverlay = (id: string, name: string, frame: RadarSnapshot["frames"][number], host: string, opacity: number, maxZoom: number) => {
      const base = host.replace(/\/$/, "");
      const path = frame.path.startsWith("/") ? frame.path : `/${frame.path}`;
      const overlay = new maps.ImageMapType({ name, opacity, tileSize: new maps.Size(256, 256), minZoom: 0, maxZoom, getTileUrl: (coord: { x: number; y: number }, zoom: number) => {
        const worldTileCount = 2 ** zoom;
        if (zoom > maxZoom || coord.y < 0 || coord.y >= worldTileCount) return transparentTile;
        const normalizedX = ((coord.x % worldTileCount) + worldTileCount) % worldTileCount;
        return `${base}${path}/256/${zoom}/${normalizedX}/${coord.y}/4/1_0.png`;
      } });
      overlayTypeRegistryRef.current[id] = overlay;
      map.overlayMapTypes.push(overlay);
    };
    if (layers.radar && radarFrame && radar?.host) registerTileOverlay("rainviewer", "RainViewer radar", radarFrame, radar.host, .56, RAINVIEWER_MAX_ZOOM);
    const pagasaRadar = mapOverlays?.pagasa_radar;
    const pagasaFrame = pagasaRadar?.frames.at(-1);
    if (layers.pagasaRadar && pagasaRadar?.freshness !== "unavailable" && pagasaFrame && pagasaRadar?.host) registerTileOverlay("pagasa-radar-qpe", "PAGASA Radar/QPE", pagasaFrame, pagasaRadar.host, .5, pagasaRadar.max_zoom ?? 10);
  }, [appearance, basemap, facilityCategories, facilityRegistry, layers, mapOverlays, noahContext, radar, ready, route, selectedCenterId, selectedResourceId, selectedSosId, snapshot, typhoon]);

  return <div ref={containerRef} className="google-operational-map" role="application" aria-label="Interactive Google Map of Balangiga operational resources, hazards, evacuation centers, and SOS locations" />;
}
