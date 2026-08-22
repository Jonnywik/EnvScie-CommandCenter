"use client";

/*
 * Code for Resilience Command Center.
 * Design reminder: reference-emblem navy and coastal mint for trusted action,
 * with hazard coral reserved for life-safety urgency and dense layouts for
 * rapid scanning during a Balangiga incident operating period.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type TouchEvent, type WheelEvent } from "react";
import { buildShiftHandoff, canUseCoordinatorIntake, resolveOperatorShortcut } from "../lib/operatorAssist";
import { clampViewportTransform, EASTERN_VISAYAS_REGIONAL_BBOX, esriWorldImageryExportUrl, rainViewerTilesForBbox, type MapViewportTransform } from "../lib/mapContext";
import {
  AlertItem,
  AuditEvent,
  BarangayReadiness,
  CommunicationEvent,
  CommunicationSnapshot,
  AudioDispatchItem,
  Center,
  CommunicationsPlan,
  CommandCenterTask,
  DashboardSummary,
  DispatchTeam,
  FeedHealth,
  FloodRiskAssessment,
  GisMapSnapshot,
  GisResource,
  HazardLayer,
  AssignmentNotification,
  NotificationSnapshot,
  OperationsSnapshot,
  OptimizedRoute,
  ProvincialWeatherSnapshot,
  CoordinatorEmergencyCreate,
  ResponseGroup,
  ResponseGroupSnapshot,
  RecommendationResponse,
  RadarSnapshot,
  ResponderSafetyAssessment,
  ResourceItem,
  SosCreateResult,
  SosIncident,
  SosStatus,
  TyphoonSnapshot,
  UserIdentity,
  demoLogin,
  getDashboardSummary,
  getAuditEvents,
  getFeedHealth,
  pollConfiguredFeeds,
  getGisMap,
  getWeatherRadar,
  getWeatherTyphoon,
  getProvincialWeatherSituation,
  assessFloodRisk,
  assessResponderSafety,
  getOperations,
  getResponseGroups,
  assignResponseGroup,
  getNotifications,
  acknowledgeNotification,
  createCoordinatorEmergency,
  retryNotification,
  getCoordinationCommunications,
  getDispatchRecommendations,
  optimizeGisRoute,
  recordOperationsAction,
  subscribeToGisEvents,
  subscribeToCoordinationEvents,
  subscribeToResponseGroupEvents,
  subscribeToSosEvents,
  subscribeToNotificationEvents,
  updateGisResourcePosition,
  updateSosStatus,
  sendCoordinationCommunication,
} from "../lib/api";

type Tab = "Overview" | "Incident Triage" | "Fleet & Responder Safety" | "DRRMO Intelligence" | "Live SOS" | "Verified Alerts" | "Provincial Weather" | "Risk Map" | "Evacuation Centers" | "Resources" | "Response Groups" | "Communications";

const navItems: Array<{ icon: string; label: Tab }> = [
  { icon: "▦", label: "Overview" },
  { icon: "↯", label: "Incident Triage" },
  { icon: "▰", label: "Fleet & Responder Safety" },
  { icon: "◫", label: "DRRMO Intelligence" },
  { icon: "!", label: "Live SOS" },
  { icon: "◈", label: "Verified Alerts" },
  { icon: "☁", label: "Provincial Weather" },
  { icon: "⌖", label: "Risk Map" },
  { icon: "⌂", label: "Evacuation Centers" },
  { icon: "▣", label: "Resources" },
  { icon: "◎", label: "Response Groups" },
  { icon: "◌", label: "Communications" },
];

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

function formatTime(timestamp?: string | null) {
  if (!timestamp) return "Not yet sent";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function severityClass(value: string) {
  if (["critical", "received", "high", "active"].includes(value)) return "critical";
  if (["warning", "acknowledged", "medium", "monitoring", "low"].includes(value)) return "warning";
  return "advisory";
}

function stateClass(value: string) {
  if (["complete", "resolved", "open", "ready", "acknowledged"].includes(value)) return "good";
  if (["blocked", "unavailable", "full", "closed"].includes(value)) return "danger";
  return "neutral";
}

function notificationStatusClass(value: AssignmentNotification["status"]) {
  if (value === "delivered" || value === "acknowledged") return "good";
  if (value === "failed") return "danger";
  return "warning";
}

function CommandCenterLoader({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  const steps = ["Connecting", "Loading field status", "Loading communications", "Opening command center"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (error) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), 900);
    return () => window.clearInterval(timer);
  }, [error, steps.length]);
  return <main className="loading-screen" aria-busy="true" aria-live="polite">
    <section className="loading-card">
      <div className="loading-emblem-wrap"><span className="loading-halo" aria-hidden="true" /><img className="loading-emblem" src="/cfr-reference-emblem.png" alt="Code for Resilience resilience emblem" /></div>
      <div className="eyebrow">Code for Resilience</div>
      <h1>Balangiga command center</h1>
      {error ? <><p className="loading-copy">Refresh required before controls open.</p><div className="loading-error" role="alert">{error}</div><button className="primary-button" onClick={onRetry}>Retry refresh</button></> : <><p className="loading-copy">Preparing operational view.</p><div className="loading-progress" aria-hidden="true"><span style={{ width: `${Math.max(18, ((step + 1) / steps.length) * 100)}%` }} /></div><div className="loading-step"><span className="loading-step-dot" />{steps[step]}<span className="loading-ellipsis" aria-hidden="true">…</span></div></>}
      <div className="loading-footer"><span className="health-dot" />Offline-ready</div>
    </section>
  </main>;
}

function MetricCard({ label, value, note, icon, bg }: { label: string; value: number; note: string; icon: string; bg: string }) {
  return (
    <div className="metric-card" style={{ "--metric-bg": bg } as React.CSSProperties}>
      <span className="metric-icon">{icon}</span>
      <div className="metric-card-label">{label}</div>
      <div className="metric-number">{value.toLocaleString()}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="panel-header">
      <div><div className="panel-title">{title}</div><div className="panel-subtitle">{subtitle}</div></div>
      {action}
    </div>
  );
}

type CommandMapLayers = { weatherRadar: boolean; floodRisk: boolean; terrain: boolean };

function GISMapPanel({ snapshot, route, onAction, variant = "panel", commandLayers }: { snapshot: GisMapSnapshot; route?: OptimizedRoute | null; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; variant?: "panel" | "command"; commandLayers?: CommandMapLayers }) {
  const [layers, setLayers] = useState({ hazards: true, resources: true, sos: true, centers: true, route: true, radar: true, typhoon: true });
  const [basemap, setBasemap] = useState<"satellite" | "operational">("satellite");
  const commandMapMode = variant === "command";
  const displayedLayers = commandLayers ? { ...layers, hazards: commandLayers.floodRisk, radar: commandLayers.weatherRadar } : layers;
  const displayedBasemap = commandLayers?.terrain ? "operational" : basemap;
  const [regionalContext, setRegionalContext] = useState(false);
  const [selectedResource, setSelectedResource] = useState<GisResource | null>(null);
  const [updating, setUpdating] = useState(false);
  const [radar, setRadar] = useState<RadarSnapshot | null>(null);
  const [typhoon, setTyphoon] = useState<TyphoonSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [viewTransform, setViewTransform] = useState<MapViewportTransform>({ x: 0, y: 0, scale: 1 });
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: MapViewportTransform } | null>(null);
  const touchRef = useRef<{ distance: number; midpointX: number; midpointY: number; origin: MapViewportTransform } | null>(null);
  const operationalBbox = snapshot.bbox;
  const [minLon, minLat, maxLon, maxLat] = regionalContext ? EASTERN_VISAYAS_REGIONAL_BBOX : operationalBbox;
  const width = 860;
  const height = 430;
  const satelliteUrl = esriWorldImageryExportUrl([minLon, minLat, maxLon, maxLat], width, height);
  const weatherBbox = [minLon, minLat, maxLon, maxLat] as const;
  const latestRadarFrame = radar?.frames.at(-1);
  const radarTiles = useMemo(() => latestRadarFrame && radar?.host ? rainViewerTilesForBbox(weatherBbox, radar.host, latestRadarFrame.path, regionalContext ? 7 : 10) : [], [latestRadarFrame, radar?.host, regionalContext, weatherBbox]);
  const regionalPlaces = [
    { label: "Samar", latitude: 12.08, longitude: 125.1, kind: "province" },
    { label: "Eastern Samar", latitude: 11.35, longitude: 125.58, kind: "province" },
    { label: "Balangiga", latitude: 11.11, longitude: 125.39, kind: "focus" },
    { label: "Leyte", latitude: 10.94, longitude: 124.88, kind: "province" },
    { label: "Southern Leyte", latitude: 10.28, longitude: 125.05, kind: "province" },
    { label: "Leyte Gulf", latitude: 10.84, longitude: 125.48, kind: "water" },
  ] as const;
  const point = (position: { latitude: number; longitude: number }) => ({
    x: ((position.longitude - minLon) / Math.max(maxLon - minLon, 0.001)) * width,
    y: ((maxLat - position.latitude) / Math.max(maxLat - minLat, 0.001)) * height,
  });
  const linePath = (points: Array<{ latitude: number; longitude: number }>) => points.map((item, index) => { const p = point(item); return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ");
  const polygonPath = (points: Array<{ latitude: number; longitude: number }>) => `${linePath(points)} Z`;
  const weatherPoint = (position: { latitude: number; longitude: number }) => point(position);
  const typhoonPoint = typhoon?.active && typhoon.latitude != null && typhoon.longitude != null ? weatherPoint({ latitude: typhoon.latitude, longitude: typhoon.longitude }) : null;
  const typhoonOutsideExtent = typhoonPoint != null && (typhoonPoint.x < 0 || typhoonPoint.x > width || typhoonPoint.y < 0 || typhoonPoint.y > height);
  const visibleTyphoonPoint = typhoonPoint ? { x: Math.min(width - 22, Math.max(22, typhoonPoint.x)), y: Math.min(height - 22, Math.max(22, typhoonPoint.y)) } : null;
  const typhoonCoordinates = typhoon?.latitude != null && typhoon.longitude != null ? `${typhoon.latitude.toFixed(1)}°, ${typhoon.longitude.toFixed(1)}°` : "position unlisted";
  const zoomAround = (nextScale: number, anchorX = width / 2, anchorY = height / 2) => {
    setViewTransform((current) => {
      const scale = Math.min(8, Math.max(.5, nextScale));
      const ratio = scale / current.scale;
      return clampViewportTransform({ scale, x: anchorX - (anchorX - current.x) * ratio, y: anchorY - (anchorY - current.y) * ratio }, width, height);
    });
  };
  const resetViewport = () => setViewTransform({ x: 0, y: 0, scale: 1 });
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorX = ((event.clientX - bounds.left) / bounds.width) * width;
    const anchorY = ((event.clientY - bounds.top) / bounds.height) * height;
    zoomAround(viewTransform.scale * (event.deltaY < 0 ? 1.18 : .85), anchorX, anchorY);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("button, a, [role='button']")) return;
    if (event.pointerType === "touch") event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: viewTransform };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.pointerType === "touch") event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = drag.origin.x + ((event.clientX - drag.startX) / bounds.width) * width;
    const y = drag.origin.y + ((event.clientY - drag.startY) / bounds.height) * height;
    setViewTransform(clampViewportTransform({ ...drag.origin, x, y }, width, height));
  };
  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const touchDistance = (touches: TouchEvent<HTMLDivElement>["touches"]) => Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    touchRef.current = { distance: touchDistance(event.touches), midpointX: ((event.touches[0].clientX + event.touches[1].clientX) / 2 - bounds.left) / bounds.width * width, midpointY: ((event.touches[0].clientY + event.touches[1].clientY) / 2 - bounds.top) / bounds.height * height, origin: viewTransform };
  };
  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const pinch = touchRef.current;
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const ratio = touchDistance(event.touches) / pinch.distance;
    const nextScale = pinch.origin.scale * ratio;
    const scale = Math.min(8, Math.max(.5, nextScale));
    const scaleRatio = scale / pinch.origin.scale;
    setViewTransform(clampViewportTransform({ scale, x: pinch.midpointX - (pinch.midpointX - pinch.origin.x) * scaleRatio, y: pinch.midpointY - (pinch.midpointY - pinch.origin.y) * scaleRatio }, width, height));
  };
  const onTouchEnd = () => { touchRef.current = null; };
  useEffect(() => {
    const mapShell = mapShellRef.current;
    if (!mapShell) return;
    const containWheel = (event: globalThis.WheelEvent) => event.preventDefault();
    const containTouchMove = (event: globalThis.TouchEvent) => {
      if (event.touches.length > 0) event.preventDefault();
    };
    mapShell.addEventListener("wheel", containWheel, { passive: false });
    mapShell.addEventListener("touchmove", containTouchMove, { passive: false });
    return () => {
      mapShell.removeEventListener("wheel", containWheel);
      mapShell.removeEventListener("touchmove", containTouchMove);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const refreshWeather = async () => {
      try {
        const [nextRadar, nextTyphoon] = await Promise.all([getWeatherRadar(), getWeatherTyphoon()]);
        if (!active) return;
        setRadar(nextRadar); setTyphoon(nextTyphoon); setWeatherError(null);
      } catch {
        if (active) setWeatherError("Weather feeds are temporarily unavailable.");
      }
    };
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => { resetViewport(); }, [regionalContext]);
  const markPositionChecked = async () => {
    if (!selectedResource) return;
    setUpdating(true);
    try {
      const updated = await updateGisResourcePosition(selectedResource.id, {
        latitude: selectedResource.position.latitude,
        longitude: selectedResource.position.longitude,
        accuracy_meters: selectedResource.accuracy_meters ?? 20,
        battery_pct: selectedResource.battery_pct ?? undefined,
        state: selectedResource.state,
        source: "manual",
      });
      setSelectedResource(updated);
      await onAction("gis.resource_position_checked", "resource", updated.id, `Checked ${updated.label} position from the GIS map.`);
    } finally {
      setUpdating(false);
    }
  };
  return <section className={`panel map-panel gis-map-panel ${commandMapMode ? "command-map-hero" : ""}`}>
    {!commandMapMode && <PanelHeader title="Operational GIS map" subtitle={regionalContext ? "Eastern Samar regional context with Balangiga operational layers" : "Live resource positions, hazard polygons, SOS locations, centers, and optimized movement"} action={<div className="gis-header-controls"><div className="map-tools gis-basemap-controls" role="group" aria-label="Map basemap and extent"><button className={`map-tool ${basemap === "satellite" ? "active" : ""}`} aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</button><button className={`map-tool ${basemap === "operational" ? "active" : ""}`} aria-pressed={basemap === "operational"} onClick={() => setBasemap("operational")}>Operational</button><button className={`map-tool ${regionalContext ? "active" : ""}`} aria-pressed={regionalContext} onClick={() => setRegionalContext((current) => !current)}>{regionalContext ? "Balangiga focus" : "Regional context"}</button></div><div className="map-tools" role="group" aria-label="Operational map layers">{(["hazards", "resources", "sos", "centers", "route", "radar", "typhoon"] as const).map((layer) => <button key={layer} className={`map-tool ${layers[layer] ? "active" : ""}`} aria-pressed={layers[layer]} onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>{layer === "hazards" ? "Hazards" : layer === "resources" ? "Resources" : layer === "radar" ? "Radar" : layer === "typhoon" ? "Typhoon" : layer.toUpperCase()}</button>)}</div></div>} />}
    <div ref={mapShellRef} className="gis-map-shell" tabIndex={0} aria-label="Interactive map viewport. Drag to pan; use the mouse wheel or controls to zoom." onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <svg className={`gis-map-canvas ${displayedBasemap === "satellite" ? "satellite" : "operational"} ${commandMapMode ? "command-map-canvas" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={regionalContext ? "Satellite and operational regional map showing Balangiga, Eastern Samar, Leyte Gulf, and surrounding provincial context" : "Satellite and operational map of Balangiga response resources and evacuation constraints"}>
        <defs><clipPath id="gis-map-clip"><rect width={width} height={height} /></clipPath><pattern id="gis-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1" /></pattern><linearGradient id="gis-satellite-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#082436" stopOpacity=".08" /><stop offset="1" stopColor="#082436" stopOpacity=".28" /></linearGradient></defs>
        <g clipPath="url(#gis-map-clip)" transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
        {displayedBasemap === "satellite" ? <><rect width={width} height={height} fill="#153d4d" /><image href={satelliteUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="none" /><rect width={width} height={height} fill="url(#gis-satellite-shade)" /></> : <><rect width={width} height={height} fill={commandMapMode ? "#07141a" : "#dceff1"} /><path d={`M0 0 H${width} V92 C720 132 690 112 612 138 C492 178 420 108 330 134 C218 168 120 110 0 148 Z`} fill={commandMapMode ? "#0a2c35" : "#bde4df"} /><rect width={width} height={height} fill="url(#gis-grid)" opacity={commandMapMode ? ".14" : ".7"} /><path d={`M80 ${height - 36} C210 300 340 340 474 224 S724 160 840 74`} fill="none" stroke={commandMapMode ? "#70b9c5" : "#ffffff"} strokeWidth="10" strokeLinecap="round" opacity={commandMapMode ? ".72" : ".78"} /><path d={`M120 82 C248 176 340 116 440 192 S630 330 804 336`} fill="none" stroke={commandMapMode ? "#397886" : "#ffffff"} strokeWidth="7" strokeLinecap="round" opacity={commandMapMode ? ".78" : ".78"} /></>}
        {displayedLayers.radar && radarTiles.map((tile) => <image key={`${tile.z}-${tile.x}-${tile.y}`} className="gis-radar-overlay" href={tile.url} x={((tile.west - minLon) / (maxLon - minLon)) * width} y={((maxLat - tile.north) / (maxLat - minLat)) * height} width={((tile.east - tile.west) / (maxLon - minLon)) * width} height={((tile.north - tile.south) / (maxLat - minLat)) * height} preserveAspectRatio="none" />)}
        {regionalContext && <g className="gis-regional-labels">{regionalPlaces.map((place) => { const p = point(place); return <g key={place.label} className={place.kind}><circle cx={p.x} cy={p.y} r={place.kind === "focus" ? 10 : 4} /><text x={p.x + 8} y={p.y - 7}>{place.label}</text>{place.kind === "focus" && <circle className="gis-focus-ring" cx={p.x} cy={p.y} r="17" />}</g>; })}</g>}
        {displayedLayers.hazards && snapshot.hazards.map((hazard) => <path key={hazard.id} d={polygonPath(hazard.polygon)} fill={hazard.severity === "critical" ? "#ef4444" : "#f59e0b"} fillOpacity={hazard.status === "active" ? ".28" : ".13"} stroke={hazard.severity === "critical" ? "#be123c" : "#b45309"} strokeWidth="2" strokeDasharray={hazard.status === "active" ? undefined : "6 5"}><title>{hazard.name} · {hazard.action}</title></path>)}
        {displayedLayers.route && route && <path d={linePath(route.route)} fill="none" stroke="#0f766e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".2" />}
        {displayedLayers.route && route && <path d={linePath(route.route)} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><title>{route.center_name} · {route.route_status} · {route.avoided_hazard_count} hazards avoided</title></path>}
        {displayedLayers.centers && snapshot.centers.map((center) => { const p = point(center.position); return <g key={center.id} className="gis-marker gis-center-marker" transform={`translate(${p.x} ${p.y})`}><circle r="11" /><text x="0" y="4" textAnchor="middle">⌂</text><title>{center.name} · {center.occupancy_current}/{center.capacity_total}</title></g>; })}
        {displayedLayers.sos && snapshot.sos.map((incident) => { const p = point(incident.position); return <g key={incident.id} className="gis-marker gis-sos-marker" transform={`translate(${p.x} ${p.y})`}><circle r="9" /><text x="0" y="4" textAnchor="middle">!</text><title>{incident.summary} · {incident.status}</title></g>; })}
        {displayedLayers.resources && snapshot.resources.map((resource) => { const p = point(resource.position); return <g key={resource.id} className={`gis-marker gis-resource-marker ${selectedResource?.id === resource.id ? "selected" : ""}`} transform={`translate(${p.x} ${p.y})`} onClick={() => setSelectedResource(resource)} role="button" tabIndex={0}><circle r="10" /><text x="0" y="4" textAnchor="middle">{resource.kind === "medical" ? "+" : resource.kind === "boat" ? "⌁" : "•"}</text><title>{resource.label} · {resource.state} · {resource.reported_at ? formatAge(resource.reported_at) : "no position time"}</title></g>; })}
        {displayedLayers.typhoon && typhoon?.active && visibleTyphoonPoint && <>{typhoon.track.length > 1 && <path className="gis-typhoon-track" d={linePath(typhoon.track)} />}<g className="gis-typhoon-marker" transform={`translate(${visibleTyphoonPoint.x} ${visibleTyphoonPoint.y})`}><circle r="15" /><text textAnchor="middle" y="6">{typhoonOutsideExtent ? "↖" : "◌"}</text><text className="gis-typhoon-label" x="20" y="-14">{typhoon.name || "Tropical cyclone"}{typhoonOutsideExtent ? " · outside view" : ""}</text><title>{typhoon.name || "Tropical cyclone"} · {typhoonCoordinates} · PAGASA bulletin {typhoon.issued_at || "time not listed"}{typhoonOutsideExtent ? " · position lies outside this map extent" : ""}</title></g></>}
        </g>
      </svg>
      <div className="gis-zoom-controls" role="group" aria-label="Map zoom controls"><button aria-label="Zoom in" onClick={() => zoomAround(viewTransform.scale * 1.3)}>+</button><button aria-label="Zoom out" onClick={() => zoomAround(viewTransform.scale / 1.3)}>−</button><button aria-label="Reset map view" onClick={resetViewport}>Reset</button></div>
      <div className="gis-map-badge"><span className={`health-dot ${weatherError || radar?.stale || typhoon?.stale ? "stale" : ""}`} />{weatherError || (radar?.frames.length ? `Radar ${radar.stale ? "cached" : "updated"} ${formatAge(radar.fetched_at)}` : "Radar unavailable")} · {typhoon?.active ? `${typhoon.name || "Cyclone"} bulletin ${typhoon.stale ? "cached" : "updated"}` : "No active PAGASA cyclone marker"}</div>
      <div className="map-legend gis-legend"><span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> Active hazard</span><span className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }} /> Watch / closure</span><span className="legend-item"><span className="legend-dot" style={{ background: "#2563eb" }} /> Tracked resource</span><span className="legend-item"><span className="legend-dot" style={{ background: "#7c3aed" }} /> Radar / cyclone</span></div>
      <div className="gis-attribution">{displayedBasemap === "satellite" && <><a href="https://www.esri.com/en-us/arcgis/products/arcgis-living-atlas" target="_blank" rel="noreferrer">© Esri imagery</a><span> · </span></>}<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">Weather data by RainViewer</a><span> · </span><a href={typhoon?.source_url || "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin"} target="_blank" rel="noreferrer">PAGASA bulletin{typhoon?.issued_at ? ` · ${typhoon.issued_at}` : ""}</a></div>
    </div>
    {selectedResource && <div className="gis-inspector"><div><div className="eyebrow">Selected response asset</div><strong>{selectedResource.label}</strong><span>{selectedResource.owner} · {selectedResource.current_assignment || "No active assignment"}</span></div><div className="gis-inspector-metrics"><span><b>{selectedResource.state.replace("_", " ")}</b> state</span><span><b>{selectedResource.reported_at ? formatAge(selectedResource.reported_at) : "unknown"}</b> position age</span><span><b>{selectedResource.accuracy_meters ? `±${Math.round(selectedResource.accuracy_meters)}m` : "—"}</b> accuracy</span><span><b>{selectedResource.battery_pct == null ? "—" : `${selectedResource.battery_pct}%`}</b> battery</span></div><div className="inline-actions"><button className="tiny-button" disabled={updating} onClick={markPositionChecked}>{updating ? "Saving…" : "Mark position checked"}</button><button className="tiny-button" onClick={() => setSelectedResource(null)}>Close</button></div></div>}
    <div className="map-caption"><span>{regionalContext ? "Regional labels are geographic context only; live operations remain centered on Balangiga." : `${snapshot.resources.filter((resource) => resource.state !== "offline").length} tracked assets · ${snapshot.resources.filter((resource) => resource.reported_at && Date.now() - new Date(resource.reported_at).getTime() > 15 * 60 * 1000).length} stale over 15 min`}</span><span>{displayedBasemap === "satellite" ? "Imagery is not a live damage, flood, road-status, or safety feed." : "Position confidence and field confirmation remain dispatch guardrails"}</span></div>
  </section>;
}

function SosQueue({ incidents, onSelect }: { incidents: SosIncident[]; onSelect: (incident: SosIncident) => void }) {
  return (
    <section className="panel">
      <PanelHeader title="Priority SOS queue" subtitle="Sorted by severity, age, and triage state" action={<span className="panel-link">{incidents.length} tracked</span>} />
      <div className="sos-list">
        {incidents.map((incident) => <button className="sos-row" key={incident.id} onClick={() => onSelect(incident)}><span className={`severity-bar ${incident.severity === "warning" ? "warning" : ""}`} /><span><span className="sos-id">{incident.emergency_type} · {incident.barangay}</span><span className="sos-description">{incident.summary}</span></span><span className="sos-detail"><strong>{formatAge(incident.received_at)}</strong>{incident.channel.toUpperCase()} · ±{incident.location.accuracy_meters ?? "?"}m</span><span><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span></span><span className="sos-actions"><span className="chevron">›</span></span></button>)}
        {incidents.length === 0 && <div className="empty-state">No SOS records match the current operational filter.</div>}
      </div>
    </section>
  );
}

function AlertFeed({ alerts, health, onAction }: { alerts: AlertItem[]; health: FeedHealth[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  return (
    <section className="panel">
      <PanelHeader title="Verified alert feed" subtitle="Official and LGU-published information only" action={<button className="panel-link" onClick={() => onAction("feeds.reviewed", "feed_health", undefined, "Reviewed feed freshness from the overview.")}>Record review →</button>} />
      <div className="feed-health-strip">{health.map((item) => <div className="health-chip" key={item.source_name}><span className={`health-dot ${item.stale ? "stale" : ""}`} />{item.source_name}<strong>{item.stale ? "stale" : "verified"}</strong></div>)}</div>
      <div className="panel-body">{alerts.map((alert) => <article className="alert-card" key={alert.id}><div className="alert-card-top"><div className="alert-title">{alert.title}</div><span className={`badge ${alert.severity}`}>{alert.severity}</span></div><p className="alert-body">{alert.body}</p><div className="alert-meta"><span className="source-dot" />{alert.source_name} · issued {formatAge(alert.issued_at)} · expires {formatTime(alert.expires_at)}</div><div className="inline-actions"><button className="tiny-button" onClick={() => onAction("alert.verified", "verified_alert", alert.id, `Verified ${alert.title}`)}>Verify</button><button className="tiny-button" onClick={() => onAction("bulletin.queued", "verified_alert", alert.id, `Queued public bulletin for ${alert.title}`)}>Queue bulletin</button></div></article>)}</div>
    </section>
  );
}

function CenterList({ centers, onAction }: { centers: Center[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  return (
    <section className="panel">
      <PanelHeader title="Evacuation capacity" subtitle="Last verified center snapshot" action={<button className="panel-link" onClick={() => onAction("centers.capacity_reviewed", "evacuation_center", undefined, "Reviewed center capacity from overview.")}>Review →</button>} />
      <div className="panel-body">{centers.map((center) => { const ratio = Math.min(100, Math.round((center.occupancy_current / Math.max(center.capacity_total, 1)) * 100)); return <div className="center-row" key={center.id}><div><div className="center-name">{center.name}</div><div className="center-location">{center.barangay} · {center.amenities.slice(0, 2).join(" · ")}</div><div className="capacity-bar"><div className={`capacity-fill ${ratio > 75 ? "high" : ""}`} style={{ width: `${ratio}%` }} /></div></div><div className="center-count"><div>{center.occupancy_current}/{center.capacity_total}</div><div className={`center-status ${center.status !== "open" ? "muted" : ""}`}>{center.status}</div></div></div>; })}</div>
    </section>
  );
}

function CommandMapView({ summary, gis, groups, health, user, connection, onSelect, onNavigate, onAction, onRefresh, error }: { summary: DashboardSummary; gis: GisMapSnapshot; groups: ResponseGroupSnapshot; health: FeedHealth[]; user: UserIdentity | null; connection: "live" | "cached"; onSelect: (incident: SosIncident) => void; onNavigate: (tab: Tab) => void; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onRefresh: () => void; error: string | null }) {
  const [layers, setLayers] = useState<CommandMapLayers>({ weatherRadar: true, floodRisk: true, terrain: true });
  const [panelOpen, setPanelOpen] = useState(true);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("Selected barangays");
  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const normalizedQuery = query.trim().toLowerCase();
  const coordinateQuery = /^-?\d+(?:\.\d+)?\s*[,\s]\s*-?\d+(?:\.\d+)?$/.test(query.trim());
  const matchingZones = useMemo(() => Array.from(new Set([...summary.sos.map((incident) => incident.barangay), ...summary.centers.map((center) => center.barangay)])).filter((zone) => normalizedQuery && zone.toLowerCase().includes(normalizedQuery)).slice(0, 3), [normalizedQuery, summary.centers, summary.sos]);
  const matchingGroups = useMemo(() => groups.groups.filter((group) => normalizedQuery && `${group.id} ${group.call_sign} ${group.name}`.toLowerCase().includes(normalizedQuery)).slice(0, 3), [groups.groups, normalizedQuery]);
  const matchingIncidents = useMemo(() => summary.sos.filter((incident) => normalizedQuery && `${incident.id} ${incident.barangay} ${incident.emergency_type}`.toLowerCase().includes(normalizedQuery)).slice(0, 3), [normalizedQuery, summary.sos]);
  const topAlerts = useMemo(() => summary.alerts.filter((alert) => !alert.expires_at || new Date(alert.expires_at).getTime() > Date.now()).sort((left, right) => ({ critical: 0, warning: 1, advisory: 2 }[left.severity] - { critical: 0, warning: 1, advisory: 2 }[right.severity])).slice(0, 4), [summary.alerts]);
  const systemHealthy = connection === "live" && health.every((item) => !item.stale);
  const commandTime = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Manila" });
  const toggleLayer = (key: keyof CommandMapLayers) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedQuery) return;
    if (coordinateQuery) { setSearchStatus(`Coordinates located: ${query.trim()}`); return; }
    if (matchingIncidents[0]) { onSelect(matchingIncidents[0]); setSearchStatus(`Opened ${matchingIncidents[0].emergency_type} SOS record.`); return; }
    if (matchingGroups[0]) { setSearchStatus(`${matchingGroups[0].name} is visible in Responder Radar.`); return; }
    if (matchingZones[0]) { setSearchStatus(`${matchingZones[0]} is within the active operational map extent.`); return; }
    setSearchStatus("No operational record found for that search.");
  };
  const submitBroadcast = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    await onAction("broadcast.draft_started", "communications_plan", undefined, `Prepared mass-area notification for ${scope}: ${message.trim().slice(0, 160)}`);
    setMessage("");
    setBroadcastOpen(false);
  };
  return <main className="command-map-shell" aria-label="Command Map Live Operations">
    <GISMapPanel snapshot={gis} onAction={onAction} variant="command" commandLayers={layers} />
    <header className="command-map-topbar">
      <div className="command-map-brand"><img src="/cfr-reference-emblem.png" alt="EnvScie CommandCenter emblem" /><div><strong>EnvScie CommandCenter</strong><span>COMMAND MAP · LIVE OPERATIONS</span></div><time dateTime={now.toISOString()}>{commandTime} PST</time></div>
      <div className="command-search-wrap"><form className="command-search" onSubmit={runSearch}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSearchStatus(null); }} placeholder="Search coordinates, LGU zone, responder ID" aria-label="Search coordinates, LGU zones, or responder IDs" /><button type="submit">Search</button></form>{normalizedQuery && <div className="command-search-results" role="status">{coordinateQuery && <button type="button" onClick={() => setSearchStatus(`Coordinates located: ${query.trim()}`)}>◎ Coordinates · {query.trim()}</button>}{matchingIncidents.map((incident) => <button type="button" key={incident.id} onClick={() => onSelect(incident)}>! SOS · {incident.emergency_type} · {incident.barangay}</button>)}{matchingGroups.map((group) => <button type="button" key={group.id} onClick={() => setSearchStatus(`${group.name} is visible in Responder Radar.`)}>◎ Unit · {group.call_sign} · {group.name}</button>)}{matchingZones.map((zone) => <button type="button" key={zone} onClick={() => setSearchStatus(`${zone} is within the active operational map extent.`)}>⌖ LGU zone · {zone}</button>)}{!coordinateQuery && !matchingIncidents.length && !matchingGroups.length && !matchingZones.length && <span>No matching operational record.</span>}</div>}</div>
      <div className="command-map-session"><div className={`system-health ${systemHealthy ? "healthy" : "degraded"}`}><span />{systemHealthy ? "Systems connected" : "Review source health"}</div><button className="command-avatar" type="button" aria-label="Current operator profile">{user?.display_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DR"}</button></div>
    </header>
    {error && <div className="command-map-error" role="alert">Cached operating picture · {error}</div>}
    {searchStatus && <div className="command-search-status" role="status">{searchStatus}<button type="button" onClick={() => setSearchStatus(null)} aria-label="Dismiss search result">×</button></div>}
    <aside className={`situational-panel ${panelOpen ? "open" : "collapsed"}`} aria-label="Situational awareness"><div className="situational-panel-heading"><div><span>LIVE LAYERS</span><h2>Situational awareness</h2></div><button type="button" onClick={() => setPanelOpen((open) => !open)} aria-label={panelOpen ? "Collapse situational awareness" : "Expand situational awareness"}>{panelOpen ? "‹" : "›"}</button></div>{panelOpen && <><div className="layer-switches">{([{ key: "weatherRadar", label: "Live Weather Radar", accent: "violet" }, { key: "floodRisk", label: "Flood Risk Zones", accent: "coral" }, { key: "terrain", label: "Topography / Terrain", accent: "teal" }] as const).map((layer) => <label className="layer-switch" key={layer.key}><span><i className={layer.accent} />{layer.label}</span><button type="button" role="switch" aria-checked={layers[layer.key]} onClick={() => toggleLayer(layer.key)}><b /></button></label>)}</div><div className="situational-divider" /><div className="active-alerts-heading"><span>PRIORITY FEED</span><button type="button" onClick={() => onNavigate("Verified Alerts")}>View all</button></div><div className="command-alert-feed">{topAlerts.map((alert) => <button type="button" className={`command-alert ${severityClass(alert.severity)}`} key={alert.id} onClick={() => onNavigate("Verified Alerts")}><span className="command-alert-icon">{alert.severity === "critical" ? "!" : "△"}</span><span><strong>{alert.title}</strong><small>{alert.hazard || alert.source_name} · {formatAge(alert.issued_at)}</small></span></button>)}{!topAlerts.length && <div className="command-empty">No active verified alerts.</div>}</div></>}</aside>
    <section className="responder-radar" aria-label="Responder radar"><div className="responder-radar-heading"><div><span>FIELD UNITS</span><h2>Responder radar</h2></div><button type="button" onClick={() => onNavigate("Response Groups")}>Open roster →</button></div><div className="responder-carousel">{groups.groups.filter((group) => group.status !== "offline").slice(0, 8).map((group) => <button type="button" className={`responder-radar-card ${group.status}`} key={group.id} onClick={() => setSearchStatus(`${group.name} · ${group.location_label} · last updated ${formatAge(group.last_location_at)}`)}><span className="responder-status-dot" /><strong>{group.name}</strong><small>{group.vehicle_or_asset || group.group_type}</small><div><span>{group.status.replaceAll("_", " ")}</span><b>{group.estimated_response_minutes ? `${group.estimated_response_minutes} min` : "ETA —"}</b></div></button>)}{!groups.groups.length && <div className="command-empty">No responder groups are reporting.</div>}</div></section>
    <div className="command-map-quicklinks" aria-label="Operational workspaces"><button type="button" onClick={() => onNavigate("Incident Triage")}>Triage <b>{summary.metrics.untriaged_sos}</b></button><button type="button" onClick={() => onNavigate("Fleet & Responder Safety")}>Fleet <b>{groups.groups.filter((group) => group.status === "en_route" || group.status === "deployed").length}</b></button><button type="button" onClick={() => onNavigate("DRRMO Intelligence")}>Intel</button><button type="button" onClick={() => onNavigate("Evacuation Centers")}>Centers <b>{summary.metrics.open_centers}</b></button><button type="button" onClick={() => onNavigate("Communications")}>Comms</button></div>
    <button className="broadcast-fab" type="button" onClick={() => setBroadcastOpen(true)} aria-label="Open Mass Area Notification"><span aria-hidden="true">⌁</span><em>Broadcast</em></button>
    {broadcastOpen && <div className="mass-notification-backdrop" role="presentation" onClick={() => setBroadcastOpen(false)}><section className="mass-notification-modal" role="dialog" aria-modal="true" aria-label="Mass Area Notification" onClick={(event) => event.stopPropagation()}><div className="mass-notification-heading"><div><span>BROADCAST DRAFT</span><h2>Mass Area Notification</h2></div><button type="button" onClick={() => setBroadcastOpen(false)} aria-label="Close mass area notification">×</button></div><form onSubmit={(event) => void submitBroadcast(event)}><label>Audience scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option>Selected barangays</option><option>Municipal-wide</option><option>Evacuation centers</option><option>Response groups</option></select></label><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the approved notification draft…" /></label><p>Draft only. Radius selection, approval, and delivery confirmation remain required before any public transmission.</p><div className="mass-notification-actions"><button type="button" onClick={() => setBroadcastOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!message.trim()}>Save broadcast draft</button></div></form></section></div>}
  </main>;
}

type TriageRecord = {
  key: string;
  source: "sos" | "alert";
  id: string;
  severity: SosIncident["severity"];
  status: string;
  title: string;
  description: string;
  receivedAt: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
  channel?: string;
  sos?: SosIncident;
  alert?: AlertItem;
};

const triageChecklist = [
  { key: "source", label: "Source and timestamp checked" },
  { key: "location", label: "Location or barangay confirmed" },
  { key: "hazard", label: "Active hazards reviewed" },
  { key: "field", label: "Field or barangay contact attempted" },
];

function triageStatus(record: TriageRecord) {
  if (record.source === "alert") return "VERIFIED ALERT";
  if (record.status === "received") return "UNVERIFIED";
  if (record.status === "acknowledged") return "ACTIVE";
  if (record.status === "dispatched") return "DEPLOYED";
  return record.status.replaceAll("_", " ").toUpperCase();
}

function IncidentTriageView({ incidents, alerts, onAction, onRefresh, onReturn }: { incidents: SosIncident[]; alerts: AlertItem[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onRefresh: () => Promise<void>; onReturn: () => void }) {
  const [sort, setSort] = useState<"severity" | "time" | "unread">("severity");
  const [selectedKey, setSelectedKey] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const records = useMemo<TriageRecord[]>(() => [
    ...incidents.map((incident) => ({
      key: `sos:${incident.id}`, source: "sos" as const, id: incident.id, severity: incident.severity, status: incident.status,
      title: incident.emergency_type, description: incident.summary, receivedAt: incident.received_at,
      locationLabel: `${incident.barangay} · ${incident.location.latitude.toFixed(4)}, ${incident.location.longitude.toFixed(4)}`,
      latitude: incident.location.latitude, longitude: incident.location.longitude, channel: incident.channel, sos: incident,
    })),
    ...alerts.map((alert) => ({
      key: `alert:${alert.id}`, source: "alert" as const, id: alert.id, severity: alert.severity, status: "verified",
      title: alert.title, description: alert.body, receivedAt: alert.issued_at,
      locationLabel: `${alert.hazard || "LGU coverage"} · ${alert.source_name}`, alert,
    })),
  ], [alerts, incidents]);
  const sortedRecords = useMemo(() => {
    const severityRank: Record<SosIncident["severity"], number> = { critical: 0, warning: 1, advisory: 2 };
    const rows = sort === "unread" ? records.filter((record) => record.source === "sos" && record.status === "received") : [...records];
    return rows.sort((left, right) => sort === "time" ? new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime() : severityRank[left.severity] - severityRank[right.severity] || new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime());
  }, [records, sort]);
  const selected = sortedRecords.find((record) => record.key === selectedKey) || sortedRecords[0] || null;
  const verificationComplete = triageChecklist.every((item) => checks[item.key]);

  useEffect(() => {
    if (!selectedKey || !records.some((record) => record.key === selectedKey)) setSelectedKey(records[0]?.key || "");
  }, [records, selectedKey]);
  useEffect(() => {
    setChecks({}); setRecommendation(null); setRecommendationError(null); setActionStatus(null);
    if (!selected?.sos) return;
    const requiredSpecialties = /flood|water|trapped/i.test(selected.sos.emergency_type) ? ["water_rescue"] : selected.sos.emergency_type === "MEDICAL" ? ["medical"] : [];
    setLoadingRecommendation(true);
    void getDispatchRecommendations({ incident_id: selected.sos.id, severity: selected.sos.severity, emergency_type: selected.sos.emergency_type, latitude: selected.sos.location.latitude, longitude: selected.sos.location.longitude, required_specialties: requiredSpecialties, max_results: 3 })
      .then(setRecommendation)
      .catch((error) => setRecommendationError(error instanceof Error ? error.message : "Recommendations are unavailable."))
      .finally(() => setLoadingRecommendation(false));
  }, [selected?.key]);

  const toggleCheck = (item: typeof triageChecklist[number]) => {
    if (!selected) return;
    const checked = !checks[item.key];
    setChecks((current) => ({ ...current, [item.key]: checked }));
    void onAction("triage.checklist_updated", selected.source === "sos" ? "sos_request" : "alert", selected.id, `${item.label}: ${checked ? "complete" : "cleared"}.`);
  };
  const acknowledge = async () => {
    if (!selected?.sos || selected.sos.status !== "received" || !verificationComplete) return;
    setActionStatus(null);
    try {
      await updateSosStatus(selected.sos.id, "acknowledged", "Acknowledged after LGU triage checklist completion.");
      await onAction("sos.acknowledged", "sos_request", selected.sos.id, "Acknowledged after LGU triage checklist completion.");
      setActionStatus("Incident acknowledged and retained for dispatcher review.");
      await onRefresh();
    } catch (error) { setActionStatus(error instanceof Error ? error.message : "Acknowledgement could not be recorded."); }
  };
  const deployTopRecommendation = async () => {
    const top = recommendation?.recommendations[0];
    if (!selected?.sos || !top || deploying || !verificationComplete) return;
    setDeploying(true); setActionStatus(null);
    try {
      await assignResponseGroup({ group_id: top.group_id, target_type: "sos_request", target_id: selected.sos.id, assignment_note: `Dispatcher accepted triage recommendation #${top.rank}: readiness ${top.score}/100; ETA ${top.estimated_response_minutes ?? "unknown"} min.` });
      await onAction("triage.recommendation_deployed", "sos_request", selected.sos.id, `Dispatcher deployed ${top.group_name} from triage recommendation #${top.rank}.`);
      setActionStatus(`${top.group_name} assigned. Confirm route clearance and field acknowledgement before movement.`);
      await onRefresh();
    } catch (error) { setActionStatus(error instanceof Error ? error.message : "Deployment could not be recorded."); }
    finally { setDeploying(false); }
  };

  return <main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="Incident Triage SOS and Alerts">
    <header className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · HIGH-VOLUME INTAKE</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">Incident Triage <span className="font-normal text-slate-400">/ SOS & Alerts</span></h1></div><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></header>
    <section className="mx-auto grid max-w-[1800px] gap-4 pt-4 lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]" aria-label="Incident triage split pane">
      <aside className="flex min-h-[42vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl lg:min-h-[calc(100vh-132px)]"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4"><div><h2 className="m-0 text-base font-semibold text-white">Incoming Alerts</h2><p className="m-0 mt-1 text-xs text-slate-400">{sortedRecords.length} records in view</p></div><select aria-label="Rapid alert sorting" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-lg border border-white/15 bg-slate-950 px-2 py-2 text-xs font-medium text-slate-200 outline-none ring-teal-300 focus:ring-2"><option value="severity">Sort by Severity</option><option value="time">Sort by Time</option><option value="unread">Unread</option></select></div><div className="flex-1 space-y-2 overflow-y-auto p-3 pr-2">{sortedRecords.map((record) => <button type="button" key={record.key} onClick={() => setSelectedKey(record.key)} aria-pressed={selected?.key === record.key} className={`w-full border-l-4 p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-teal-300 ${record.severity === "critical" ? "border-red-500 bg-red-500/10 hover:bg-red-500/15" : record.severity === "warning" ? "border-amber-400 bg-amber-300/10 hover:bg-amber-300/15" : "border-teal-300 bg-white/5 hover:bg-white/10"} ${selected?.key === record.key ? "ring-1 ring-teal-300" : ""}`}><div className="flex items-start justify-between gap-3"><span className="text-xs font-medium text-slate-300">{formatAge(record.receivedAt)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${record.severity === "critical" ? "bg-red-500 text-white" : record.severity === "warning" ? "bg-amber-300 text-slate-950" : "bg-teal-300 text-slate-950"}`}>{record.source === "sos" ? "SOS" : "ALERT"}</span></div><strong className="mt-3 block text-sm text-white">{record.title}</strong><p className="mb-0 mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{record.description}</p><span className="mt-3 block text-[11px] text-slate-400">◎ {record.locationLabel}</span></button>)}{!sortedRecords.length && <div className="p-6 text-center text-sm text-slate-400">No incoming alerts match this filter.</div>}</div></aside>
      <section className="min-h-[54vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl lg:min-h-[calc(100vh-132px)]">{selected ? <div className="flex h-full flex-col"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-5"><div><p className="m-0 text-[10px] font-bold tracking-[0.22em] text-teal-300">{selected.source === "sos" ? "INCOMING SOS" : "VERIFIED EXTERNAL ALERT"}</p><h2 className="m-0 mt-1 break-all text-2xl font-bold text-white sm:text-3xl">{selected.id}</h2><p className="mb-0 mt-2 text-sm text-slate-300">{selected.title} · {selected.locationLabel}</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide ${selected.sos?.status === "received" ? "border-red-400/60 bg-red-500/15 text-red-200" : "border-teal-300/40 bg-teal-300/10 text-teal-200"}`}>[{triageStatus(selected)}]</span></div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><div className="space-y-4"><details className="rounded-xl border border-white/10 bg-slate-950/60 p-4" open><summary className="cursor-pointer text-sm font-semibold text-white">Codec decoder <span className="ml-2 text-xs font-normal text-slate-400">Raw payload → operational fields</span></summary><pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5 text-teal-100">{selected.sos ? `CR-SOS|${selected.sos.id}|${selected.sos.emergency_type}|${selected.sos.severity}|${selected.sos.location.latitude.toFixed(6)},${selected.sos.location.longitude.toFixed(6)}|${selected.sos.channel}` : `LGU-ALERT|${selected.alert?.source_name}|${selected.alert?.source_event_id}|${selected.alert?.severity}|${selected.alert?.hazard || "general"}`}</pre><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><div><dt className="text-slate-500">Urgency</dt><dd className="m-0 mt-1 font-semibold capitalize text-white">{selected.severity}</dd></div><div><dt className="text-slate-500">State</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.sos?.emergency_type || selected.alert?.hazard || "External warning"}</dd></div><div><dt className="text-slate-500">Ingress</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.channel || selected.alert?.source_name || "API"}</dd></div></dl></details><section className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="m-0 text-sm font-semibold text-white">LGU verification checklist</h3><p className="mb-0 mt-1 text-xs text-slate-400">Checklist updates are recorded in the operations audit trail.</p></div><span className="text-xs text-teal-200">{Object.values(checks).filter(Boolean).length}/{triageChecklist.length}</span></div><div className="mt-4 space-y-2">{triageChecklist.map((item) => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[.03] px-3 py-3"><span className="text-sm text-slate-200">{item.label}</span><button type="button" role="switch" aria-checked={!!checks[item.key]} onClick={() => toggleCheck(item)} className={`relative h-6 w-11 rounded-full transition ${checks[item.key] ? "bg-teal-300" : "bg-slate-700"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checks[item.key] ? "left-6" : "left-1"}`} /></button></label>)}</div>{selected.sos?.status === "received" && <button type="button" disabled={!verificationComplete} onClick={() => void acknowledge()} className="mt-4 w-full rounded-lg bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Verify and acknowledge SOS</button>}</section></div>
          <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.2em] text-amber-300">WMCDA DISPATCH RECOMMENDATIONS</p><h3 className="m-0 mt-1 text-lg font-semibold text-white">Ranked response groups</h3></div>{loadingRecommendation && <span className="text-xs text-slate-400">Ranking…</span>}</div>{selected.source === "alert" ? <div className="mt-5 rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">A field location is required before ranking a response group for this external alert.</div> : recommendationError ? <div className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{recommendationError}</div> : recommendation ? <div className="mt-5 space-y-3">{recommendation.recommendations.slice(0, 3).map((item, index) => <article key={item.group_id} className={`rounded-xl border p-4 ${index === 0 ? "border-teal-300/70 bg-teal-300/10" : "border-white/10 bg-white/[.03]"}`}><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold tracking-[0.18em] text-slate-400">RANK {item.rank}</span><h4 className="m-0 mt-1 text-sm font-semibold text-white">{item.group_name}</h4></div><span className="rounded bg-slate-950 px-2 py-1 text-xs font-bold text-teal-200">{item.score}/100</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300"><span>Readiness score {item.score}</span><span>ETA {item.estimated_response_minutes ?? "—"} min</span><span>Freshness {item.freshness_minutes} min</span></div><p className="mb-0 mt-3 text-xs leading-5 text-slate-400">{item.reasons[0] || "Ranked by operational readiness, specialty, distance, and constraints."}</p>{index === 0 && <button type="button" disabled={!verificationComplete || deploying || item.eligibility === "ineligible"} onClick={() => void deployTopRecommendation()} className="mt-4 w-full rounded-lg bg-orange-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{deploying ? "Deploying…" : "Deploy"}</button>}</article>)}<p className="mb-0 text-xs text-slate-500">Recommendations are advisory. Deployment does not clear routes or override responder-safety holds.</p></div> : <div className="mt-5 rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">Select an SOS record to request the top three eligible response-group rankings.</div>}{actionStatus && <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm text-teal-100" role="status">{actionStatus}</div>}</section></div></div> : <div className="grid h-full place-items-center p-8 text-center text-slate-400">Select an incoming SOS or alert to begin verification.</div>}</section>
    </section>
  </main>;
}

type FleetFilter = "all" | "idle" | "en_route" | "on_scene";
type FleetSort = "unit" | "status" | "assignment" | "eta";

function fleetBucket(group: ResponseGroup): Exclude<FleetFilter, "all"> {
  if (group.status === "deployed") return "on_scene";
  if (group.status === "en_route" || group.status === "returning") return "en_route";
  return "idle";
}

function fleetStatusLabel(group: ResponseGroup) {
  if (group.status === "deployed") return "On scene";
  if (group.status === "en_route") return "En route";
  if (group.status === "returning") return "Returning";
  if (group.status === "offline" || group.availability === "offline") return "Offline";
  if (group.availability === "limited") return "Limited";
  if (group.status === "standby") return "Standby";
  return "Available";
}

function fleetStatusTone(group: ResponseGroup) {
  if (group.status === "offline" || group.availability === "offline") return "border-slate-500/70 bg-slate-700/70 text-slate-200";
  if (group.status === "deployed") return "border-orange-300/50 bg-orange-400/15 text-orange-200";
  if (group.status === "en_route" || group.status === "returning") return "border-sky-300/50 bg-sky-400/15 text-sky-100";
  if (group.availability === "limited") return "border-amber-300/50 bg-amber-300/15 text-amber-100";
  return "border-teal-300/45 bg-teal-300/10 text-teal-100";
}

function pointWithinPolygon(point: { latitude: number; longitude: number }, polygon: Array<{ latitude: number; longitude: number }>) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]; const previousPoint = polygon[previous];
    const crosses = (currentPoint.latitude > point.latitude) !== (previousPoint.latitude > point.latitude);
    const intersectionLongitude = ((previousPoint.longitude - currentPoint.longitude) * (point.latitude - currentPoint.latitude)) / ((previousPoint.latitude - currentPoint.latitude) || Number.EPSILON) + currentPoint.longitude;
    if (crosses && point.longitude < intersectionLongitude) inside = !inside;
  }
  return inside;
}

function FleetResponderSafetyView({ groups, gis, onAction, onRefresh, onReturn }: { groups: ResponseGroupSnapshot; gis: GisMapSnapshot; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onRefresh: () => Promise<void>; onReturn: () => void }) {
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FleetSort>("unit");
  const [sortAscending, setSortAscending] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [hailConfirmOpen, setHailConfirmOpen] = useState(false);
  const now = Date.now();
  const activeHazards = useMemo(() => gis.hazards.filter((hazard) => hazard.status === "active"), [gis.hazards]);
  const fleetUnits = useMemo(() => groups.groups.map((group) => {
    const identifiers = [group.id, group.name, group.call_sign, group.vehicle_or_asset].map((value) => value.toLowerCase()).filter((value) => value.length > 3);
    const telemetry = gis.resources.find((resource) => {
      const values = [resource.id, resource.label, resource.owner, resource.current_assignment || ""].map((value) => value.toLowerCase());
      return identifiers.some((identifier) => values.some((value) => value.includes(identifier) || identifier.includes(value)));
    });
    const position = telemetry?.position || group.location;
    const locationAge = Math.max(0, Math.floor((now - new Date(telemetry?.reported_at || group.last_location_at).getTime()) / 60000));
    const checkInAge = Math.max(0, Math.floor((now - new Date(group.last_check_in_at).getTime()) / 60000));
    const overlappingHazards = activeHazards.filter((hazard) => pointWithinPolygon(position, hazard.polygon));
    const reviewTriggers = [
      ...(group.constraints.length ? [`Recorded constraint${group.constraints.length === 1 ? "" : "s"}: ${group.constraints.slice(0, 2).join("; ")}`] : []),
      ...(group.availability === "offline" || group.status === "offline" ? ["Unit is marked offline."] : []),
      ...(locationAge > 15 ? [`Location report is ${locationAge} minutes old.`] : []),
      ...(checkInAge > 15 ? [`Field check-in is ${checkInAge} minutes old.`] : []),
      ...(telemetry?.state === "stale" || telemetry?.state === "offline" ? [`Telemetry state is ${telemetry.state.replace("_", " ")}.`] : []),
      ...(overlappingHazards.length ? [`Position overlaps active GIS hazard geometry: ${overlappingHazards.map((hazard) => hazard.name).join(", ")}.`] : []),
    ];
    return { group, telemetry, position, locationAge, checkInAge, overlappingHazards, reviewTriggers };
  }), [activeHazards, gis.resources, groups.groups, now]);
  const filteredUnits = useMemo(() => fleetUnits.filter(({ group }) => {
    const searchable = `${group.id} ${group.name} ${group.call_sign} ${group.lead} ${group.personnel_ready}/${group.personnel_total}`.toLowerCase();
    return (filter === "all" || fleetBucket(group) === filter) && searchable.includes(query.trim().toLowerCase());
  }).sort((left, right) => {
    const leftValue = sort === "unit" ? `${left.group.call_sign} ${left.group.name}` : sort === "status" ? fleetStatusLabel(left.group) : sort === "assignment" ? left.group.current_assignment || "" : String(left.group.estimated_response_minutes ?? Number.MAX_SAFE_INTEGER);
    const rightValue = sort === "unit" ? `${right.group.call_sign} ${right.group.name}` : sort === "status" ? fleetStatusLabel(right.group) : sort === "assignment" ? right.group.current_assignment || "" : String(right.group.estimated_response_minutes ?? Number.MAX_SAFE_INTEGER);
    const compared = sort === "eta" ? Number(leftValue) - Number(rightValue) : leftValue.localeCompare(rightValue);
    return sortAscending ? compared : -compared;
  }), [filter, fleetUnits, query, sort, sortAscending]);
  const selected = fleetUnits.find((unit) => unit.group.id === selectedId) || filteredUnits[0] || fleetUnits[0] || null;
  const readinessBase = fleetUnits.filter(({ group }) => group.availability !== "offline" && group.status !== "offline");
  const readinessScore = readinessBase.length ? Math.round(readinessBase.reduce((total, { group }) => total + group.readiness_score, 0) / readinessBase.length) : 0;
  const activeDeployments = fleetUnits.filter(({ group }) => group.status === "en_route" || group.status === "deployed").length;
  const reviewCount = fleetUnits.filter((unit) => unit.reviewTriggers.length > 0).length;
  const reviewRequired = Boolean(selected?.reviewTriggers.length);
  const selectedPosition = selected?.position;
  const selectSort = (nextSort: FleetSort) => { if (nextSort === sort) setSortAscending((current) => !current); else { setSort(nextSort); setSortAscending(true); } };
  useEffect(() => {
    if (!selectedId || !fleetUnits.some((unit) => unit.group.id === selectedId)) setSelectedId(fleetUnits[0]?.group.id || "");
  }, [fleetUnits, selectedId]);
  useEffect(() => {
    if (filteredUnits.length && !filteredUnits.some((unit) => unit.group.id === selectedId)) setSelectedId(filteredUnits[0].group.id);
  }, [filteredUnits, selectedId]);
  useEffect(() => { setRoute(null); setActionStatus(null); setHailConfirmOpen(false); }, [selected?.group.id]);

  const calculateRoute = async (reason: "recalculate" | "reroute_review") => {
    if (!selected || !selectedPosition || routeLoading) return;
    setRouteLoading(true); setActionStatus(null);
    try {
      const nextRoute = await optimizeGisRoute(selectedPosition.latitude, selectedPosition.longitude);
      setRoute(nextRoute);
      await onAction(reason === "recalculate" ? "fleet.route_recalculated" : "fleet.force_reroute_review_requested", "response_group", selected.group.id, `${reason === "recalculate" ? "Generated" : "Requested coordinator review of"} advisory route preview for ${selected.group.name}; engine status ${nextRoute.route_status}; blocked segments ${nextRoute.blocked_segment_count}. No route clearance or movement instruction was created.`);
      setActionStatus(`Advisory route preview ${nextRoute.route_status}. ${nextRoute.warnings[0] || "Confirm road, hazard, and field conditions before movement."}`);
    } catch (error) { setActionStatus(error instanceof Error ? error.message : "Route preview could not be calculated."); }
    finally { setRouteLoading(false); }
  };
  const sendHail = async () => {
    if (!selected || actionBusy || !reviewRequired) return;
    setActionBusy(true); setActionStatus(null);
    try {
      const target = `${selected.group.call_sign} · ${selected.group.name}`;
      await sendCoordinationCommunication({ channel: "VHF", to_unit: target, message: `Safety review requested by command center. Confirm position, welfare, route conditions, and readiness to proceed. Report current status before movement.`, priority: "urgent", linked_incident_id: selected.group.current_assignment || undefined, simulate_audio: false });
      await onAction("fleet.safety_hail_sent", "response_group", selected.group.id, `Operator-confirmed VHF safety hail sent to ${target} for review trigger(s): ${selected.reviewTriggers.join(" ")}`);
      setActionStatus(`Safety hail sent to ${target}. Await acknowledgement before relying on this check.`);
      setHailConfirmOpen(false);
      await onRefresh();
    } catch (error) { setActionStatus(error instanceof Error ? error.message : "Safety hail could not be sent."); }
    finally { setActionBusy(false); }
  };
  const recordMobileDraft = async () => {
    if (!selected || !route || actionBusy) return;
    setActionBusy(true); setActionStatus(null);
    try {
      await onAction("fleet.mobile_route_draft_recorded", "response_group", selected.group.id, `Audited route-push draft for ${selected.group.name}: route status ${route.route_status}, destination ${route.center_name}. No mobile delivery endpoint is configured and no route was transmitted.`);
      setActionStatus("Route-push draft audited. No mobile delivery endpoint is configured, so nothing was transmitted.");
    } finally { setActionBusy(false); }
  };
  const miniWidth = 420; const miniHeight = 170; const miniSpan = 0.018;
  const miniPoint = (position: { latitude: number; longitude: number }) => ({ x: Math.max(8, Math.min(miniWidth - 8, miniWidth / 2 + ((position.longitude - (selectedPosition?.longitude || 0)) / miniSpan) * miniWidth)), y: Math.max(8, Math.min(miniHeight - 8, miniHeight / 2 - ((position.latitude - (selectedPosition?.latitude || 0)) / miniSpan) * miniHeight)) });
  const miniRoute = route?.route.map((point, index) => { const p = miniPoint(point); return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ") || "";
  const localHazards = activeHazards.filter((hazard) => hazard.polygon.some((point) => Math.abs(point.latitude - (selectedPosition?.latitude || 0)) < miniSpan && Math.abs(point.longitude - (selectedPosition?.longitude || 0)) < miniSpan));

  return <main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="Fleet and Responder Safety dashboard">
    <header className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · ASSET READINESS AND FIELD PROTECTION</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">Fleet <span className="font-normal text-slate-400">/ Responder Safety</span></h1></div><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></header>
    <section className="mx-auto grid max-w-[1800px] gap-3 py-4 sm:grid-cols-3" aria-label="Fleet KPI dashboard"><article className="rounded-xl border border-teal-300/25 bg-teal-300/[.08] px-4 py-3"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-200">TOTAL FLEET READINESS</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl text-white">{readinessScore}<span className="text-base text-slate-400">/100</span></strong><span className="text-xs text-slate-300">{readinessBase.length}/{fleetUnits.length} non-offline units</span></div></article><article className="rounded-xl border border-sky-300/25 bg-sky-300/[.08] px-4 py-3"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-sky-200">ACTIVE DEPLOYMENTS</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl text-white">{activeDeployments}</strong><span className="text-xs text-slate-300">en route or on scene</span></div></article><article className={`rounded-xl border px-4 py-3 ${reviewCount ? "border-red-400 bg-red-500/15" : "border-white/15 bg-white/[.04]"}`}><p className={`m-0 text-[10px] font-bold tracking-[0.18em] ${reviewCount ? "text-red-100" : "text-slate-300"}`}>SAFETY BREACHES <span className="font-normal">/ REVIEW FLAGS</span></p><div className="mt-2 flex items-end justify-between gap-3"><strong className={`text-3xl text-white ${reviewCount ? "animate-pulse motion-reduce:animate-none" : ""}`}>{reviewCount}</strong><span className={`text-xs ${reviewCount ? "text-red-100" : "text-slate-300"}`}>{reviewCount ? "needs coordinator review" : "no current review flags"}</span></div></article></section>
    <section className="mx-auto grid max-w-[1800px] gap-4 lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]" aria-label="Fleet deployment and selected unit console">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl"><div className="flex flex-col gap-3 border-b border-white/10 p-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">DEPLOYMENT MATRIX</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Physical asset roster</h2></div><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Search fleet by unit ID or personnel" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Unit ID or personnel" className="min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-teal-300" /><div className="flex rounded-lg border border-white/15 bg-slate-950 p-1" role="group" aria-label="Fleet status filters">{(["all", "idle", "en_route", "on_scene"] as FleetFilter[]).map((item) => <button type="button" key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${filter === item ? "bg-teal-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>{item === "all" ? "All" : item === "idle" ? "Idle" : item === "en_route" ? "En Route" : "On-Scene"}</button>)}</div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-white/10 bg-slate-950/60 text-[10px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-4 py-3"><button type="button" onClick={() => selectSort("unit")} className="font-bold text-inherit">Unit ID {sort === "unit" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-3 py-3"><button type="button" onClick={() => selectSort("status")} className="font-bold text-inherit">Status {sort === "status" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-3 py-3"><button type="button" onClick={() => selectSort("assignment")} className="font-bold text-inherit">Assignment {sort === "assignment" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-4 py-3 text-right"><button type="button" onClick={() => selectSort("eta")} className="font-bold text-inherit">Target ETA {sort === "eta" ? (sortAscending ? "↑" : "↓") : ""}</button></th></tr></thead><tbody>{filteredUnits.map((unit) => <tr key={unit.group.id} onClick={() => setSelectedId(unit.group.id)} aria-selected={selected?.group.id === unit.group.id} className={`cursor-pointer border-b border-white/[.07] transition hover:bg-white/[.05] ${selected?.group.id === unit.group.id ? "bg-teal-300/[.09]" : ""}`}><td className="px-4 py-3"><strong className="block text-sm text-white">{unit.group.call_sign || unit.group.id}</strong><span className="block max-w-[240px] truncate text-xs text-slate-400">{unit.group.name} · {unit.group.lead}</span></td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${fleetStatusTone(unit.group)}`}>{fleetStatusLabel(unit.group)}</span></td><td className="max-w-[250px] px-3 py-3"><span className="block truncate text-xs text-slate-200">{unit.group.current_assignment || "Unassigned / monitoring"}</span><span className="block text-[10px] text-slate-500">{unit.group.vehicle_or_asset}</span></td><td className="px-4 py-3 text-right"><strong className="text-sm text-white">{unit.group.estimated_response_minutes == null ? "—" : `${unit.group.estimated_response_minutes} min`}</strong><span className="mt-1 block text-[10px] text-slate-500">readiness {unit.group.readiness_score}/100</span></td></tr>)}{!filteredUnits.length && <tr><td colSpan={4} className="p-8 text-center text-sm text-slate-400">No fleet units match this filter.</td></tr>}</tbody></table></div><p className="m-0 border-t border-white/10 px-4 py-3 text-xs text-slate-400">Select a unit to update the local GPS context, reported telemetry, and advisory safety review panes.</p></section>
      <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(250px,.86fr)_minmax(410px,1.14fr)]">{selected ? <><section className={`rounded-2xl border p-4 shadow-command ${reviewRequired ? "border-red-400 bg-red-500/[.12]" : "border-slate-500/60 bg-slate-900/90"}`} aria-label="Hazard Proximity Monitor"><div className="flex items-start justify-between gap-3"><div><p className={`m-0 text-[10px] font-bold tracking-[0.18em] ${reviewRequired ? "text-red-100" : "text-slate-400"}`}>HAZARD PROXIMITY MONITOR</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">{selected.group.call_sign || selected.group.name}</h2></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${reviewRequired ? "border-red-200/70 bg-red-500 text-white" : "border-slate-500 bg-slate-800 text-slate-200"}`}>{reviewRequired ? "Safety review" : "No review trigger"}</span></div>{reviewRequired ? <><div className="mt-4 flex gap-3 rounded-xl border border-red-300/45 bg-black/15 p-3"><span className="text-xl text-red-200" aria-hidden="true">⚠</span><div><strong className="text-sm text-red-50">Safety review required</strong><ul className="mb-0 mt-2 space-y-1 pl-4 text-xs leading-5 text-red-100">{selected.reviewTriggers.map((trigger) => <li key={trigger}>{trigger}</li>)}</ul></div></div><p className="mb-0 mt-3 text-xs leading-5 text-red-100">This is an advisory review hold. Confirm field conditions, communications, and route viability; map geometry does not establish a safety clearance.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={actionBusy} onClick={() => setHailConfirmOpen(true)} className="rounded-lg bg-white px-3 py-2.5 text-xs font-bold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Hail Unit via Comms</button><button type="button" disabled={routeLoading} onClick={() => void calculateRoute("reroute_review")} title="Creates an advisory route preview and audit record; it does not force a field reroute." className="rounded-lg border border-red-200/70 bg-red-700/50 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{routeLoading ? "Reviewing…" : "Force Reroute"}</button></div></> : <div className="mt-5 rounded-xl border border-slate-600 bg-slate-950/45 p-4 text-sm text-slate-300"><strong className="block text-slate-100">All units within safe operational perimeters.</strong><span className="mt-2 block text-xs leading-5 text-slate-400">No selected review trigger is present in the current roster, telemetry, or active GIS geometry. Continue field confirmation before movement.</span><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled className="rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-bold text-slate-500">Hail Unit via Comms</button><button type="button" disabled className="rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-bold text-slate-500">Force Reroute</button></div></div>}</section>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-command" aria-label="Dynamic Routing Console"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">DYNAMIC ROUTING CONSOLE</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Local GPS context</h2></div><span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-100">GPS focus</span></div><div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#071820]"><svg viewBox={`0 0 ${miniWidth} ${miniHeight}`} className="block h-40 w-full" role="img" aria-label={`Localized map preview centered on ${selected.group.name}`}><defs><pattern id="fleet-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#5eead4" strokeOpacity=".16" strokeWidth="1" /></pattern><clipPath id="fleet-mini-clip"><rect width={miniWidth} height={miniHeight} /></clipPath></defs><rect width={miniWidth} height={miniHeight} fill="#08232a" /><rect width={miniWidth} height={miniHeight} fill="url(#fleet-grid)" /><path d="M-20 132 C85 98 142 182 234 120 S356 38 448 74" fill="none" stroke="#488391" strokeWidth="18" opacity=".45" />{localHazards.map((hazard) => <path key={hazard.id} clipPath="url(#fleet-mini-clip)" d={`${hazard.polygon.map((point, index) => { const p = miniPoint(point); return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ")} Z`} fill="#ef4444" fillOpacity=".3" stroke="#fca5a5" strokeWidth="2" />)}{miniRoute && <path d={miniRoute} fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}{route && <g transform={`translate(${miniPoint(route.route.at(-1) || selected.position).x} ${miniPoint(route.route.at(-1) || selected.position).y})`}><circle r="7" fill="#fbbf24" stroke="#fff" strokeWidth="2" /><title>{route.center_name}</title></g>}<g transform={`translate(${miniWidth / 2} ${miniHeight / 2})`}><circle r="15" fill="#2dd4bf" fillOpacity=".14" /><circle r="6" fill="#2dd4bf" stroke="#ecfeff" strokeWidth="2" /><path d="M0 -11V-20" stroke="#ecfeff" strokeWidth="2" /></g><text x="12" y="20" fill="#ccfbf1" fontSize="10" fontWeight="700">LOCKED TO SELECTED GPS POSITION</text></svg><div className="flex flex-wrap justify-between gap-2 border-t border-white/10 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-300"><span>{selectedPosition.latitude.toFixed(5)}, {selectedPosition.longitude.toFixed(5)}</span><span>{localHazards.length ? `${localHazards.length} active hazard geometry in local view` : "No active hazard geometry in local view"}</span></div></div><dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Speed</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.speed_kph == null ? "Not reported" : `${selected.telemetry.speed_kph} kph`}</dd></div><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Last ping</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.reported_at || selected.group.last_location_at ? formatAge(selected.telemetry?.reported_at || selected.group.last_location_at) : "Not reported"}</dd></div><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Battery / fuel</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.battery_pct == null ? "Not reported" : `${selected.telemetry.battery_pct}%`}</dd></div></dl><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={routeLoading} onClick={() => void calculateRoute("recalculate")} className="rounded-lg bg-teal-300 px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{routeLoading ? "Calculating…" : "Recalculate Route"}</button><button type="button" disabled={!route || actionBusy} onClick={() => void recordMobileDraft()} title="Audits a draft only; this workspace has no mobile delivery endpoint." className="rounded-lg border border-white/20 bg-white/[.05] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">Push to Mobile</button></div><p className="mb-0 mt-3 text-[11px] leading-4 text-slate-400">Route previews use current GIS constraints for advisory planning only. They do not prove clearance, force a reroute, or deliver instructions to a mobile device.</p>{route && <div className={`mt-3 rounded-lg border p-3 text-xs ${route.route_status === "blocked" ? "border-red-300/40 bg-red-500/10 text-red-100" : "border-teal-300/25 bg-teal-300/[.06] text-teal-100"}`}><strong className="block">{route.center_name} · {route.route_status}</strong><span className="mt-1 block">{route.distance_meters.toLocaleString()} m · {Math.round(route.estimated_seconds / 60)} min · {route.avoided_hazard_count} hazard geometry record(s) avoided · {route.blocked_segment_count} blocked segment(s)</span></div>}{actionStatus && <div className="mt-3 rounded-lg border border-white/15 bg-black/20 p-3 text-xs leading-5 text-slate-200" role="status">{actionStatus}</div>}</section></> : <section className="grid min-h-[520px] place-items-center rounded-2xl border border-white/10 bg-slate-900/90 p-8 text-center text-slate-400">Select a fleet unit to review its reported telemetry and safety context.</section>}</div>
    </section>
    {hailConfirmOpen && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="presentation"><section className="w-full max-w-md rounded-2xl border border-red-300/50 bg-slate-900 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Confirm safety hail"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-red-200">OPERATOR CONFIRMATION</p><h2 className="m-0 mt-2 text-lg font-semibold text-white">Send a safety hail?</h2><p className="mb-0 mt-3 text-sm leading-6 text-slate-300">This will submit an urgent VHF request to {selected.group.call_sign || selected.group.name} asking for position, welfare, route, and readiness confirmation. It does not change assignment, route, or safety status.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setHailConfirmOpen(false)} className="rounded-lg border border-white/15 px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">Cancel</button><button type="button" disabled={actionBusy} onClick={() => void sendHail()} className="rounded-lg bg-red-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-700">{actionBusy ? "Sending…" : "Send Hail Request"}</button></div></section></div>}
  </main>;
}

const intelligenceTemplates = [
  { id: "incident-summary", name: "Incident summary", subtitle: "Chronology, actions, sources, and open verification items for local DRRMO review." },
  { id: "audit-register", name: "Audit register", subtitle: "Filtered immutable action ledger for accountable post-incident review." },
  { id: "demobilization", name: "Demobilization health note", subtitle: "System health and transition context; confirm locally before official filing." },
];

function formatPst(timestamp: string) {
  const value = new Date(timestamp);
  return Number.isNaN(value.getTime()) ? "Timestamp unavailable" : new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "medium", hour12: false }).format(value);
}

function escapeReportHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function IntelligenceDashboardView({ health, connection, summary, onAction, onReturn }: { health: FeedHealth[]; connection: "live" | "cached"; summary: DashboardSummary; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onReturn: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [range, setRange] = useState<"24h" | "7d" | "all">("7d");
  const [operator, setOperator] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [templateId, setTemplateId] = useState(intelligenceTemplates[0].id);
  const [exportBusy, setExportBusy] = useState<"csv" | "pdf" | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const refreshLedger = useCallback(async () => {
    setLoading(true); setLedgerError(null);
    try { setEvents(await getAuditEvents(200)); }
    catch (error) { setLedgerError(error instanceof Error ? error.message : "The protected audit ledger could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refreshLedger(); }, [refreshLedger]);

  const operators = useMemo(() => Array.from(new Set(events.map((event) => event.actor_user_id || event.actor_role || "system"))).sort(), [events]);
  const filteredEvents = useMemo(() => {
    const oldest = range === "24h" ? Date.now() - 24 * 60 * 60 * 1000 : range === "7d" ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0;
    return events.filter((event) => {
      const actor = event.actor_user_id || event.actor_role || "system";
      const family = event.action.split(".")[0];
      const alertRelated = /sos|alert|incident/i.test(event.action);
      return (!oldest || new Date(event.created_at).getTime() >= oldest) && (operator === "all" || actor === operator) && (actionType === "all" || (actionType === "alerts" ? alertRelated : family === actionType));
    });
  }, [actionType, events, operator, range]);
  const visibleEvents = useMemo(() => filteredEvents.slice(0, 150), [filteredEvents]);
  const selectedTemplate = intelligenceTemplates.find((item) => item.id === templateId) || intelligenceTemplates[0];
  const sourceState = health.length === 0 ? "red" : health.some((item) => item.stale) ? "yellow" : "green";
  const cards = [
    { label: "External feed health", detail: health.length ? `${health.filter((item) => !item.stale).length}/${health.length} fresh source snapshots` : "No source records returned", state: sourceState, note: "Freshness is reported; per-poll latency is not exposed by the current provider contract." },
    { label: "Dashboard data link", detail: connection === "live" ? "Current operational snapshot" : "Cached or partially refreshed snapshot", state: connection === "live" ? "green" : "yellow", note: "This reflects the dashboard data refresh, not a standalone realtime-socket probe." },
    { label: "Realtime subscriptions", detail: "No socket-health metric reported", state: "yellow", note: "Event subscriptions trigger refreshes, but a backend socket health endpoint is not configured." },
    { label: "Database migrations", detail: "No migration status endpoint reported", state: "yellow", note: `The source snapshot is marked ${summary.source || "available"}; confirm migration status through approved infrastructure records.` },
  ] as const;
  const makeCsv = () => [
    ["Timestamp PST", "Operator ID / System Role", "Action Taken", "Incident Reference ID", "Authorization Level"],
    ...visibleEvents.map((event) => [formatPst(event.created_at), event.actor_user_id || event.actor_role || "system", event.action, event.resource_id || "—", event.actor_role || "system"]),
  ].map((row) => row.map((value) => `\"${String(value).replace(/\"/g, '\"\"')}\"`).join(",")).join("\n");
  const compileExport = async (format: "csv" | "pdf") => {
    if (!visibleEvents.length || exportBusy) return;
    const printWindow = format === "pdf" ? window.open("", "_blank") : null;
    setExportBusy(format); setExportStatus(null);
    try {
      await onAction("intelligence.audit_ledger_export_compiled", "audit_ledger", undefined, `Compiled ${visibleEvents.length} visible immutable audit events using the ${selectedTemplate.name} working template as ${format.toUpperCase()}. Output is not a signed official report and requires local DRRMO review.`);
      if (format === "csv") {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob(["\ufeff" + makeCsv()], { type: "text/csv;charset=utf-8" }));
        link.download = `drrmo-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
        setExportStatus(`Downloaded ${visibleEvents.length} filtered ledger rows as CSV.`);
      } else if (printWindow) {
        const rows = visibleEvents.map((event) => `<tr><td>${escapeReportHtml(formatPst(event.created_at))}</td><td>${escapeReportHtml(event.actor_user_id || event.actor_role || "system")}</td><td>${escapeReportHtml(event.action)}</td><td>${escapeReportHtml(event.resource_id || "—")}</td><td>${escapeReportHtml(event.actor_role || "system")}</td></tr>`).join("");
        printWindow.opener = null;
        printWindow.document.write(`<!doctype html><html><head><title>DRRMO audit ledger</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:28px}h1{font-size:20px;margin:0 0 6px}p{font-size:12px;color:#46546b}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:10px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}th{background:#e2e8f0}@media print{body{margin:12mm}}</style></head><body><h1>${escapeReportHtml(selectedTemplate.name)}</h1><p>${escapeReportHtml(selectedTemplate.subtitle)} · Generated ${escapeReportHtml(formatPst(new Date().toISOString()))} · ${visibleEvents.length} filtered immutable ledger event(s).</p><p><strong>Decision limit:</strong> This working export is not signed and must be reviewed, completed, and approved through the LGU DRRMO’s official process before filing or external release.</p><table><thead><tr><th>Timestamp (PST)</th><th>Operator / role</th><th>Action</th><th>Reference</th><th>Authorization</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
        printWindow.document.close(); window.setTimeout(() => printWindow.print(), 180);
        setExportStatus("Printable report prepared. Use the browser print dialog to save it as PDF after local review.");
      } else setExportStatus("A printable report could not open because the browser blocked the new window. Allow pop-ups, then try again.");
      await refreshLedger();
    } catch (error) { if (printWindow) printWindow.close(); setExportStatus(error instanceof Error ? error.message : "The audit export could not be compiled."); }
    finally { setExportBusy(null); }
  };

  return <main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="DRRMO Intelligence Audit and Analytics dashboard">
    <header className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · POST-INCIDENT REVIEW AND ACCOUNTABILITY</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">DRRMO Intelligence <span className="font-normal text-slate-400">/ Audit & Analytics</span></h1></div><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></header>
    <section className="mx-auto grid max-w-[1800px] gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="System health and analytics grid">{cards.map((card) => <article key={card.label} className="rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-command"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-slate-400">{card.label.toUpperCase()}</p><strong className="mt-2 block text-sm text-white">{card.detail}</strong></div><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${card.state === "green" ? "bg-emerald-400" : card.state === "red" ? "bg-red-500" : "bg-amber-300"}`} aria-label={`${card.label}: ${card.state}`} /></div><div className="mt-4 flex h-8 items-end gap-1" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} className={`flex-1 rounded-t-sm ${card.state === "green" ? "bg-emerald-400/70" : card.state === "red" ? "bg-red-500/70" : "bg-amber-300/70"}`} style={{ height: `${28 + ((index * 17 + card.label.length * 3) % 64)}%` }} />)}</div><p className="mb-0 mt-3 text-[11px] leading-4 text-slate-400">{card.note}</p></article>)}</section>
    <section className="mx-auto grid max-w-[1800px] gap-4 lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]" aria-label="Audit ledger and LGU report hub">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command"><div className="border-b border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">IMMUTABLE ACTION LEDGER</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Chronological accountability timeline</h2><p className="mb-0 mt-1 text-xs text-slate-400">Read-only audit records. Filters change this view only; they never alter the ledger.</p></div><button type="button" onClick={() => void refreshLedger()} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Refresh ledger</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><select aria-label="Audit ledger date range" value={range} onChange={(event) => setRange(event.target.value as typeof range)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="24h">Past 24 hours</option><option value="7d">Past 7 days</option><option value="all">All loaded records</option></select><select aria-label="Audit ledger operator filter" value={operator} onChange={(event) => setOperator(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="all">All operators / roles</option>{operators.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Audit ledger action filter" value={actionType} onChange={(event) => setActionType(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="all">All action types</option><option value="alerts">SOS & alerts</option><option value="fleet">Fleet actions</option><option value="feeds">Feed actions</option><option value="system">System actions</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/10 bg-slate-950/70 text-[10px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-4 py-3">Timestamp (PST)</th><th className="px-3 py-3">Operator / role</th><th className="px-3 py-3">Action taken</th><th className="px-3 py-3">Incident reference</th><th className="px-4 py-3">Authorization</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading protected audit records…</td></tr> : ledgerError ? <tr><td colSpan={5} className="px-4 py-10 text-center text-red-200">{ledgerError}</td></tr> : visibleEvents.map((event) => <tr key={event.id} className="border-b border-white/[.07] bg-white/[.015] align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatPst(event.created_at)}</td><td className="px-3 py-3"><strong className="block font-medium text-white">{event.actor_user_id || event.actor_role || "system"}</strong><span className="text-slate-500">{event.actor_role || "system"}</span></td><td className="px-3 py-3"><code className="rounded bg-slate-950 px-1.5 py-1 text-[11px] text-teal-100">{event.action}</code></td><td className="px-3 py-3 text-slate-300">{event.resource_id || "—"}</td><td className="px-4 py-3"><span className="rounded-full border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">{event.actor_role || "system"}</span></td></tr>)}{!loading && !ledgerError && !visibleEvents.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No immutable audit events match the selected query.</td></tr>}</tbody></table></div>{filteredEvents.length > visibleEvents.length && <p className="m-0 border-t border-white/10 px-4 py-3 text-xs text-amber-200">Rendering is capped at the first 150 matching records for a responsive operator view. Narrow the query before exporting a focused review.</p>}</section>
      <aside className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-command"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">AUTOMATED LGU REPORTING</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Compile accountable working records</h2><p className="mb-0 mt-2 text-sm leading-5 text-slate-400">Choose a local working format, then export the filtered immutable ledger for DRRMO review. These templates are not signed official forms and require local approval.</p><label className="mt-5 block text-xs font-semibold text-slate-300">Report template<select aria-label="LGU report template" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-100">{intelligenceTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><article className="mt-3 rounded-xl border border-teal-300/20 bg-teal-300/[.06] p-3"><strong className="text-sm text-teal-100">{selectedTemplate.name}</strong><p className="mb-0 mt-1 text-xs leading-5 text-slate-300">{selectedTemplate.subtitle}</p></article><div className="mt-5 grid gap-2"><button type="button" disabled={!visibleEvents.length || Boolean(exportBusy)} onClick={() => void compileExport("pdf")} className="rounded-lg bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{exportBusy === "pdf" ? "Compiling…" : "Prepare PDF report"}</button><button type="button" disabled={!visibleEvents.length || Boolean(exportBusy)} onClick={() => void compileExport("csv")} className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500">{exportBusy === "csv" ? "Compiling…" : "Download filtered CSV"}</button></div>{exportStatus && <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs leading-5 text-slate-300" role="status">{exportStatus}</div>}<div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400"><strong className="text-slate-200">Performance and compliance boundary</strong><p className="mb-0 mt-1">The dashboard fetches a bounded audit page, derives filters in memory, and renders a bounded working view to keep dense logs responsive. The authoritative ledger remains backend-controlled and uneditable in this interface.</p></div></aside>
    </section>
  </main>;
}

function TriageDrawer({ incident, onClose, onUpdated, onAction }: { incident: SosIncident; onClose: () => void; onUpdated: (incident: SosIncident) => void; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyAssessment, setSafetyAssessment] = useState<ResponderSafetyAssessment | null>(null);
  const assessmentEligible = incident.status === "acknowledged" || incident.status === "dispatched";
  const transition = async (status: SosStatus) => {
    setSaving(true); setError(null);
    try {
      const note = `Updated from Balangiga command center: ${status}`;
      const updated = await updateSosStatus(incident.id, status, note);
      onUpdated({ ...incident, ...updated });
      await onAction(`sos.${status}`, "sos_request", incident.id, note);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The incident state could not be updated. Keep the record open and retry.");
    } finally { setSaving(false); }
  };
  const runSafetyAssessment = async () => {
    setAssessing(true); setError(null);
    try {
      const result = await assessResponderSafety(incident.id);
      setSafetyAssessment(result);
      await onAction("sos.responder_safety_assessed", "sos_request", incident.id, `Responder-safety assessment ${result.assessment_id} generated for coordinator review; no dispatch or route clearance created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Responder-safety assessment could not be generated. Recheck verification status and retry.");
    } finally { setAssessing(false); }
  };
  const actions: Array<{ status: SosStatus; label: string; className: string }> = incident.status === "received" ? [{ status: "acknowledged", label: "Acknowledge receipt", className: "primary-button" }, { status: "false_alarm", label: "Mark false alarm", className: "ghost-button" }] : incident.status === "acknowledged" ? [{ status: "dispatched", label: "Dispatch response team", className: "primary-button" }] : incident.status === "dispatched" ? [{ status: "resolved", label: "Mark resolved", className: "primary-button" }] : [];
  return <div className="drawer-backdrop" role="presentation" onClick={onClose}><aside className="drawer" role="dialog" aria-label="SOS triage details" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">Incoming SOS · {incident.channel.toUpperCase()}</div><h2>{incident.emergency_type}</h2><p className="panel-subtitle">{incident.barangay} · received {formatAge(incident.received_at)}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="drawer-body"><div className="drawer-section"><div className="drawer-label">Current status</div><div className="drawer-value"><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span></div></div><div className="drawer-section"><div className="drawer-label">Incident summary</div><div className="drawer-value">{incident.summary}</div><div className="drawer-note">Received through {incident.channel.toUpperCase()}. Location confidence is ±{incident.location.accuracy_meters ?? "unknown"} meters.</div></div><div className="drawer-section"><div className="drawer-label">Coordinates and routing guardrail</div><div className="drawer-value">{incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}</div><div className="drawer-note">Dispatch routing must avoid active flood polygons. Confirm the route again immediately before departure.</div></div><div className="drawer-section responder-safety-section"><div className="drawer-label">Responder-safety assessment</div><div className="drawer-note">For verified / acknowledged SOS only. Scores identify exposure and controls; they never create a dispatch, clear a route, or authorize entry.</div>{assessmentEligible ? <button className="secondary-button" disabled={assessing} onClick={() => void runSafetyAssessment()}>{assessing ? "Assessing responder risk…" : "Assess responder safety"}</button> : <div className="inline-status">Acknowledge and verify this SOS before assessing responder exposure.</div>}{safetyAssessment && <div className="responder-safety-result"><div className="assessment-summary"><div><strong>Assessment {safetyAssessment.assessment_id.slice(-8)}</strong><span>{formatTime(safetyAssessment.generated_at)} · {safetyAssessment.active_hazard_count} active map hazard record(s)</span></div><span className="badge advisory">review only</span></div>{safetyAssessment.assessments.map((candidate) => <article className="safety-candidate" key={candidate.group_id}><div className="safety-candidate-head"><div><strong>{candidate.group_name}</strong><span>{candidate.call_sign || "Call sign unlisted"} · {candidate.distance_meters.toLocaleString()} m away · readiness {candidate.readiness_score}/100</span></div><span className={`badge ${severityClass(candidate.risk_band === "severe" ? "critical" : candidate.risk_band)}`}>{candidate.risk_band} · {candidate.risk_score}/100</span></div><div className="safety-meta"><span>Location {candidate.location_age_minutes} min old</span><span>Check-in {candidate.check_in_age_minutes} min old</span><span>{candidate.availability}</span></div>{candidate.hold_reasons.length > 0 && <div className="safety-holds"><strong>Hold before tasking</strong><ul>{candidate.hold_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<details className="safety-details"><summary>Risk factors and protective controls</summary><ul>{candidate.factors.map((factor) => <li key={factor.factor}><strong>{factor.factor.replaceAll("_", " ")}: {factor.points >= 0 ? "+" : ""}{factor.points}</strong> — {factor.detail}</li>)}</ul><strong>Field-team execution</strong><ul>{candidate.field_execution_tasks.map((task) => <li key={task}>{task}</li>)}</ul><strong>Protective controls before departure</strong><ul>{candidate.protective_controls.map((control) => <li key={control}>{control}</li>)}</ul></details></article>)}<div className="safety-command-tasks"><strong>Command Center execution</strong><ol>{safetyAssessment.command_center_tasks.map((task) => <li key={task}>{task}</li>)}</ol></div><div className="safety-limit"><strong>Decision limit</strong><span>{safetyAssessment.decision_limits[0]}</span></div></div>}</div><div className="drawer-section"><div className="drawer-label">Triage actions</div><div className="triage-actions">{actions.map((action) => <button key={action.status} className={action.className} disabled={saving} onClick={() => void transition(action.status)}>{action.label}</button>)}{actions.length === 0 && <div className="empty-state">This record is closed. Review the audit trail for the last handover.</div>}</div>{error && <div className="inline-status error-status" role="alert">{error}</div>}</div></div></aside></div>;
}

function CommandReadinessBoard({ incidents, centers, health, groups, notifications }: { incidents: SosIncident[]; centers: Center[]; health: FeedHealth[]; groups: ResponseGroupSnapshot; notifications: NotificationSnapshot }) {
  const staleGroups = groups.groups.filter((group) => Date.now() - new Date(group.last_location_at).getTime() > 15 * 60 * 1000 || Date.now() - new Date(group.last_check_in_at).getTime() > 15 * 60 * 1000).length;
  const constrainedCenters = centers.filter((center) => center.status !== "open" || center.occupancy_current / Math.max(center.capacity_total, 1) >= 0.9).length;
  const controls = [
    { label: "New SOS", value: incidents.filter((item) => item.status === "received").length, state: "critical", note: "Triage" },
    { label: "Stale teams", value: staleGroups, state: staleGroups ? "warning" : "good", note: "Refresh check-in" },
    { label: "Stale feeds", value: health.filter((item) => item.stale).length, state: health.some((item) => item.stale) ? "warning" : "good", note: "Refresh sources" },
    { label: "Center limits", value: constrainedCenters, state: constrainedCenters ? "warning" : "good", note: "Review capacity" },
    { label: "Delivery gaps", value: notifications.pending_count + notifications.failed_count, state: notifications.pending_count + notifications.failed_count ? "warning" : "good", note: "Confirm receipt" },
  ];
  return <section className="panel readiness-board"><PanelHeader title="Operational checks" subtitle="Resolve blockers before the next action" action={<span className="panel-link">review required</span>} /><div className="readiness-list">{controls.map((control) => <div className="command-readiness-row" key={control.label}><span className={`readiness-state ${control.state}`} /><div><strong>{control.label}</strong><small>{control.note}</small></div><b>{control.value}</b></div>)}</div></section>;
}

function OverviewQuickActions({ incidents, alerts, centers, groups, onNavigate }: { incidents: SosIncident[]; alerts: AlertItem[]; centers: Center[]; groups: ResponseGroupSnapshot; onNavigate: (tab: Tab) => void }) {
  const staleTeams = groups.groups.filter((group) => Date.now() - new Date(group.last_location_at).getTime() > 15 * 60 * 1000 || Date.now() - new Date(group.last_check_in_at).getTime() > 15 * 60 * 1000).length;
  const constrainedCenters = centers.filter((center) => center.status !== "open" || center.occupancy_current / Math.max(center.capacity_total, 1) >= 0.9).length;
  const actions: Array<{ tab: Tab; icon: string; label: string; value: number; note: string; state: string }> = [
    { tab: "Live SOS", icon: "!", label: "SOS queue", value: incidents.filter((item) => item.status !== "resolved" && item.status !== "false_alarm").length, note: "Open triage", state: "critical" },
    { tab: "Verified Alerts", icon: "◈", label: "Active alerts", value: alerts.filter((alert) => !alert.expires_at || new Date(alert.expires_at).getTime() > Date.now()).length, note: "Review warnings", state: "warning" },
    { tab: "Evacuation Centers", icon: "⌂", label: "Center limits", value: constrainedCenters, note: "Capacity status", state: constrainedCenters ? "warning" : "good" },
    { tab: "Response Groups", icon: "◎", label: "Team updates", value: staleTeams, note: "Refresh roster", state: staleTeams ? "warning" : "good" },
  ];
  return <section className="panel overview-quick-actions"><PanelHeader title="Quick access" subtitle="Open the operational workspace" /><div className="quick-actions-grid">{actions.map((action) => <button className={`quick-action ${action.state}`} key={action.label} onClick={() => onNavigate(action.tab)}><span className="quick-action-icon">{action.icon}</span><span><strong>{action.label}</strong><small>{action.note}</small></span><b>{action.value}</b></button>)}</div></section>;
}

function OverviewView({ summary, incidents, centers, alerts, health, gis, groups, notifications, onSelect, onAction, onNavigate }: { summary: DashboardSummary; incidents: SosIncident[]; centers: Center[]; alerts: AlertItem[]; health: FeedHealth[]; gis: GisMapSnapshot; groups: ResponseGroupSnapshot; notifications: NotificationSnapshot; onSelect: (incident: SosIncident) => void; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onNavigate: (tab: Tab) => void }) {
  return <><div className="metric-grid overview-metric-grid"><MetricCard label="Untriaged SOS" value={summary.metrics.untriaged_sos} note="Needs triage" icon="!" bg="#ffe4e6" /><MetricCard label="Critical alerts" value={summary.metrics.critical_alerts} note="Actionable warnings" icon="◉" bg="#ffedd5" /><MetricCard label="Open centers" value={summary.metrics.open_centers} note="Current capacity" icon="⌂" bg="#ccfbf1" /><MetricCard label="Residents at risk" value={summary.metrics.residents_at_risk} note="Active hazard zones" icon="⌁" bg="#e0f2fe" /></div><div className="overview-command-grid"><GISMapPanel snapshot={gis} onAction={onAction} /><div className="overview-side-stack"><CommandReadinessBoard incidents={incidents} centers={centers} health={health} groups={groups} notifications={notifications} /><OverviewQuickActions incidents={incidents} alerts={alerts} centers={centers} groups={groups} onNavigate={onNavigate} /></div></div><div className="overview-queues-grid"><SosQueue incidents={incidents} onSelect={onSelect} /><AlertFeed alerts={alerts} health={health} onAction={onAction} /><CenterList centers={centers} onAction={onAction} /></div></>;
}

function LiveSosView({ incidents, onSelect, onAction }: { incidents: SosIncident[]; onSelect: (incident: SosIncident) => void; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  const [status, setStatus] = useState("all"); const [channel, setChannel] = useState("all"); const [query, setQuery] = useState("");
  const filtered = incidents.filter((item) => (status === "all" || item.status === status) && (channel === "all" || item.channel === channel) && `${item.emergency_type} ${item.barangay} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="subtab-intro"><div><div className="eyebrow">Life-safety operations</div><h2>Live SOS coordination</h2><p>Every request stays visible from receipt through acknowledgement, dispatch, resolution, or false-alarm closure. Use the channel and location confidence to prioritize verification.</p></div><div className="readout-block"><strong>{filtered.length}</strong><span>records in view</span></div></div><div className="control-strip"><input aria-label="Search SOS" placeholder="Search barangay, type, or message" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter SOS status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="received">Received</option><option value="acknowledged">Acknowledged</option><option value="dispatched">Dispatched</option><option value="resolved">Resolved</option></select><select aria-label="Filter SOS channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option><option value="sms">SMS fallback</option><option value="internet">Internet</option><option value="mesh">Mesh</option><option value="manual">Manual</option></select></div><section className="panel"><PanelHeader title="Triage queue" subtitle="Open the record to see location confidence, route guardrails, and valid next actions" action={<span className="panel-link">{incidents.filter((item) => item.status === "received").length} awaiting acknowledgement</span>} /><div className="sos-table"><div className="sos-table-head"><span>Incident</span><span>Channel / age</span><span>Location</span><span>State</span><span /></div>{filtered.map((incident) => <button className="sos-table-row" key={incident.id} onClick={() => onSelect(incident)}><span><strong>{incident.emergency_type} · {incident.barangay}</strong><small>{incident.summary}</small></span><span><strong>{incident.channel.toUpperCase()}</strong><small>{formatAge(incident.received_at)}</small></span><span><strong>±{incident.location.accuracy_meters ?? "?"}m</strong><small>{incident.location.latitude.toFixed(3)}, {incident.location.longitude.toFixed(3)}</small></span><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span><span className="chevron">›</span></button>)}{filtered.length === 0 && <div className="empty-state">No SOS records match the current filters.</div>}</div></section><section className="operations-grid three-columns compact"><div className="callout critical-callout"><strong>Dispatch rule</strong><span>Do not send a team until the route has been checked against the active flood polygons and the responder channel has acknowledged the task.</span></div><div className="callout"><strong>SMS fallback</strong><span>SMS records may have delayed timestamps and larger location uncertainty. Confirm by callback or barangay focal point when safe.</span></div><div className="callout"><strong>Shift handover</strong><button className="tiny-button" onClick={() => onAction("sos.handover_reviewed", "sos_queue", undefined, "Reviewed live SOS queue for shift handover.")}>Record queue review</button></div></section></>;
}

function AlertsView({ alerts, health, onAction }: { alerts: AlertItem[]; health: FeedHealth[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  const [severity, setSeverity] = useState("all"); const [hazard, setHazard] = useState("all"); const [syncing, setSyncing] = useState(false); const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const filtered = alerts.filter((alert) => (severity === "all" || alert.severity === severity) && (hazard === "all" || alert.hazard === hazard));
  const syncFeeds = async () => { setSyncing(true); setSyncMessage(null); try { const result = await pollConfiguredFeeds(); await onAction("feeds.sync_requested", "feed_source", undefined, `Synchronized configured feeds: ${result.items_seen} items reviewed, ${result.items_inserted + result.items_updated} changes.`); setSyncMessage(`Feed synchronization completed at ${formatTime(result.completed_at)}.`); } catch (error) { setSyncMessage(error instanceof Error ? error.message : "Feed synchronization could not be completed."); } finally { setSyncing(false); } };
  return <><div className="subtab-intro"><div><div className="eyebrow">Trusted information pipeline</div><h2>Verified alerts and public information</h2><p>Separate authoritative warnings from unverified reports. Review source freshness, validity window, affected hazard, and the exact instruction that will reach residents.</p></div><div className="readout-block"><strong>{health.filter((item) => !item.stale).length}/{health.length}</strong><span>feeds verified</span></div></div><div className="feed-health-grid">{health.map((item) => <div className="feed-health-card" key={item.source_name}><div className="health-card-title"><span className={`health-dot ${item.stale ? "stale" : ""}`} />{item.source_name}</div><strong>{item.stale ? "Needs attention" : "Healthy"}</strong><span>Last success {item.last_success_at ? formatAge(item.last_success_at) : "never"}</span><span>Last checked {item.last_checked_at ? formatAge(item.last_checked_at) : "not checked"}</span><small>{item.endpoint_url || "LGU-managed bulletin source"}</small><button className="tiny-button" onClick={() => onAction("feed.health_checked", "feed_source", item.source_name, `Checked ${item.source_name} health.`)}>Record check</button></div>)}</div><div className="control-strip"><select aria-label="Filter alert severity" value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="advisory">Advisory</option></select><select aria-label="Filter alert hazard" value={hazard} onChange={(event) => setHazard(event.target.value)}><option value="all">All hazards</option><option value="flood">Flood</option><option value="storm_surge">Storm surge</option><option value="landslide">Landslide</option></select><button className="ghost-button" disabled={syncing} onClick={syncFeeds}>{syncing ? "Synchronizing…" : "Synchronize configured feeds"}</button></div>{syncMessage && <div className="inline-status">{syncMessage}</div>}<section className="panel"><PanelHeader title="Verified warning register" subtitle="Public-facing decisions should be traceable to a source and validity window" action={<span className="panel-link">{filtered.length} active records</span>} /><div className="panel-body alert-register">{filtered.map((alert) => <article className="alert-register-row" key={alert.id}><div className={`alert-severity-band ${alert.severity}`} /><div className="alert-register-main"><div className="alert-card-top"><div className="alert-title">{alert.title}</div><span className={`badge ${alert.severity}`}>{alert.severity}</span></div><p className="alert-body">{alert.body}</p><div className="alert-meta">{alert.source_name} · issued {formatAge(alert.issued_at)} · valid until {formatTime(alert.expires_at)}{alert.hazard ? ` · ${alert.hazard}` : ""}</div><div className="inline-actions"><button className="tiny-button" onClick={() => onAction("alert.verified", "verified_alert", alert.id, `Verified ${alert.title}`)}>Confirm verification</button><button className="tiny-button" onClick={() => onAction("bulletin.queued", "verified_alert", alert.id, `Queued bulletin: ${alert.title}`)}>Queue public bulletin</button></div></div></article>)}</div></section></>;
}

function ProvincialWeatherView({ snapshot, onAction, onOpenRiskMap }: { snapshot: ProvincialWeatherSnapshot; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>; onOpenRiskMap: () => void }) {
  const hazardIcon: Record<string, string> = { flood: "≈", landslide: "▲", storm_surge: "≋" };
  const freshness = snapshot.stale ? "Cached—refresh required" : "Current cached source snapshot";
  const review = () => void onAction("provincial_weather.reviewed", "weather_situation", undefined, `Reviewed ${snapshot.regional_office} weather situation and Project NOAH static hazard references for ${snapshot.province}.`);
  return <><div className="subtab-intro"><div><div className="eyebrow">Provincial situation desk · PAGASA + Project NOAH</div><h2>Eastern Samar weather situation</h2><p>Review the latest official regional weather narrative alongside static flood, landslide, and storm-surge references. The static models describe potential hazard areas, not the current extent of impact.</p></div><div className="readout-block"><strong>{snapshot.stale ? "Check" : "Ready"}</strong><span>{freshness}</span></div></div><section className="panel provincial-weather-hero"><PanelHeader title="Official weather situation" subtitle={`${snapshot.regional_office} · fetched ${formatAge(snapshot.fetched_at)}`} action={<span className={`badge ${snapshot.stale ? "warning" : "advisory"}`}>{snapshot.stale ? "Cached" : "Source available"}</span>} /><div className="panel-body provincial-weather-summary"><div className="weather-summary-copy"><div className="weather-summary-icon">☁</div><div><div className="weather-summary-label">Regional narrative</div><strong>{snapshot.weather_summary}</strong><span>{snapshot.issued_at ? `Source time: ${snapshot.issued_at}` : "Source page did not expose a parseable issue time."}</span></div></div><div className="weather-applicability"><strong>{snapshot.province_mentioned ? "Eastern Samar named" : "Regional coverage"}</strong><span>{snapshot.province_mentioned ? "The current source text explicitly mentions Eastern Samar." : "Confirm barangay and provincial applicability with PAGASA or the provincial DRRM office."}</span></div></div></section><div className="provincial-weather-grid"><section className="panel"><PanelHeader title="PAGASA warning statements" subtitle="Verbatim, bounded source statements—not a local hazard clearance" action={<span className="panel-link">{snapshot.warnings.length} statement{snapshot.warnings.length === 1 ? "" : "s"}</span>} /><div className="panel-body provincial-warning-list">{snapshot.warnings.map((warning) => <article className="provincial-warning" key={warning.id}><span className={`warning-symbol ${warning.type}`}>{warning.type === "heavy_rainfall" ? "☂" : "ϟ"}</span><div><div><strong>{warning.type.replaceAll("_", " ")}</strong><span className={`badge ${warning.province_specific ? "advisory" : "warning"}`}>{warning.province_specific ? "Province named" : "Regional—verify"}</span></div><p>{warning.statement}</p><a href={warning.source_url} target="_blank" rel="noreferrer">Open PAGASA source ↗</a></div></article>)}</div></section><section className="panel"><PanelHeader title="Operational verification" subtitle="Complete these checks before recommending movement or releasing public guidance" action={<button className="panel-link" onClick={review}>Record review →</button>} /><div className="panel-body provincial-verification-list"><div><b>01</b><span><strong>Confirm the warning.</strong> Check its issue time, location coverage, and validity on PAGASA’s original page or via official communication channels.</span></div><div><b>02</b><span><strong>Confirm ground conditions.</strong> Obtain barangay, road, river, coastal, and evacuation-center reports; no weather or model layer confirms field safety.</span></div><div><b>03</b><span><strong>Use the live Risk Map.</strong> Compare active local constraints, SOS reports, centers, and current routing before dispatch.</span></div><button className="ghost-button" onClick={onOpenRiskMap}>Open interactive Risk Map</button></div></section></div><section className="panel provincial-hazard-panel"><PanelHeader title="Project NOAH hazard-area references" subtitle="Eastern Samar static source datasets. They indicate potential exposure and must not be represented as live hazard boundaries." action={<span className="panel-link">Static reference only</span>} /><div className="provincial-hazard-grid">{snapshot.hazard_references.map((reference) => <article className="provincial-hazard-card" key={reference.id}><div className={`provincial-hazard-icon ${reference.hazard}`}>{hazardIcon[reference.hazard] || "!"}</div><div className="eyebrow">{reference.coverage}</div><h3>{reference.title}</h3><p>{reference.model_scope}</p><div className="hazard-class-list">{reference.classes.map((item) => <span key={item}>{item}</span>)}</div><div className="hazard-decision-limit">{reference.decision_limit}</div><a href={reference.source_url} target="_blank" rel="noreferrer">Open {reference.source_name} archive ↗</a></article>)}</div></section><section className="source-directory"><div><strong>Source directory</strong><span>Use the primary sources to check full advisories, maps, and published datasets.</span></div>{snapshot.source_links.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.name}</strong><span>{source.kind}</span><b>↗</b></a>)}</section><div className="callout critical-callout"><strong>Decision-support limit</strong><span>Neither the PAGASA narrative nor Project NOAH static hazard references establish safe roads, safe evacuation routes, flood depth, structural safety, or an evacuation order. Verify with official advisories and field reports before acting.</span></div></>;
}

function RiskMapView({ incidents, hazards, gis, onAction }: { incidents: SosIncident[]; hazards: HazardLayer[]; gis: GisMapSnapshot; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  const [route, setRoute] = useState<OptimizedRoute | null>(null); const [loading, setLoading] = useState(false); const [selectedIncidentId, setSelectedIncidentId] = useState(incidents.find((incident) => incident.status !== "resolved" && incident.status !== "false_alarm")?.id || incidents[0]?.id || "");
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId);
  const previewRoute = async () => { if (!selectedIncident) return; setLoading(true); try { setRoute(await optimizeGisRoute(selectedIncident.location.latitude, selectedIncident.location.longitude)); await onAction("route.previewed", "safe_route", selectedIncident.id, `Previewed the GIS-optimized evacuation route for ${selectedIncident.emergency_type} in ${selectedIncident.barangay}.`); } finally { setLoading(false); } };
  return <><div className="subtab-intro"><div><div className="eyebrow">Spatial risk and routing</div><h2>Risk map and safe movement</h2><p>Use the map as a decision aid, not a substitute for field confirmation. Hazard polygons, tracked assets, SOS confidence, centers, and route freshness must be checked together.</p></div><div className="readout-block"><strong>{gis.hazards.filter((hazard) => hazard.status === "active").length}</strong><span>active GIS constraints</span></div></div><div className="content-grid"><div className="left-stack"><GISMapPanel snapshot={gis} route={route} onAction={onAction} /><div className="panel route-panel"><PanelHeader title="GIS route optimization" subtitle="Hazard-aware route decision using the latest spatial snapshot" action={<button className="primary-button" disabled={loading || !selectedIncident} onClick={previewRoute}>{loading ? "Checking…" : "Optimize selected incident route"}</button>} /><div className="route-origin-control"><label>Route origin<select aria-label="Route origin SOS incident" value={selectedIncidentId} onChange={(event) => { setSelectedIncidentId(event.target.value); setRoute(null); }}><option value="">Select an SOS incident</option>{incidents.filter((incident) => incident.status !== "resolved" && incident.status !== "false_alarm").map((incident) => <option key={incident.id} value={incident.id}>{incident.emergency_type} · {incident.barangay} · {incident.severity}</option>)}</select></label>{selectedIncident && <small>Location confidence ±{selectedIncident.location.accuracy_meters ?? "unknown"} m · received {formatAge(selectedIncident.received_at)}</small>}</div>{route ? <div className="panel-body route-result"><div><strong>{route.center_name}</strong><span>{Math.round(route.distance_meters)} m · about {Math.ceil(route.estimated_seconds / 60)} min travel estimate</span></div><div><strong>{route.avoided_hazard_count}</strong><span>hazards avoided · {route.blocked_segment_count} blocked segment</span></div><small>{route.route_status.toUpperCase()} as of {formatTime(route.route_is_safe_as_of)} · {route.warnings[0]}</small></div> : <div className="empty-state">Choose an active SOS record, then optimize a route that excludes active hazard constraints.</div>}</div></div><div className="right-stack"><section className="panel"><PanelHeader title="Active hazard register" subtitle="Verified constraints affecting movement" action={<button className="panel-link" onClick={() => onAction("hazards.reviewed", "hazard_register", undefined, "Reviewed active GIS hazard register.")}>Record review →</button>} /><div className="panel-body hazard-list">{hazards.map((hazard) => <div className="hazard-row" key={hazard.id}><div className={`hazard-icon ${severityClass(hazard.severity)}`}>!</div><div><strong>{hazard.name}</strong><span>{hazard.affected_area} · verified {formatAge(hazard.last_verified)}</span><small>{hazard.action}</small></div><span className={`badge ${severityClass(hazard.severity)}`}>{hazard.status}</span></div>)}</div></section><div className="callout critical-callout"><strong>Routing guardrail</strong><span>Flood, storm-surge, landslide, and road-closure polygons can change faster than the map refresh cycle. Recalculate and confirm field conditions immediately before dispatch.</span></div></div></div></>;
}

function EvacuationCentersView({ centers, readiness, onAction }: { centers: Center[]; readiness: BarangayReadiness[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  return <><div className="subtab-intro"><div><div className="eyebrow">Shelter and population movement</div><h2>Evacuation center operations</h2><p>Capacity is only one part of shelter readiness. Track intake status, amenities, assigned barangays, transport, and unmet needs before issuing a movement instruction.</p></div><div className="readout-block"><strong>{centers.filter((center) => center.status === "open").length}</strong><span>centers accepting intake</span></div></div><div className="center-detail-grid">{centers.map((center) => { const ratio = Math.min(100, Math.round((center.occupancy_current / Math.max(center.capacity_total, 1)) * 100)); return <section className="panel center-detail-card" key={center.id}><div className="center-card-top"><div><div className="eyebrow">{center.barangay}</div><h3>{center.name}</h3></div><span className={`badge ${stateClass(center.status)}`}>{center.status}</span></div><div className="center-capacity-line"><strong>{center.occupancy_current}</strong><span>/ {center.capacity_total} occupants</span><b>{ratio}%</b></div><div className="capacity-bar large"><div className={`capacity-fill ${ratio > 75 ? "high" : ""}`} style={{ width: `${ratio}%` }} /></div><div className="amenity-list">{center.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div><div className="center-operational-note">Last distance estimate: {center.distance_meters ? `${center.distance_meters} m` : "not available"}. Verify intake count with the center manager before directing another group.</div><div className="inline-actions"><button className="tiny-button" onClick={() => onAction("center.capacity_verified", "evacuation_center", center.id, `Verified capacity for ${center.name}`)}>Verify capacity</button><button className="tiny-button" onClick={() => onAction("center.resupply_requested", "evacuation_center", center.id, `Requested resupply review for ${center.name}`)}>Request resupply</button></div></section>; })}</div><section className="panel"><PanelHeader title="Barangay readiness and movement" subtitle="Population at risk, assigned shelter, transport, and last contact" action={<span className="panel-link">{readiness.length} barangays tracked</span>} /><div className="readiness-table"><div className="readiness-head"><span>Barangay</span><span>At risk</span><span>Movement</span><span>Assigned center / transport</span><span>Needs</span></div>{readiness.map((item) => <div className="readiness-row" key={item.barangay}><span><strong>{item.barangay}</strong><small>Last contact {formatAge(item.last_contact)}</small></span><span><strong>{item.population_at_risk}</strong><small>people</small></span><span><span className={`badge ${severityClass(item.priority)}`}>{item.evacuation_status.replace("_", " ")}</span></span><span><strong>{item.assigned_center}</strong><small>{item.transport}</small></span><span className="needs-list">{item.needs.map((need) => <em key={need}>{need}</em>)}</span></div>)}</div></section></>;
}

function ResourcesView({ resources, communications, teams, onAction }: { resources: ResourceItem[]; communications: CommunicationsPlan[]; teams: DispatchTeam[]; onAction: (action: string, type: string, id?: string, note?: string) => Promise<void> }) {
  const [category, setCategory] = useState("all"); const filtered = resources.filter((item) => category === "all" || item.category === category);
  return <><div className="subtab-intro"><div><div className="eyebrow">Logistics, personnel, and public information</div><h2>Resources and communications</h2><p>Track what can be deployed now, what is already committed, and which public or responder messages have been acknowledged. Scarcity should be visible before a request is accepted.</p></div><div className="readout-block"><strong>{resources.filter((resource) => resource.status === "ready").length}</strong><span>resource lines ready</span></div></div><div className="resource-summary-grid"><div className="summary-strip"><strong>{resources.filter((resource) => resource.status === "low").length}</strong><span>below replenishment threshold</span></div><div className="summary-strip"><strong>{resources.filter((resource) => resource.status === "deployed").length}</strong><span>currently deployed</span></div><div className="summary-strip"><strong>{communications.filter((message) => message.status === "queued").length}</strong><span>communications awaiting release</span></div><div className="summary-strip"><strong>{teams.filter((team) => team.status === "standby").length}</strong><span>teams on standby</span></div></div><section className="panel"><PanelHeader title="Resource accountability" subtitle="Available, total, owner, location, and operational state" action={<select className="compact-select" aria-label="Filter resource category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option><option value="rescue">Rescue</option><option value="medical">Medical</option><option value="transport">Transport</option><option value="relief">Relief</option><option value="communications">Communications</option></select>} /><div className="resource-table"><div className="resource-head"><span>Resource</span><span>Available</span><span>Location / owner</span><span>State</span><span>Actions</span></div>{filtered.map((resource) => { const ratio = Math.round((resource.available / Math.max(resource.total, 1)) * 100); return <div className="resource-row" key={resource.id}><span><strong>{resource.name}</strong><small>{resource.category} · {resource.unit}</small></span><span><strong>{resource.available}/{resource.total}</strong><div className="capacity-bar"><div className={`capacity-fill ${ratio < 40 ? "high" : ""}`} style={{ width: `${ratio}%` }} /></div></span><span><strong>{resource.location}</strong><small>{resource.owner}</small></span><span className={`badge ${stateClass(resource.status)}`}>{resource.status}</span><span className="inline-actions"><button className="tiny-button" onClick={() => onAction("resource.accountability_checked", "resource", resource.id, `Checked ${resource.name}`)}>Check</button><button className="tiny-button" onClick={() => onAction(resource.status === "low" ? "resource.resupply_requested" : "resource.reserve_requested", "resource", resource.id, `Action requested for ${resource.name}`)}>{resource.status === "low" ? "Resupply" : "Reserve"}</button></span></div>; })}</div></section><section className="panel"><PanelHeader title="Communications tracker" subtitle="Audience, channel, release state, and acknowledgement coverage" action={<button className="primary-button" onClick={() => onAction("bulletin.draft_started", "communications_plan", undefined, "Started a new public information draft.")}>Draft new bulletin</button>} /><div className="communications-list">{communications.map((message) => <div className="communication-row" key={message.id}><div className={`communication-icon ${message.channel}`}>{message.channel.slice(0, 2).toUpperCase()}</div><div><strong>{message.title}</strong><span>{message.audience} · owner {message.owner}</span><small>{message.channel.toUpperCase()} · {message.sent_at ? `sent ${formatAge(message.sent_at)}` : "not released"} · {message.acknowledgements}/{message.target_count} acknowledgements</small></div><span className={`badge ${stateClass(message.status)}`}>{message.status}</span><button className="tiny-button" onClick={() => onAction(message.status === "queued" ? "bulletin.released" : "bulletin.acknowledgements_reviewed", "communications_plan", message.id, `Reviewed ${message.title}`)}>{message.status === "queued" ? "Release" : "Review"}</button></div>)}</div></section></>;
}

function NotificationDeliveryPanel({ snapshot, onAcknowledge, onRetry, compact = false }: {
  snapshot: NotificationSnapshot;
  onAcknowledge: (notification: AssignmentNotification) => Promise<void>;
  onRetry: (notification: AssignmentNotification) => Promise<void>;
  compact?: boolean;
}) {
  return <section className={`panel assignment-notifications-panel ${compact ? "compact" : ""}`}>
    <PanelHeader title="Assignment notification delivery" subtitle="Auditable SMS, push, and in-app delivery state for response-unit tasking" action={<span className="notification-count">{snapshot.pending_count} pending · {snapshot.failed_count} failed</span>} />
    <div className="notification-list">
      {snapshot.notifications.length === 0 && <div className="empty-state">No assignment notifications yet. Assign an available response group to start the delivery flow.</div>}
      {snapshot.notifications.map((notification) => <article className="notification-row" key={notification.id}>
        <div className="notification-channel-mark">{notification.channel === "sms" ? "SMS" : notification.channel === "push" ? "PUSH" : "APP"}</div>
        <div className="notification-main"><div className="notification-top"><strong>{notification.recipient_label}</strong><span className={`badge ${notificationStatusClass(notification.status)}`}>{notification.status}</span></div><p>{notification.message}</p><small>{notification.channel.toUpperCase()} · {formatAge(notification.created_at)} · {notification.attempts} attempt{notification.attempts === 1 ? "" : "s"} · target {notification.target_id.slice(0, 12)}</small>{notification.last_error && <small className="notification-error">{notification.last_error}</small>}</div>
        <div className="notification-actions">{notification.acknowledged_at ? <span className="acknowledged-label">Acknowledged {formatTime(notification.acknowledged_at)}</span> : notification.status !== "failed" ? <button className="tiny-button" onClick={() => onAcknowledge(notification)}>Acknowledge</button> : null}{notification.status === "failed" && <button className="tiny-button" onClick={() => onRetry(notification)}>Retry</button>}</div>
      </article>)}
    </div>
    {!compact && <div className="callout notification-boundary"><strong>Delivery boundary</strong><span>Demo mode simulates SMS and in-app delivery. Live SMS requires an approved provider URL, sender ID, and secret-managed API key; push requires a provider and registered device tokens.</span></div>}
  </section>;
}

function ResponseGroupsView({ snapshot, incidents, tasks, centers, notifications, onAction, onRefresh, onAcknowledge, onRetry, onAssignment }: {
  snapshot: ResponseGroupSnapshot;
  incidents: SosIncident[];
  tasks: CommandCenterTask[];
  centers: Center[];
  notifications: NotificationSnapshot;
  onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onAcknowledge: (notification: AssignmentNotification) => Promise<void>;
  onRetry: (notification: AssignmentNotification) => Promise<void>;
  onAssignment: (message: string) => void;
}) {
  const [availability, setAvailability] = useState<"all" | ResponseGroup["availability"]>("all");
  const [specialty, setSpecialty] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(snapshot.groups[0]?.id || "");
  const [targetType, setTargetType] = useState<"sos_request" | "task" | "barangay" | "evacuation_center">("sos_request");
  const [targetId, setTargetId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filtered = snapshot.groups.filter((group) => {
    const text = `${group.name} ${group.agency} ${group.group_type} ${group.lead} ${group.call_sign} ${group.specialties.join(" ")}`.toLowerCase();
    return (availability === "all" || group.availability === availability) && (specialty === "all" || group.specialties.includes(specialty)) && (!query || text.includes(query.toLowerCase()));
  });
  const selected = snapshot.groups.find((group) => group.id === selectedId) || filtered[0] || snapshot.groups[0];
  const targetOptions = targetType === "sos_request"
    ? incidents.map((incident) => ({ id: incident.id, label: `${incident.id.slice(0, 8)} · ${incident.summary}` }))
    : targetType === "task"
      ? tasks.map((task) => ({ id: task.id, label: `${task.id} · ${task.title}` }))
      : targetType === "evacuation_center"
        ? centers.map((center) => ({ id: center.id, label: `${center.name} · ${center.barangay}` }))
        : [{ id: "barangay-1", label: "Barangay 1 · coastal households" }, { id: "barangay-2", label: "Barangay 2 · triage and movement" }, { id: "barangay-4", label: "Barangay 4 · bridge approach" }];
  const resolvedTargetId = targetOptions.some((option) => option.id === targetId) ? targetId : targetOptions[0]?.id || "";
  const locationFresh = !!selected && Date.now() - new Date(selected.last_location_at).getTime() <= 15 * 60 * 1000;
  const checkInFresh = !!selected && Date.now() - new Date(selected.last_check_in_at).getTime() <= 15 * 60 * 1000;
  const dispatchReadinessIssue = !selected ? null : !locationFresh ? "Position is older than 15 minutes; record a position check before assignment." : !checkInFresh ? "Roster check-in is older than 15 minutes; record a roster check before assignment." : selected.readiness_score < 60 ? "Readiness is below the 60% dispatch threshold." : null;
  const canAssign = !!selected && ["available", "limited"].includes(selected.availability) && !!resolvedTargetId && !assigning && !dispatchReadinessIssue;
  const submitAssignment = async () => {
    if (!selected || !canAssign) return;
    setAssigning(true);
    setMessage(null);
    try {
      await assignResponseGroup({ group_id: selected.id, target_type: targetType, target_id: resolvedTargetId, assignment_note: assignmentNote || undefined });
      setMessage(`${selected.name} assigned to ${resolvedTargetId}.`);
      onAssignment(`SMS, push, and in-app delivery queued for ${selected.call_sign} · ${selected.contact_channel}`);
      setAssignmentNote("");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assignment could not be recorded.");
    } finally {
      setAssigning(false);
    }
  };
  return <>
    <div className="subtab-intro"><div><div className="eyebrow">Personnel and response capacity</div><h2>Response groups</h2><p>Keep a single roster of emergency groups, their current position, readiness, specialties, communications path, and active commitments. Assign only after checking availability and constraints.</p></div><div className="readout-block"><strong>{snapshot.availability_counts.available || 0}</strong><span>groups available now</span></div></div>
    <div className="response-group-summary"><div className="summary-strip"><strong>{snapshot.groups.length}</strong><span>groups tracked</span></div><div className="summary-strip"><strong>{snapshot.availability_counts.assigned || 0}</strong><span>assigned or deployed</span></div><div className="summary-strip"><strong>{snapshot.availability_counts.limited || 0}</strong><span>limited availability</span></div><div className={`summary-strip ${snapshot.stale_location_count ? "warning-strip" : ""}`}><strong>{snapshot.stale_location_count}</strong><span>stale positions over 15 min</span></div></div>
    <div className="response-group-layout"><section className="panel response-group-roster"><div className="panel-header"><div><div className="panel-title">Emergency response roster</div><div className="panel-subtitle">Filter by deployment status, specialty, or group identity</div></div><span className="panel-link">{filtered.length} shown</span></div><div className="control-strip response-group-controls"><input aria-label="Search response groups" placeholder="Search group, lead, agency, or call sign" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter response group availability" value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="all">All availability</option><option value="available">Available</option><option value="limited">Limited</option><option value="assigned">Assigned</option><option value="offline">Offline</option></select><select aria-label="Filter response group specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="all">All specialties</option>{snapshot.specialties.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="response-group-list">{filtered.map((group) => <button className={`response-group-row ${selected?.id === group.id ? "selected" : ""}`} key={group.id} onClick={() => setSelectedId(group.id)}><div className={`response-group-avatar ${stateClass(group.availability)}`}>{group.call_sign.slice(0, 2)}</div><div className="response-group-row-main"><div className="response-group-row-top"><strong>{group.name}</strong><span className={`badge ${stateClass(group.availability)}`}>{group.availability}</span></div><span>{group.agency} · {group.group_type} · {group.personnel_ready}/{group.personnel_total} personnel ready</span><small>{group.specialties.slice(0, 2).join(" · ")} · {group.location_label}</small></div><div className="response-group-row-right"><strong>{group.readiness_score}%</strong><small>{formatAge(group.last_location_at)}</small></div></button>)}{!filtered.length && <div className="empty-state">No response groups match the current filters. Widen the search or review offline groups.</div>}</div></section><aside className="panel response-group-detail">{selected ? <><div className="panel-header"><div><div className="eyebrow">Selected group</div><div className="panel-title">{selected.name}</div><div className="panel-subtitle">{selected.agency} · {selected.call_sign}</div></div><span className={`badge ${stateClass(selected.availability)}`}>{selected.availability}</span></div><div className="panel-body"><div className="response-group-hero"><div className="response-group-score"><strong>{selected.readiness_score}</strong><span>readiness</span></div><div><strong>{selected.personnel_ready}/{selected.personnel_total} ready</strong><span>{selected.lead} · {selected.contact_channel}</span><small>{selected.vehicle_or_asset}</small></div></div><div className="detail-grid"><div><span>Current location</span><strong>{selected.location_label}</strong><small>{selected.location.latitude.toFixed(5)}, {selected.location.longitude.toFixed(5)}</small></div><div><span>Location freshness</span><strong>{formatAge(selected.last_location_at)}</strong><small>{selected.location_source} · ±{selected.location_accuracy_meters ?? "—"} m accuracy</small></div><div><span>Response estimate</span><strong>{selected.estimated_response_minutes ? `${selected.estimated_response_minutes} min` : "Not estimated"}</strong><small>From current position</small></div><div><span>Last check-in</span><strong>{formatAge(selected.last_check_in_at)}</strong><small>{selected.status.replace("_", " ")}</small></div></div><div className="response-group-section"><span className="drawer-label">Specialties</span><div className="tag-list">{selected.specialties.map((item) => <em key={item}>{item}</em>)}</div></div><div className="response-group-section"><span className="drawer-label">Equipment and constraints</span><div className="response-detail-list"><div><strong>Equipment</strong><span>{selected.equipment.join(" · ")}</span></div><div><strong>Constraints</strong><span>{selected.constraints.length ? selected.constraints.join(" · ") : "None reported"}</span></div></div></div><div className="response-group-section"><span className="drawer-label">Assignment desk</span>{dispatchReadinessIssue && <div className="dispatch-guardrail" role="alert"><strong>Deployment held</strong><span>{dispatchReadinessIssue}</span></div>}<select aria-label="Assignment target type" value={targetType} onChange={(event) => setTargetType(event.target.value as typeof targetType)}><option value="sos_request">SOS incident</option><option value="task">Operations task</option><option value="barangay">Barangay operation</option><option value="evacuation_center">Evacuation center</option></select><select aria-label="Assignment target" value={resolvedTargetId} onChange={(event) => setTargetId(event.target.value)} disabled={!targetOptions.length}>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><input aria-label="Assignment note" placeholder="Assignment note or safety constraint" value={assignmentNote} onChange={(event) => setAssignmentNote(event.target.value)} /><button className="primary-button full-width" disabled={!canAssign} onClick={submitAssignment}>{assigning ? "Assigning…" : selected.availability === "assigned" ? "Already assigned" : "Assign this group"}</button>{message && <div className="inline-status">{message}</div>}</div><button className="ghost-button full-width" onClick={() => onAction("response_group.checked_in", "response_group", selected.id, `Checked ${selected.name} roster and location details.`)}>Record roster check</button></div></> : <div className="empty-state">Select a response group to inspect readiness and assignment options.</div>}</aside></div><NotificationDeliveryPanel snapshot={notifications} onAcknowledge={onAcknowledge} onRetry={onRetry} />
  </>;
}

function CoordinationView({ communications, incidents, groups, notifications, onAction, onRefresh, onAcknowledge, onRetry }: {
  communications: CommunicationSnapshot;
  incidents: SosIncident[];
  groups: ResponseGroupSnapshot;
  notifications: NotificationSnapshot;
  onAction: (action: string, type: string, id?: string, note?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onAcknowledge: (notification: AssignmentNotification) => Promise<void>;
  onRetry: (notification: AssignmentNotification) => Promise<void>;
}) {
  const [direction, setDirection] = useState<"all" | CommunicationEvent["direction"]>("all");
  const [channel, setChannel] = useState<"all" | CommunicationEvent["channel"]>("all");
  const [priority, setPriority] = useState<"all" | CommunicationEvent["priority"]>("all");
  const [toUnit, setToUnit] = useState("All response groups");
  const [outboundChannel, setOutboundChannel] = useState<CommunicationEvent["channel"]>("VHF");
  const [outboundPriority, setOutboundPriority] = useState<CommunicationEvent["priority"]>("priority");
  const [draft, setDraft] = useState("");
  const [simulateAudio, setSimulateAudio] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(incidents[0]?.id || "");
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [assigningRecommendation, setAssigningRecommendation] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) || incidents[0];
  const availableGroups = groups.groups.filter((group) => group.availability !== "offline");
  const filteredEvents = communications.events.filter((event) =>
    (direction === "all" || event.direction === direction) &&
    (channel === "all" || event.channel === channel) &&
    (priority === "all" || event.priority === priority),
  );
  const playAudio = (item: AudioDispatchItem) => {
    setPlayingId(item.id);
    window.setTimeout(() => setPlayingId((current) => current === item.id ? null : current), Math.max(900, item.duration_seconds * 1000));
  };
  const sendMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setMessage(null);
    try {
      await sendCoordinationCommunication({
        channel: outboundChannel,
        to_unit: toUnit,
        message: trimmed,
        priority: outboundPriority,
        linked_incident_id: selectedIncident?.id,
        simulate_audio: simulateAudio,
      });
      setDraft("");
      setMessage(`Dispatch sent to ${toUnit}${simulateAudio ? " with audio simulation" : ""}.`);
      await onAction("coordination.message_sent", "communication_event", undefined, `Sent ${outboundPriority} ${outboundChannel} message to ${toUnit}.`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Communication could not be sent.");
    } finally {
      setSending(false);
    }
  };
  const requiredSpecialties = selectedIncident
    ? (() => {
        const emergencyType = selectedIncident.emergency_type.toLowerCase();
        if (emergencyType.includes("flood") || emergencyType.includes("water")) return ["swiftwater rescue", "boat operations"];
        if (emergencyType.includes("trapped")) return ["swiftwater rescue", "household extraction", "boat operations"];
        if (emergencyType.includes("medical")) return ["emergency triage", "first aid", "patient transport"];
        if (emergencyType.includes("structural")) return ["household extraction", "first aid"];
        if (emergencyType.includes("logistics")) return ["relief distribution", "water resupply", "evacuation-center support"];
        return ["first aid", "radio dispatch"];
      })()
    : [];
  const runRecommendation = async () => {
    if (!selectedIncident || recommendationLoading) return;
    setRecommendationLoading(true);
    setMessage(null);
    try {
      const next = await getDispatchRecommendations({
        incident_id: selectedIncident.id,
        severity: selectedIncident.severity,
        emergency_type: selectedIncident.emergency_type,
        latitude: selectedIncident.location.latitude,
        longitude: selectedIncident.location.longitude,
        required_specialties: requiredSpecialties,
        max_results: 5,
      });
      setRecommendation(next);
      await onAction("dispatch.recommendations_generated", "sos_request", selectedIncident.id, `Generated ${next.recommendations.length} ranked response-group recommendations.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation engine could not run.");
    } finally {
      setRecommendationLoading(false);
    }
  };
  const assignRecommended = async () => {
    if (!recommendation?.recommended_group_id || !selectedIncident || assigningRecommendation) return;
    const selectedRecommendation = recommendation.recommendations.find((item) => item.group_id === recommendation.recommended_group_id);
    setAssigningRecommendation(true);
    try {
      await assignResponseGroup({
        group_id: recommendation.recommended_group_id,
        target_type: "sos_request",
        target_id: selectedIncident.id,
        assignment_note: `Accepted automated recommendation: score ${selectedRecommendation?.score ?? "—"}; ${selectedRecommendation?.reasons[0] ?? "ranked match"}.`,
      });
      setMessage(`${selectedRecommendation?.group_name || "Recommended group"} assigned to ${selectedIncident.emergency_type}.`);
      await onAction("dispatch.recommendation_accepted", "sos_request", selectedIncident.id, `Accepted automated recommendation for ${selectedRecommendation?.group_name || recommendation.recommended_group_id}.`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommended assignment could not be recorded.");
    } finally {
      setAssigningRecommendation(false);
    }
  };
  return <>
    <div className="subtab-intro"><div><div className="eyebrow">Coordination desk · voice and dispatch</div><h2>Communications and dispatch intelligence</h2><p>Maintain a traceable command-to-field log, simulate audio dispatch handoffs during drills, and compare response groups using severity, specialty, distance, readiness, freshness, and constraints.</p></div><div className="readout-block"><strong>{communications.unread_count}</strong><span>unread coordination events</span></div></div>
    <div className="coordination-summary"><div className="summary-strip"><strong>{communications.events.length}</strong><span>logged messages</span></div><div className="summary-strip"><strong>{communications.audio_feed.length}</strong><span>audio dispatch clips</span></div><div className="summary-strip"><strong>{Object.values(communications.channel_health).filter((state) => state === "clear").length}</strong><span>clear channels</span></div><div className="summary-strip"><strong>{groups.groups.filter((group) => group.availability === "available").length}</strong><span>groups ready to recommend</span></div></div><NotificationDeliveryPanel snapshot={notifications} compact onAcknowledge={onAcknowledge} onRetry={onRetry} />
    <div className="coordination-layout">
      <section className="panel coordination-log-panel"><PanelHeader title="Live communication log" subtitle="Inbound, outbound, and broadcast coordination events with incident linkage" action={<span className="panel-link">Updated {formatAge(communications.generated_at)}</span>} /><div className="control-strip coordination-filters"><select aria-label="Filter communication direction" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="all">All directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="broadcast">Broadcast</option></select><select aria-label="Filter communication channel" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}><option value="all">All channels</option><option value="VHF">VHF</option><option value="HF">HF</option><option value="SMS">SMS</option><option value="phone">Phone</option><option value="field_runner">Field runner</option></select><select aria-label="Filter communication priority" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="all">All priority</option><option value="distress">Distress</option><option value="urgent">Urgent</option><option value="priority">Priority</option><option value="routine">Routine</option></select></div><div className="coordination-event-list">{filteredEvents.map((event) => <article className="coordination-event" key={event.id}><div className={`coordination-direction ${event.direction}`}>{event.direction === "inbound" ? "↓" : event.direction === "outbound" ? "↑" : "↗"}</div><div className="coordination-event-main"><div className="coordination-event-top"><strong>{event.from_unit} → {event.to_unit}</strong><span className={`badge ${severityClass(event.priority)}`}>{event.priority}</span></div><p>{event.message}</p><small>{event.channel} · {formatAge(event.occurred_at)} · {event.operator}{event.linked_incident_id ? ` · incident ${event.linked_incident_id.slice(0, 8)}` : ""}</small></div><span className={`badge ${stateClass(event.status)}`}>{event.status}</span></article>)}{!filteredEvents.length && <div className="empty-state">No coordination events match the current filters.</div>}</div></section>
      <section className="panel audio-feed-panel"><PanelHeader title="Audio dispatch feed" subtitle="Simulation mode for radio handoff rehearsal and acknowledgement timing" action={<span className="panel-link">{communications.audio_feed.filter((item) => item.status === "queued").length} queued</span>} /><div className="audio-feed-list">{communications.audio_feed.map((item) => <article className={`audio-dispatch-row ${playingId === item.id ? "playing" : ""}`} key={item.id}><button className="audio-play-button" aria-label={`Play dispatch from ${item.from_unit}`} onClick={() => playAudio(item)}>{playingId === item.id ? "Ⅱ" : "▶"}</button><div className="audio-dispatch-main"><div className="coordination-event-top"><strong>{item.from_unit} → {item.to_unit}</strong><span className={`badge ${severityClass(item.priority)}`}>{item.priority}</span></div><p>{item.transcript}</p><div className="audio-waveform" aria-hidden="true">{item.waveform.map((level, index) => <span key={`${item.id}-${index}`} style={{ height: `${Math.max(10, level * 34)}px` }} />)}</div><small>{item.channel} · {item.duration_seconds}s · {formatAge(item.started_at)}</small></div><span className={`badge ${stateClass(item.status)}`}>{playingId === item.id ? "playing" : item.status}</span></article>)}</div><div className="callout"><strong>Simulation boundary</strong><span>Audio controls render the dispatch transcript and waveform timing only. Connect a secured radio/voice gateway before treating this as a live audio channel.</span></div></section>
    </div>
    <div className="coordination-layout lower">
      <section className="panel dispatch-composer-panel"><PanelHeader title="Send command-to-field message" subtitle="Record the operator, channel, priority, and linked incident before transmission" action={<span className="panel-link">{Object.entries(communications.channel_health).map(([name, state]) => `${name} ${state}`).join(" · ")}</span>} /><div className="panel-body dispatch-composer"><div className="composer-grid"><label>Response unit<select value={toUnit} onChange={(event) => setToUnit(event.target.value)}><option>All response groups</option>{availableGroups.map((group) => <option key={group.id}>{group.call_sign} · {group.name}</option>)}</select></label><label>Channel<select value={outboundChannel} onChange={(event) => setOutboundChannel(event.target.value as CommunicationEvent["channel"])}><option value="VHF">VHF</option><option value="HF">HF</option><option value="SMS">SMS</option><option value="phone">Phone</option><option value="field_runner">Field runner</option></select></label><label>Priority<select value={outboundPriority} onChange={(event) => setOutboundPriority(event.target.value as CommunicationEvent["priority"])}><option value="distress">Distress</option><option value="urgent">Urgent</option><option value="priority">Priority</option><option value="routine">Routine</option></select></label></div><textarea aria-label="Dispatch message" placeholder="Example: Alpha Rescue, proceed to Barangay 4 bridge approach. Confirm route and report arrival." value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="composer-actions"><label className="checkbox-label"><input type="checkbox" checked={simulateAudio} onChange={(event) => setSimulateAudio(event.target.checked)} /> Add simulated audio clip</label><span>{selectedIncident ? `Linked to ${selectedIncident.emergency_type} · ${selectedIncident.barangay}` : "No incident selected"}</span><button className="primary-button" disabled={!draft.trim() || sending} onClick={sendMessage}>{sending ? "Sending…" : "Send dispatch"}</button></div>{message && <div className="inline-status">{message}</div>}</div></section>
      <section className="panel recommendation-panel"><PanelHeader title="Automated dispatch recommendations" subtitle="Explainable ranking for the selected incident" action={<button className="primary-button" disabled={!selectedIncident || recommendationLoading} onClick={runRecommendation}>{recommendationLoading ? "Ranking…" : "Run recommendation"}</button>} /><div className="panel-body recommendation-body"><label>Incident<select aria-label="Recommendation incident" value={selectedIncident?.id || ""} onChange={(event) => { setSelectedIncidentId(event.target.value); setRecommendation(null); }}><option value="">Select incident</option>{incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.emergency_type} · {incident.barangay} · {incident.severity}</option>)}</select></label>{selectedIncident && <div className="recommendation-brief"><strong>{selectedIncident.emergency_type} · {selectedIncident.barangay}</strong><span>{selectedIncident.severity} · required specialties: {requiredSpecialties.join(", ") || "general response"}</span></div>}{recommendation ? <><div className="recommendation-meta"><span>Engine {recommendation.engine_version}</span><span>{recommendation.source}</span><span>{recommendation.safety_notes[0]}</span></div><div className="recommendation-list">{recommendation.recommendations.map((item) => <article className={`recommendation-row ${item.group_id === recommendation.recommended_group_id ? "recommended" : ""}`} key={item.group_id}><div className="recommendation-rank">#{item.rank}<strong>{item.score}</strong></div><div className="recommendation-main"><div className="coordination-event-top"><strong>{item.group_name}</strong><span className={`badge ${item.eligibility === "recommended" ? "good" : item.eligibility === "ineligible" ? "danger" : "neutral"}`}>{item.eligibility}</span></div><span>{Math.round(item.distance_meters)}m · {item.estimated_response_minutes ?? "—"} min · position {item.freshness_minutes} min old</span><div className="tag-list">{item.specialty_match.map((match) => <em key={match}>{match}</em>)}{item.missing_specialties.map((missing) => <em className="missing" key={missing}>missing {missing}</em>)}</div><small>{item.reasons.join(" · ")}</small></div><div className="recommendation-factors">{item.factors.slice(0, 3).map((factor) => <span key={factor.factor}><b>+{factor.points}</b> {factor.factor}</span>)}</div></article>)}</div><button className="primary-button full-width" disabled={!recommendation.recommended_group_id || assigningRecommendation} onClick={assignRecommended}>{assigningRecommendation ? "Assigning…" : "Accept top recommendation and assign"}</button></> : <div className="empty-state">Select an incident and run the engine to rank eligible response groups. Each result includes the score factors, specialty match, proximity, freshness, and constraints used.</div>}</div></section>
    </div>
  </>;
}

function CoordinatorEmergencyDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (created: SosCreateResult) => Promise<void> }) {
  const [form, setForm] = useState<CoordinatorEmergencyCreate>({ emergency_type: "TRAPPED", severity: "critical", summary: "", barangay: "", latitude: 11.1264, longitude: 125.3892, accuracy_meters: 30, reporter_name: "", reporter_contact: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof CoordinatorEmergencyCreate>(key: K, value: CoordinatorEmergencyCreate[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!form.summary.trim() || !form.barangay.trim()) { setError("Enter the barangay and a clear emergency summary before recording the report."); return; }
    if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) { setError("Enter valid latitude and longitude coordinates before recording the report."); return; }
    setSaving(true);
    try {
      const created = await createCoordinatorEmergency({ ...form, summary: form.summary.trim(), barangay: form.barangay.trim(), reporter_name: form.reporter_name?.trim() || undefined, reporter_contact: form.reporter_contact?.trim() || undefined, occurred_at: new Date().toISOString() });
      await onCreated(created);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The emergency report could not be recorded. Keep the details and try again.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="drawer-backdrop coordinator-intake-backdrop" role="presentation" onClick={onClose}><aside className="drawer coordinator-intake-drawer" role="dialog" aria-modal="true" aria-label="Record a coordinator-reported emergency" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">Coordinator intake · manual report</div><h2>Record an emergency</h2><p className="panel-subtitle">Use this for phone calls, radio traffic, walk-ins, or field relays. It will enter the same triage queue as an SOS request.</p></div><button className="close-button" type="button" onClick={onClose} aria-label="Close emergency intake">×</button></div><form className="drawer-body manual-intake-form" onSubmit={submit}><div className="intake-grid"><label>Emergency type<select value={form.emergency_type} onChange={(event) => update("emergency_type", event.target.value)}><option value="TRAPPED">Trapped / rescue needed</option><option value="MEDICAL">Medical emergency</option><option value="FLOOD">Flood / water hazard</option><option value="STRUCTURAL">Structural damage</option><option value="EVACUATION">Evacuation assistance</option><option value="OTHER">Other urgent concern</option></select></label><label>Urgency<select value={form.severity} onChange={(event) => update("severity", event.target.value as CoordinatorEmergencyCreate["severity"])}><option value="critical">Critical · life safety</option><option value="warning">Warning · urgent support</option><option value="advisory">Advisory · needs verification</option></select></label><label>Barangay<input required value={form.barangay} placeholder="Example: Barangay 4" onChange={(event) => update("barangay", event.target.value)} /></label><label>Location accuracy (meters)<input type="number" min="0" max="5000" value={form.accuracy_meters ?? ""} onChange={(event) => update("accuracy_meters", event.target.value ? Number(event.target.value) : undefined)} /></label><label>Latitude<input required type="number" step="0.000001" value={form.latitude} onChange={(event) => update("latitude", Number(event.target.value))} /></label><label>Longitude<input required type="number" step="0.000001" value={form.longitude} onChange={(event) => update("longitude", Number(event.target.value))} /></label><label>Reporter name <span className="field-optional">optional</span><input value={form.reporter_name || ""} placeholder="Name given by caller or relay" onChange={(event) => update("reporter_name", event.target.value)} /></label><label>Reporter contact <span className="field-optional">optional</span><input value={form.reporter_contact || ""} placeholder="Phone, radio call sign, or relay" onChange={(event) => update("reporter_contact", event.target.value)} /></label></div><label className="full-form-field">Emergency summary<textarea required maxLength={500} value={form.summary} placeholder="Who needs help, what happened, how many people are affected, and any immediate hazards." onChange={(event) => update("summary", event.target.value)} /></label><div className="callout critical-callout"><strong>Before recording</strong><span>Confirm the best available location and reporter details. This creates an auditable manual incident, not a verified field report; check the route and contact the reporter before dispatch.</span></div>{error && <div className="inline-status error-status" role="alert">{error}</div>}<div className="drawer-actions"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Recording…" : "Record and open for triage"}</button></div></form></aside></div>;
}

function OperatorAssistDrawer({ onClose, incidents, alerts, notifications }: { onClose: () => void; incidents: SosIncident[]; alerts: AlertItem[]; notifications: NotificationSnapshot }) {
  const [copied, setCopied] = useState(false);
  const handoff = buildShiftHandoff({ incidents, alerts, notifications });
  const copyHandoff = async () => {
    try {
      await navigator.clipboard.writeText(handoff);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return <div className="drawer-backdrop operator-assist-backdrop" role="presentation" onClick={onClose}><aside className="drawer operator-assist-drawer" role="dialog" aria-modal="true" aria-label="Operator quick keys and shift handoff" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">Operator continuity</div><h2>Quick keys and shift handoff</h2><p className="panel-subtitle">Keep context across a handover and move between command areas without reaching for the mouse.</p></div><button className="close-button" type="button" onClick={onClose} aria-label="Close quick keys and shift handoff">×</button></div><div className="drawer-body operator-assist-body"><section className="operator-assist-section"><div className="panel-title">Keyboard shortcuts</div><div className="shortcut-grid"><span><kbd>1–9</kbd> Switch command areas</span><span><kbd>R</kbd> Refresh the operational picture</span><span><kbd>N</kbd> Record a manual emergency</span><span><kbd>?</kbd> Open this operator panel</span><span><kbd>Esc</kbd> Close a drawer or panel</span></div><div className="callout"><strong>Safety boundary</strong><span>Shortcuts never send a dispatch, acknowledge a report, or assign a team. Those actions remain deliberate button presses with visible context.</span></div></section><section className="operator-assist-section"><PanelHeader title="Copyable shift handoff" subtitle="A short, current brief for the next duty officer" action={<button className="tiny-button" type="button" onClick={() => void copyHandoff()}>{copied ? "Copied" : "Copy handoff"}</button>} /><pre className="handoff-preview">{handoff}</pre><p className="handoff-note">Share this through an approved LGU channel only. Re-verify locations, field conditions, and delivery status before acting on a handoff.</p></section></div></aside></div>;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [operations, setOperations] = useState<OperationsSnapshot | null>(null); const [gis, setGis] = useState<GisMapSnapshot | null>(null); const [responseGroups, setResponseGroups] = useState<ResponseGroupSnapshot | null>(null); const [coordination, setCoordination] = useState<CommunicationSnapshot | null>(null); const [notifications, setNotifications] = useState<NotificationSnapshot | null>(null); const [provincialWeather, setProvincialWeather] = useState<ProvincialWeatherSnapshot | null>(null); const [selected, setSelected] = useState<SosIncident | null>(null); const [user, setUser] = useState<UserIdentity | null>(null); const [feedHealth, setFeedHealth] = useState<FeedHealth[]>([]); const [connection, setConnection] = useState<"live" | "cached">("cached"); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [bootReady, setBootReady] = useState(false); const [tab, setTab] = useState<Tab>("Overview"); const [toast, setToast] = useState<string | null>(null); const [manualIntakeOpen, setManualIntakeOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([getDashboardSummary(), getFeedHealth(), getOperations(), getGisMap(), getResponseGroups(), getCoordinationCommunications(), getNotifications(), getProvincialWeatherSituation()]);
    const [summaryResult, healthResult, operationsResult, gisResult, groupsResult, coordinationResult, notificationsResult, provincialWeatherResult] = results;
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    if (healthResult.status === "fulfilled") setFeedHealth(healthResult.value);
    if (operationsResult.status === "fulfilled") setOperations(operationsResult.value);
    if (gisResult.status === "fulfilled") setGis(gisResult.value);
    if (groupsResult.status === "fulfilled") setResponseGroups(groupsResult.value);
    if (coordinationResult.status === "fulfilled") setCoordination(coordinationResult.value);
    if (notificationsResult.status === "fulfilled") setNotifications(notificationsResult.value);
    if (provincialWeatherResult.status === "fulfilled") setProvincialWeather(provincialWeatherResult.value);
    if (failures.length === 0) { setConnection("live"); setError(null); } else { setConnection("cached"); setError(`${failures.length} command-center data source${failures.length === 1 ? "" : "s"} could not be refreshed.`); }
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setBootReady(true), 850);
    return () => window.clearTimeout(timer);
  }, []);
  // Command Map is the deliberate home canvas after every load; other workspaces stay available through its quick navigation.
  useEffect(() => { window.localStorage.setItem("cfr_active_tab", tab); }, [tab]);
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try { const result = await demoLogin("dispatcher"); if (!cancelled) setUser(result.user); } catch { /* Existing token or demo read-only mode may still be valid. */ }
      if (!cancelled) await load();
    };
    void bootstrap();
    const stopSos = subscribeToSosEvents(() => void load()); const stopGis = subscribeToGisEvents(() => void load()); const stopGroups = subscribeToResponseGroupEvents(() => void load()); const stopCoordination = subscribeToCoordinationEvents(() => void load()); const stopNotifications = subscribeToNotificationEvents(() => void load()); const interval = window.setInterval(() => void load(), 30000);
    return () => { cancelled = true; stopSos(); stopGis(); stopGroups(); stopCoordination(); stopNotifications(); window.clearInterval(interval); };
  }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const shortcut = resolveOperatorShortcut({ key: event.key, editable: Boolean(target?.closest("input, textarea, select, [contenteditable='true']")), canRecordEmergency: canUseCoordinatorIntake(user), tabCount: navItems.length });
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.action === "close") { setSelected(null); setManualIntakeOpen(false); }
      if (shortcut.action === "refresh") { void load(); setToast("Refreshing the operational picture…"); }
      if (shortcut.action === "record-emergency") setManualIntakeOpen(true);
      if (shortcut.action === "switch-tab" && shortcut.tabIndex !== undefined) setTab(navItems[shortcut.tabIndex].label);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [load, user?.role]);
  const onAction = useCallback(async (action: string, type: string, id?: string, note?: string) => {
    try {
      if (action === "provincial_weather.reviewed" && type === "weather_situation") {
        const assessment: FloodRiskAssessment = await assessFloodRisk();
        const level = assessment.risk_level.replaceAll("_", " ");
        const freshness = assessment.source_freshness.fresh ? "fresh PAGASA source" : "stale or unavailable PAGASA source";
        setToast(`Flood-risk assessment: ${level}. Coordinator review required; no public communication sent (${freshness}).`);
        await load();
        return;
      }
      const result = await recordOperationsAction({ action, resource_type: type, resource_id: id, note });
      const outcome = result.mutated === true ? "Updated" : result.mutated === false ? "Audit recorded" : "Recorded";
      setToast(result.message || `${outcome}: ${action.replaceAll(".", " · ")}`);
      await load();
    } catch (requestError) {
      setToast(requestError instanceof Error ? requestError.message : "Action could not be recorded");
    }
  }, [load]);
  const handleCoordinatorEmergencyCreated = useCallback(async (created: SosCreateResult) => {
    try {
      const refreshedSummary = await getDashboardSummary();
      setSummary(refreshedSummary);
      const createdIncident = refreshedSummary.sos?.find((incident) => incident.id === created.id);
      setManualIntakeOpen(false);
      setTab("Live SOS");
      if (createdIncident) setSelected(createdIncident);
      setToast(`Manual emergency recorded${createdIncident ? " and opened for triage" : ""}.`);
    } catch (requestError) {
      setManualIntakeOpen(false);
      setTab("Live SOS");
      setToast(`Manual emergency recorded. Refreshing the queue may be required: ${requestError instanceof Error ? requestError.message : "snapshot unavailable"}`);
    } finally {
      void load();
    }
  }, [load]);
  const snapshotIncomplete = !summary || !operations || !gis || !responseGroups || !coordination || !notifications || !provincialWeather;
  if (snapshotIncomplete && (!bootReady || loading)) return <CommandCenterLoader />;
  if (snapshotIncomplete) return <CommandCenterLoader error={error || "The command center could not assemble a complete operational snapshot."} onRetry={() => void load()} />;
  const incidents = summary.sos; const alerts = summary.alerts; const centers = summary.centers;
  const acknowledge = async (notification: AssignmentNotification) => { try { const updated = await acknowledgeNotification(notification.id, "Receipt confirmed from command center."); setNotifications((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === updated.id ? updated : item), pending_count: Math.max(0, current.pending_count - 1) } : current); setToast(`${notification.recipient_label} acknowledged the assignment.`); } catch (requestError) { setToast(requestError instanceof Error ? requestError.message : "Acknowledgement could not be recorded."); } };
  const retry = async (notification: AssignmentNotification) => { try { const updated = await retryNotification(notification.id); setNotifications((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === updated.id ? updated : item), failed_count: Math.max(0, current.failed_count - (updated.status === "failed" ? 0 : 1)) } : current); setToast(`Retry requested for ${notification.recipient_label}.`); } catch (requestError) { setToast(requestError instanceof Error ? requestError.message : "Notification retry could not be recorded."); } };
  const pageMeta: Record<Exclude<Tab, "Incident Triage" | "Fleet & Responder Safety" | "DRRMO Intelligence">, { eyebrow: string; title: string; description: string }> = { Overview: { eyebrow: "Wednesday · 12 August 2026 · 10:24 AM", title: "Situation overview", description: "One operational picture for verified alerts, assistance requests, and evacuation capacity." }, "Live SOS": { eyebrow: "Response desk · life safety", title: "Live SOS", description: "Triage incoming requests, verify location confidence, and coordinate the next accountable action." }, "Verified Alerts": { eyebrow: "Information desk · source control", title: "Verified alerts", description: "Keep public warnings authoritative, time-bounded, and traceable to a trusted source." }, "Provincial Weather": { eyebrow: "Weather desk · official source context", title: "Provincial weather situation", description: "Review PAGASA regional weather information with Project NOAH static flood, landslide, and storm-surge reference datasets." }, "Risk Map": { eyebrow: "Planning desk · spatial risk", title: "Risk map", description: "Compare active hazard constraints, SOS positions, centers, and safe movement options." }, "Evacuation Centers": { eyebrow: "Shelter desk · population movement", title: "Evacuation centers", description: "Monitor intake readiness, capacity, amenities, barangay assignments, and transport gaps." }, Resources: { eyebrow: "Logistics desk · accountability", title: "Resources", description: "Track response assets, team posture, relief stock, and communications acknowledgement." }, "Response Groups": { eyebrow: "Personnel desk · deployment readiness", title: "Response groups", description: "Match available emergency groups to incidents using specialty, readiness, location, communications, and assignment constraints." }, Communications: { eyebrow: "Coordination desk · voice and dispatch", title: "Communications", description: "Coordinate command-to-field traffic, rehearse audio dispatch, and accept explainable response-group recommendations." } };
  const canRecordManualEmergency = canUseCoordinatorIntake(user);
  if (tab === "Overview") return <><CommandMapView summary={summary} gis={gis} groups={responseGroups} health={feedHealth} user={user} connection={connection} onSelect={setSelected} onNavigate={setTab} onAction={onAction} onRefresh={() => void load()} error={error} />{selected && <TriageDrawer incident={selected} onClose={() => setSelected(null)} onUpdated={(updated) => setSummary((current) => current ? { ...current, sos: current.sos.map((item) => item.id === updated.id ? updated : item) } : current)} onAction={onAction} />}{manualIntakeOpen && <CoordinatorEmergencyDrawer onClose={() => setManualIntakeOpen(false)} onCreated={handleCoordinatorEmergencyCreated} />}{toast && <div className="action-toast" role="status"><span>✓</span>{toast}</div>}</>;
  if (tab === "Incident Triage") return <IncidentTriageView incidents={incidents} alerts={alerts} onAction={onAction} onRefresh={load} onReturn={() => setTab("Overview")} />;
  if (tab === "Fleet & Responder Safety") return <FleetResponderSafetyView groups={responseGroups} gis={gis} onAction={onAction} onRefresh={load} onReturn={() => setTab("Overview")} />;
  if (tab === "DRRMO Intelligence") return <IntelligenceDashboardView health={feedHealth} connection={connection} summary={summary} onAction={onAction} onReturn={() => setTab("Overview")} />;
  // @ts-expect-error Overview exits above into CommandMapView; the legacy shell keeps other tab branches together.
  return <div className="dashboard-shell"><header className="topbar"><div className="brand"><img className="brand-mark" src="/cfr-reference-emblem.png" alt="Code for Resilience resilience emblem" /><div><div className="brand-title">Code for Resilience</div><div className="brand-subtitle">Balangiga LGU · DRRM command center</div></div></div><div className="topbar-center"><div className="connection-pill"><span className={`connection-dot ${connection === "cached" ? "offline" : ""}`} />{connection === "live" ? "Live operations" : "Cached snapshot"}</div><span>Wednesday · 12 August 2026</span></div><div className="topbar-actions"><div className="sync-label">{user ? `${user.display_name} · ${user.role}` : "Operational session"}<br /><strong>Last verified sync · {formatAge(summary.generated_at)}</strong></div><div className="avatar">{user?.display_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DR"}</div></div></header><div className="workspace"><aside className="sidebar"><div className="sidebar-label">Command center</div>{navItems.map((item, index) => <button key={item.label} className={`nav-item ${tab === item.label ? "active" : ""}`} onClick={() => setTab(item.label)} aria-keyshortcuts={`${index + 1}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.label === "Response Groups" && notifications.pending_count > 0 && <span className="nav-notification-badge">{notifications.pending_count}</span>}</button>)}<div className="sidebar-footer"><strong>Operating period</strong>{operations.operating_period}<br /><span className="sidebar-phase">{operations.incident_phase} phase</span><br /><br />Cached records are clearly marked and should be re-verified before dispatch.</div></aside><main className="main-content"><div className="page-heading"><div><h1>{pageMeta[tab].title}</h1></div><div className="heading-actions"><button className="ghost-button" onClick={() => void load()} aria-keyshortcuts="R">↻ Refresh</button>{tab === "Live SOS" && canRecordManualEmergency && <button className="primary-button" onClick={() => setManualIntakeOpen(true)} aria-keyshortcuts="N">+ Record emergency</button>}<button className="primary-button" onClick={() => onAction("bulletin.draft_started", "communications_plan", undefined, "Started a public bulletin from the command center header.")}>Publish bulletin</button></div></div>{error && <div className="error-banner">Data refresh failed. The dashboard is showing its last known snapshot. {error}</div>}{tab === "Overview" && <OverviewView summary={summary} incidents={incidents} centers={centers} alerts={alerts} health={feedHealth} gis={gis} groups={responseGroups} notifications={notifications} onSelect={setSelected} onAction={onAction} onNavigate={setTab} />}{tab === "Live SOS" && <LiveSosView incidents={incidents} onSelect={setSelected} onAction={onAction} />}{tab === "Verified Alerts" && <AlertsView alerts={alerts} health={feedHealth} onAction={onAction} />}{tab === "Provincial Weather" && <ProvincialWeatherView snapshot={provincialWeather} onAction={onAction} onOpenRiskMap={() => setTab("Risk Map")} />}{tab === "Risk Map" && <RiskMapView incidents={incidents} hazards={operations.hazards} gis={gis} onAction={onAction} />}{tab === "Evacuation Centers" && <EvacuationCentersView centers={centers} readiness={operations.readiness} onAction={onAction} />}{tab === "Resources" && <ResourcesView resources={operations.resources} communications={operations.communications} teams={operations.teams} onAction={onAction} />}{tab === "Response Groups" && <ResponseGroupsView snapshot={responseGroups} incidents={incidents} tasks={operations.tasks} centers={centers} notifications={notifications} onAction={onAction} onRefresh={load} onAcknowledge={acknowledge} onRetry={retry} onAssignment={setToast} />}{tab === "Communications" && <CoordinationView communications={coordination} incidents={incidents} groups={responseGroups} notifications={notifications} onAction={onAction} onRefresh={load} onAcknowledge={acknowledge} onRetry={retry} />}</main></div>{selected && <TriageDrawer incident={selected} onClose={() => setSelected(null)} onUpdated={(updated) => setSummary((current) => current ? { ...current, sos: current.sos.map((item) => item.id === updated.id ? updated : item) } : current)} onAction={onAction} />}{manualIntakeOpen && <CoordinatorEmergencyDrawer onClose={() => setManualIntakeOpen(false)} onCreated={handleCoordinatorEmergencyCreated} />}{toast && <div className="action-toast" role="status"><span>✓</span>{toast}</div>}</div>;
}
