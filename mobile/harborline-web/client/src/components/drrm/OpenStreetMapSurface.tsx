import { Circle, CircleMarker, ImageOverlay, MapContainer, Polyline, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { trpc } from "@/lib/trpc";
import { getCrisisMapSurfaceMode } from "@/lib/crisisMapInteractions";
import React, { useState } from "react";

export type CrisisSurfaceFeature = { id: string; layer: "weather" | "flood" | "faultLines" | "evacuationCenters" | "responseTeams" | "roadClosures" | "incidents"; latitude: number; longitude: number; status?: string; severity?: string; properties: Record<string, string | number | boolean> };
const markerColor = (feature: CrisisSurfaceFeature) => feature.layer === "evacuationCenters" ? feature.status === "limited" ? "#c58726" : "#0e715f" : feature.layer === "incidents" ? feature.severity === "warning" || feature.severity === "critical" ? "#d95d4f" : "#d08b22" : "#8450aa";

export function OpenStreetMapSurface({ features, onSelect, routeWaypoints = [] }: { features: CrisisSurfaceFeature[]; onSelect: (feature: CrisisSurfaceFeature) => void; routeWaypoints?: { latitude: number; longitude: number }[] }) {
  const { data: weather } = trpc.weather.hybrid.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 1 });
  const [tileOffline, setTileOffline] = useState(() => new URLSearchParams(window.location.search).has("offlineMap"));
  const surfaceMode = getCrisisMapSurfaceMode(tileOffline);
  return <div className="relative h-full w-full"><MapContainer center={[11.1086, 125.3877]} zoom={11} scrollWheelZoom className="h-full w-full" whenReady={() => localStorage.setItem("harborline-osm-cache-last-ready", new Date().toISOString())}>
    {!tileOffline && <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileOffline(true) }} />}
    {surfaceMode === "cached-regional-snapshot" && <ImageOverlay url="/manus-storage/balangiga-eastern-samar-map-snapshot_0cfd6e60.png" bounds={[[10.914, 124.97], [11.303, 125.805]]} pane="tilePane" zIndex={1} opacity={1} />}
    {routeWaypoints.length > 1 && <Polyline positions={routeWaypoints.map((point) => [point.latitude, point.longitude] as [number, number])} pathOptions={{ color: "#0e715f", weight: 6, dashArray: "10 8", opacity: 0.9 }} />}
    {features.map((feature) => {
      const point: [number, number] = [feature.latitude, feature.longitude];
      if (feature.layer === "weather" || feature.layer === "flood") return <Circle key={feature.id} center={point} radius={feature.layer === "weather" ? 4700 : 2500} pathOptions={{ color: feature.layer === "weather" ? "#167da0" : "#3865b6", fillColor: feature.layer === "weather" ? "#52a7c7" : "#618fd4", fillOpacity: 0.23, dashArray: feature.layer === "weather" ? "6 7" : undefined }} eventHandlers={{ click: () => onSelect(feature) }} />;
      if (feature.layer === "faultLines") return <Polyline key={feature.id} positions={[[feature.latitude - 0.025, feature.longitude - 0.055], [feature.latitude + 0.025, feature.longitude + 0.055]]} pathOptions={{ color: "#d86a51", weight: 4 }} eventHandlers={{ click: () => onSelect(feature) }} />;
      if (feature.layer === "roadClosures") return <Polyline key={feature.id} positions={[[feature.latitude - 0.008, feature.longitude - 0.012], [feature.latitude + 0.008, feature.longitude + 0.012]]} pathOptions={{ color: feature.severity === "warning" || feature.severity === "critical" ? "#c74335" : "#d08b22", weight: 7, dashArray: "8 7" }} eventHandlers={{ click: () => onSelect(feature) }} />;
      return <CircleMarker key={feature.id} center={point} radius={10} pathOptions={{ color: "#ffffff", weight: 3, fillColor: markerColor(feature), fillOpacity: 1 }} eventHandlers={{ click: () => onSelect(feature) }} />;
    })}
  </MapContainer>{tileOffline && <OfflineSnapshotStatus />}<div className="pointer-events-none absolute right-4 top-4 z-[500] max-w-[220px] rounded-xl border border-white/80 bg-white/95 p-3 text-[10px] shadow-sm"><p className="font-extrabold uppercase tracking-[0.1em] text-[#0e715f]">PAGASA · Balangiga context</p><p className="mt-1 font-bold text-[#163f4a]">{weather?.forecast.freshness === "live" ? `Forecast ${weather.forecast.temperatureC ?? "—"}°C · ${weather?.forecast.precipitationMm ?? "—"} mm` : `Forecast ${weather?.forecast.freshness ?? "loading"}`}</p><p className="mt-1 text-[#527176]">PAGASA: {weather?.advisory.status ?? "Official advisory context"}</p><p className="mt-1 text-[#527176]">Updated: {weather?.forecast.observedAt ?? weather?.cachedAt ?? "pending"}</p></div></div>;
}
function OfflineSnapshotStatus() { return <div className="pointer-events-none absolute bottom-5 left-5 z-[500] max-w-[270px] rounded-xl bg-[#063448]/92 p-3 text-xs text-white"><p className="font-extrabold text-[#87e3c9]">Offline snapshot active</p><p className="mt-1 text-white/80">Cached Balangiga and adjacent-area map; live tiles resume when connectivity returns.</p></div>; }
