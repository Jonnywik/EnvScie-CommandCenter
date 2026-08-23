"use client";

import { useEffect, useRef, useState } from "react";
import type { GisMapSnapshot, GisResource, OptimizedRoute, RadarSnapshot, TyphoonSnapshot } from "../../lib/api";
import type { AppearanceMode } from "./AppearanceToggle";

declare global { interface Window { google?: any; } }

type LayerState = { hazards: boolean; resources: boolean; sos: boolean; centers: boolean; route: boolean; radar: boolean; typhoon: boolean };
type LatLng = { lat: number; lng: number };
export type GoogleBasemap = "roadmap" | "satellite" | "terrain";
let googleMapsPromise: Promise<any> | null = null;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/api/v1/maps/google-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps did not initialize."));
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

const position = (value: { latitude: number; longitude: number }): LatLng => ({ lat: value.latitude, lng: value.longitude });
const darkMapStyles = [{ elementType: "geometry", stylers: [{ color: "#0b1e26" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#b7d7dc" }] }, { elementType: "labels.text.stroke", stylers: [{ color: "#071318" }] }, { featureType: "water", elementType: "geometry", stylers: [{ color: "#103b4a" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#244d58" }] }, { featureType: "poi", elementType: "geometry", stylers: [{ color: "#122c34" }] }];

export function GoogleOperationalMap({ snapshot, route, layers, radar, typhoon, appearance, basemap, onSelectResource, onReady, onError }: { snapshot: GisMapSnapshot; route?: OptimizedRoute | null; layers: LayerState; radar: RadarSnapshot | null; typhoon: TyphoonSnapshot | null; appearance: AppearanceMode; basemap: GoogleBasemap; onSelectResource: (resource: GisResource) => void; onReady: (map: any) => void; onError: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const hasFittedInitialExtent = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !containerRef.current) return;
      const map = new maps.Map(containerRef.current, { center: position(snapshot.center), zoom: 13, minZoom: 7, maxZoom: 14, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy", keyboardShortcuts: true, mapTypeId: basemap, styles: appearance === "dark" && basemap === "roadmap" ? darkMapStyles : undefined });
      mapRef.current = map;
      setReady(true);
      onReady(map);
    }).catch((error) => { if (active) onError(error instanceof Error ? error.message : "Google Maps could not be initialized."); });
    return () => { active = false; overlaysRef.current.forEach((overlay) => overlay?.setMap?.(null)); overlaysRef.current = []; };
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
    if (layers.hazards) snapshot.hazards.forEach((hazard) => overlaysRef.current.push(new maps.Polygon({ map, paths: hazard.polygon.map(position), fillColor: hazard.severity === "critical" ? "#ef4444" : "#f59e0b", fillOpacity: hazard.status === "active" ? .28 : .14, strokeColor: hazard.severity === "critical" ? "#be123c" : "#b45309", strokeOpacity: 1, strokeWeight: 2, clickable: true })));
    if (layers.route && route?.route.length) overlaysRef.current.push(new maps.Polyline({ map, path: route.route.map(position), strokeColor: "#0d9488", strokeOpacity: 1, strokeWeight: 5 }));
    if (layers.centers) snapshot.centers.forEach((center) => overlaysRef.current.push(new maps.Marker({ map, position: position(center.position), title: `${center.name} · ${center.occupancy_current}/${center.capacity_total}`, label: { text: "E", color: "#ffffff", fontWeight: "700" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#0f766e", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 11 } })));
    if (layers.sos) snapshot.sos.forEach((incident) => overlaysRef.current.push(new maps.Marker({ map, position: position(incident.position), title: `${incident.summary} · ${incident.status}`, label: { text: "!", color: "#ffffff", fontWeight: "900" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#e11d48", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 10 } })));
    if (layers.resources) snapshot.resources.forEach((resource) => { const marker = new maps.Marker({ map, position: position(resource.position), title: `${resource.label} · ${resource.state}`, label: { text: resource.kind === "medical" ? "+" : resource.kind === "boat" ? "⌁" : "•", color: "#ffffff", fontWeight: "900" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: resource.state === "offline" ? "#64748b" : "#2563eb", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 10 } }); marker.addListener("click", () => onSelectResource(resource)); overlaysRef.current.push(marker); });
    if (layers.typhoon && typhoon?.active && typhoon.latitude != null && typhoon.longitude != null) { if (typhoon.track.length > 1) overlaysRef.current.push(new maps.Polyline({ map, path: typhoon.track.map(position), strokeColor: "#8b5cf6", strokeOpacity: .9, strokeWeight: 3 })); overlaysRef.current.push(new maps.Marker({ map, position: { lat: typhoon.latitude, lng: typhoon.longitude }, title: `${typhoon.name || "Tropical cyclone"} · PAGASA bulletin`, label: { text: "◌", color: "#ffffff" }, icon: { path: maps.SymbolPath.CIRCLE, fillColor: "#7c3aed", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2, scale: 14 } })); }
    map.overlayMapTypes.clear();
    const radarFrame = radar?.frames.at(-1);
    if (layers.radar && radarFrame && radar?.host) { const base = radar.host.replace(/\/$/, ""); const path = radarFrame.path.startsWith("/") ? radarFrame.path : `/${radarFrame.path}`; const transparentTile = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'/%3E"; map.overlayMapTypes.push(new maps.ImageMapType({ name: "RainViewer radar", opacity: .56, tileSize: new maps.Size(256, 256), minZoom: 0, maxZoom: 10, getTileUrl: (coord: { x: number; y: number }, zoom: number) => zoom > 10 ? transparentTile : `${base}${path}/256/${zoom}/${coord.x}/${coord.y}/4/1_0.png` })); }
  }, [appearance, basemap, layers, radar, ready, route, snapshot, typhoon]);

  return <div ref={containerRef} className="google-operational-map" role="application" aria-label="Interactive Google Map of Balangiga operational resources, hazards, evacuation centers, and SOS locations" />;
}
