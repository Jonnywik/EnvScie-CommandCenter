"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type TouchEvent, type WheelEvent } from "react";
import { clampViewportTransform, EASTERN_VISAYAS_REGIONAL_BBOX, esriWorldImageryExportUrl, rainViewerTilesForBbox, type MapViewportTransform } from "../../lib/mapContext";
import { type AlertItem, type Center, type DashboardSummary, type FeedHealth, type GisMapSnapshot, type GisResource, type MapOverlaysSnapshot, type NoahMapContext, type OfficialFacility, type OfficialFacilityRegistry, type OptimizedRoute, type RadarSnapshot, type ResponseGroupSnapshot, type SosIncident, type TyphoonSnapshot, type UserIdentity, getMapOverlays, getNoahMapContext, getOfficialFacilityRegistry, updateGisResourcePosition } from "../../lib/api";
import { AppearanceToggle, type AppearanceMode } from "./AppearanceToggle";
import { CommandCenterNavigation } from "./CommandCenterNavigation";
import { GoogleOperationalMap, type GoogleBasemap } from "./GoogleOperationalMap";
import type { CommandCenterTab, OperationalAction } from "./contracts";

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
function formatTime(timestamp?: string | null) { return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not yet sent"; }

function severityClass(value: string) {
  if (["critical", "received", "high", "active"].includes(value)) return "critical";
  if (["warning", "acknowledged", "medium", "monitoring", "low"].includes(value)) return "warning";
  return "advisory";
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="panel-header"><div><div className="panel-title">{title}</div><div className="panel-subtitle">{subtitle}</div></div>{action}</div>;
}

type CommandMapLayers = { weatherRadar: boolean; floodRisk: boolean; pagasaRadar: boolean; pagasaStations: boolean; pagasaSatellite: boolean; lightning: boolean; noahFlood: boolean; noahLandslide: boolean; noahStormSurge: boolean };
type CommandMapTriageFilters = { sosSeverity: "all" | "critical" | "warning" | "advisory"; sosStatus: "all" | "received" | "acknowledged" | "dispatched"; resourceState: "all" | "ready" | "active" | "stale"; centerState: "all" | "open" | "constrained"; hazardState: "all" | "active" | "monitoring"; freshness: "all" | "fresh" | "stale" };
const commandMapFilterDefaults: CommandMapTriageFilters = { sosSeverity: "all", sosStatus: "all", resourceState: "all", centerState: "all", hazardState: "all", freshness: "all" };
const COMMAND_MAP_TRIAGE_FILTERS_KEY = "cfr_command_map_triage_filters";

function CommandMapLayerTool({ layers, toggleLayer, basemap, setBasemap, noahContext, noahError, open, onToggle }: { layers: CommandMapLayers; toggleLayer: (key: keyof CommandMapLayers) => void; basemap: GoogleBasemap; setBasemap: (value: GoogleBasemap) => void; noahContext: NoahMapContext | null; noahError: string | null; open: boolean; onToggle: () => void }) {
  return <section className={`command-map-layer-rail ${open ? "is-open" : ""}`} aria-label="Map layer controls"><button className="command-map-layer-trigger" type="button" onClick={onToggle} aria-expanded={open} aria-controls="command-map-layer-drawer" aria-label={open ? "Close map layers" : "Open map layers"} title={open ? "Close map layers" : "Open map layers"}><span aria-hidden="true">▤</span></button>{open && <div id="command-map-layer-drawer" className="command-map-layer-drawer"><div className="command-map-layer-heading"><span>MAP VIEW</span><b>Basemap &amp; operational overlays</b></div><div className="command-map-basemap-controls" role="group" aria-label="Google Maps basemap">{(["roadmap", "satellite", "terrain"] as const).map((value) => <button key={value} type="button" className={basemap === value ? "active" : ""} aria-pressed={basemap === value} onClick={() => setBasemap(value)}>{value === "roadmap" ? "Road" : value === "satellite" ? "Satellite" : "Terrain"}</button>)}</div><div className="layer-switch-group"><span>ACTIVE CONTEXT</span><div className="layer-switches">{([{ key: "weatherRadar", label: "Live Weather Radar", accent: "violet" }, { key: "floodRisk", label: "Flood Risk Zones", accent: "coral" }] as const).map((layer) => <label className="layer-switch" key={layer.key}><span><i className={layer.accent} />{layer.label}</span><button type="button" role="switch" aria-checked={layers[layer.key]} onClick={() => toggleLayer(layer.key)}><b /></button></label>)}</div></div><div className="layer-switch-group"><span>PROJECT NOAH · REFERENCE</span><div className="layer-switches">{([{ key: "noahFlood", label: "Flood · 100-year rain return", accent: "teal" }, { key: "noahLandslide", label: "Landslide susceptibility", accent: "amber" }, { key: "noahStormSurge", label: "Storm-surge scenarios 1–4", accent: "violet" }] as const).map((layer) => <label className="layer-switch" key={layer.key}><span><i className={layer.accent} />{layer.label}</span><button type="button" role="switch" aria-checked={layers[layer.key]} onClick={() => toggleLayer(layer.key)} disabled={!noahContext} aria-describedby={`${layer.key}-status`}><b /></button><small id={`${layer.key}-status`} className="sr-only">{noahContext ? "Modeled Project NOAH reference context only." : "Project NOAH reference context is unavailable."}</small></label>)}</div>{noahContext ? <><p><a href={noahContext.dataset_url} target="_blank" rel="noreferrer">{noahContext.provider} · {noahContext.license}</a><br />{noahContext.decision_limit}</p><div className="noah-facility-source"><b>Critical facilities</b><span>{noahContext.critical_facilities.message}</span><a href={noahContext.critical_facilities.source_url} target="_blank" rel="noreferrer">Open NOAH Studio facility context ↗</a></div></> : <p>{noahError || "Loading Project NOAH reference context…"}</p>}</div><div className="layer-switch-group"><span>LIVE METEOROLOGY</span><div className="layer-switches">{["PAGASA Radar/QPE", "PAGASA Stations", "Himawari Context", "Licensed Lightning"].map((label) => <label className="layer-switch pending" key={label}><span><i className={label.includes("Lightning") ? "amber" : "teal"} /><span>{label}<small>Provider access pending</small></span></span><button type="button" role="switch" aria-checked={false} disabled><b /></button></label>)}</div></div><p>Imagery and overlays provide operational context; they do not confirm field safety or route clearance.</p></div>}</section>;
}

function CommandMapTriageFilterTool({ filters, onChange, onClear, summary, open, onToggle }: { filters: CommandMapTriageFilters; onChange: (next: CommandMapTriageFilters) => void; onClear: () => void; summary: string; open: boolean; onToggle: () => void }) {
  const update = <K extends keyof CommandMapTriageFilters>(key: K, value: CommandMapTriageFilters[K]) => onChange({ ...filters, [key]: value });
  return <section className={`command-map-filter-rail ${open ? "is-open" : ""}`} aria-label="Operational triage filters"><button className="command-map-filter-trigger" type="button" onClick={onToggle} aria-expanded={open} aria-controls="command-map-triage-drawer"><span aria-hidden="true">≡</span><span>Filter</span></button>{open && <div id="command-map-triage-drawer" className="command-map-triage-drawer"><div className="command-map-layer-heading"><span>OPERATIONAL TRIAGE</span><b>Visible map context</b></div><p className="triage-filter-summary">{summary}</p><label>SOS severity<select value={filters.sosSeverity} onChange={(event) => update("sosSeverity", event.target.value as CommandMapTriageFilters["sosSeverity"])}><option value="all">All severity</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="advisory">Advisory</option></select></label><label>SOS status<select value={filters.sosStatus} onChange={(event) => update("sosStatus", event.target.value as CommandMapTriageFilters["sosStatus"])}><option value="all">All status</option><option value="received">Received</option><option value="acknowledged">Acknowledged</option><option value="dispatched">Dispatched</option></select></label><label>Unit posture<select value={filters.resourceState} onChange={(event) => update("resourceState", event.target.value as CommandMapTriageFilters["resourceState"])}><option value="all">All units</option><option value="ready">Ready / standby</option><option value="active">En route / deployed</option><option value="stale">Stale / offline</option></select></label><label>Center capacity<select value={filters.centerState} onChange={(event) => update("centerState", event.target.value as CommandMapTriageFilters["centerState"])}><option value="all">All centers</option><option value="open">Open centers</option><option value="constrained">Full / closed / constrained</option></select></label><label>Hazard state<select value={filters.hazardState} onChange={(event) => update("hazardState", event.target.value as CommandMapTriageFilters["hazardState"])}><option value="all">All hazards</option><option value="active">Active</option><option value="monitoring">Monitoring</option></select></label><label>Position age<select value={filters.freshness} onChange={(event) => update("freshness", event.target.value as CommandMapTriageFilters["freshness"])}><option value="all">All reports</option><option value="fresh">Fresh ≤15 min</option><option value="stale">Older / unknown</option></select></label><p>Filters focus the map but do not alter, resolve, or remove operational records. Clear them before a wider review.</p><button type="button" className="command-map-filter-clear" onClick={onClear}>Clear triage filters</button></div>}</section>;
}
type MapInspectablePin =
  | { kind: "resource"; item: GisResource }
  | { kind: "center"; item: GisMapSnapshot["centers"][number] }
  | { kind: "sos"; item: GisMapSnapshot["sos"][number] };

export function GISMapPanel({ snapshot, route, onAction, variant = "panel", commandLayers, layerTool, filterTool, activeAuxiliaryDrawer, onFacilityControlOpenChange, appearance = "dark", mapBasemap, noahContext, onOpenIncidentWorkspace, onOpenResourceWorkspace, onOpenCenterWorkspace }: { snapshot: GisMapSnapshot; route?: OptimizedRoute | null; onAction: OperationalAction; variant?: "panel" | "command"; commandLayers?: CommandMapLayers; layerTool?: React.ReactNode; filterTool?: React.ReactNode; activeAuxiliaryDrawer?: "layers" | "filters" | null; onFacilityControlOpenChange?: (open: boolean) => void; appearance?: "dark" | "light"; mapBasemap?: GoogleBasemap; noahContext?: NoahMapContext | null; onOpenIncidentWorkspace?: (id: string) => void; onOpenResourceWorkspace?: (id: string) => void; onOpenCenterWorkspace?: (id: string) => void }) {
  const [layers, setLayers] = useState({ hazards: true, resources: true, sos: true, centers: true, route: true, radar: true, typhoon: true, pagasaRadar: false, pagasaStations: false, pagasaSatellite: false, lightning: false, noahFlood: false, noahLandslide: false, noahStormSurge: false });
  const [basemap, setBasemap] = useState<"satellite" | "operational">("satellite");
  const commandMapMode = variant === "command";
  const darkMapTreatment = commandMapMode && appearance === "dark";
  const [officialFacilitiesVisible, setOfficialFacilitiesVisible] = useState(false);
  const displayedLayers = commandLayers ? { ...layers, hazards: commandLayers.floodRisk, radar: commandLayers.weatherRadar, noahFlood: commandLayers.noahFlood, noahLandslide: commandLayers.noahLandslide, noahStormSurge: commandLayers.noahStormSurge, officialFacilities: officialFacilitiesVisible } : { ...layers, officialFacilities: officialFacilitiesVisible };
  const displayedBasemap = commandMapMode ? (mapBasemap === "satellite" ? "satellite" : "operational") : basemap;
  const googleBasemap: GoogleBasemap = mapBasemap || (basemap === "satellite" ? "satellite" : "roadmap");
  const [regionalContext, setRegionalContext] = useState(false);
  const [selectedPin, setSelectedPin] = useState<MapInspectablePin | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<OfficialFacility | null>(null);
  const [facilityRegistry, setFacilityRegistry] = useState<OfficialFacilityRegistry | null>(null);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [facilityControlOpen, setFacilityControlOpen] = useState(false);
  const [facilityCategories, setFacilityCategories] = useState<OfficialFacility["category"][]>(["hospital", "rural_health_unit"]);
  const [updating, setUpdating] = useState(false);
  const [radar, setRadar] = useState<RadarSnapshot | null>(null);
  const [typhoon, setTyphoon] = useState<TyphoonSnapshot | null>(null);
  const [mapOverlays, setMapOverlays] = useState<MapOverlaysSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  useEffect(() => {
    if (activeAuxiliaryDrawer) setFacilityControlOpen(false);
  }, [activeAuxiliaryDrawer]);
  const [googleMap, setGoogleMap] = useState<any | null>(null);
  const [googleMapError, setGoogleMapError] = useState<string | null>(null);
  const [googleMapTilesReady, setGoogleMapTilesReady] = useState(false);
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
  const rainviewerMaxZoom = Math.min(radar?.max_zoom ?? 7, 7);
  const radarTiles = useMemo(() => latestRadarFrame && radar?.host ? rainViewerTilesForBbox(weatherBbox, radar.host, latestRadarFrame.path, rainviewerMaxZoom) : [], [latestRadarFrame, radar?.host, rainviewerMaxZoom, weatherBbox]);
  const regionalPlaces = [
    { label: "Samar", latitude: 12.08, longitude: 125.1, kind: "province" },
    { label: "Eastern Samar", latitude: 11.35, longitude: 125.58, kind: "province" },
    { label: "Balangiga", latitude: 11.11, longitude: 125.39, kind: "focus" },
    { label: "Leyte", latitude: 10.94, longitude: 124.88, kind: "province" },
    { label: "Southern Leyte", latitude: 10.28, longitude: 125.05, kind: "province" },
    { label: "Leyte Gulf", latitude: 10.84, longitude: 125.48, kind: "water" },
  ] as const;
  const selectedResource = selectedPin?.kind === "resource" ? selectedPin.item : null;
  const pinKeyActivate = (event: React.KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); }
  };
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
    if (googleMap) { googleMap.setZoom(Math.max(7, Math.min(14, (googleMap.getZoom?.() || 13) + (nextScale > 1 ? 1 : -1)))); return; }
    setViewTransform((current) => {
      const scale = Math.min(8, Math.max(.5, nextScale));
      const ratio = scale / current.scale;
      return clampViewportTransform({ scale, x: anchorX - (anchorX - current.x) * ratio, y: anchorY - (anchorY - current.y) * ratio }, width, height);
    });
  };
  const resetViewport = () => { if (googleMap) { googleMap.setCenter({ lat: snapshot.center.latitude, lng: snapshot.center.longitude }); googleMap.setZoom(13); return; } setViewTransform({ x: 0, y: 0, scale: 1 }); };
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
    if (!mapShell || googleMap) return;
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
  }, [googleMap]);
  useEffect(() => {
    let active = true;
    const refreshWeather = async () => {
      try {
        const nextOverlays = await getMapOverlays();
        if (!active) return;
        setMapOverlays(nextOverlays); setRadar(nextOverlays.rainviewer_radar); setTyphoon(nextOverlays.typhoon); setWeatherError(null);
      } catch {
        if (active) setWeatherError("Weather feeds are temporarily unavailable.");
      }
    };
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    let active = true;
    void getOfficialFacilityRegistry().then((registry) => {
      if (!active) return;
      setFacilityRegistry(registry);
      setFacilityError(null);
    }).catch(() => {
      if (active) setFacilityError("Official facility references are temporarily unavailable.");
    });
    return () => { active = false; };
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
      setSelectedPin({ kind: "resource", item: updated });
      await onAction("gis.resource_position_checked", "resource", updated.id, `Checked ${updated.label} position from the GIS map.`);
    } finally {
      setUpdating(false);
    }
  };
  return <section className={`panel map-panel gis-map-panel ${commandMapMode ? "command-map-hero" : ""}`}>
    {!commandMapMode && <PanelHeader title="Operational GIS map" subtitle={regionalContext ? "Eastern Samar regional context with Balangiga operational layers" : "Live resource positions, hazard polygons, SOS locations, centers, and optimized movement"} action={<div className="gis-header-controls"><div className="map-tools gis-basemap-controls" role="group" aria-label="Map basemap and extent"><button className={`map-tool ${basemap === "satellite" ? "active" : ""}`} aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</button><button className={`map-tool ${basemap === "operational" ? "active" : ""}`} aria-pressed={basemap === "operational"} onClick={() => setBasemap("operational")}>Operational</button><button className={`map-tool ${regionalContext ? "active" : ""}`} aria-pressed={regionalContext} onClick={() => setRegionalContext((current) => !current)}>{regionalContext ? "Balangiga focus" : "Regional context"}</button></div><div className="map-tools" role="group" aria-label="Operational map layers">{(["hazards", "resources", "sos", "centers", "route", "radar", "typhoon"] as const).map((layer) => <button key={layer} className={`map-tool ${layers[layer] ? "active" : ""}`} aria-pressed={layers[layer]} onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>{layer === "hazards" ? "Hazards" : layer === "resources" ? "Resources" : layer === "radar" ? "Radar" : layer === "typhoon" ? "Typhoon" : layer.toUpperCase()}</button>)}</div></div>} />}
    <div ref={mapShellRef} className="gis-map-shell" tabIndex={0} aria-label="Interactive Google Maps viewport. Drag to pan; use the mouse wheel or controls to zoom." onWheel={googleMap ? undefined : onWheel} onPointerDown={googleMap ? undefined : onPointerDown} onPointerMove={googleMap ? undefined : onPointerMove} onPointerUp={googleMap ? undefined : endPointer} onPointerCancel={googleMap ? undefined : endPointer} onTouchStart={googleMap ? undefined : onTouchStart} onTouchMove={googleMap ? undefined : onTouchMove} onTouchEnd={googleMap ? undefined : onTouchEnd}>
      <GoogleOperationalMap snapshot={snapshot} route={route} layers={displayedLayers} radar={radar} typhoon={typhoon} mapOverlays={mapOverlays} noahContext={noahContext || null} facilityRegistry={facilityRegistry} facilityCategories={facilityCategories} appearance={appearance} basemap={googleBasemap} selectedResourceId={selectedPin?.kind === "resource" ? selectedPin.item.id : undefined} selectedCenterId={selectedPin?.kind === "center" ? selectedPin.item.id : undefined} selectedSosId={selectedPin?.kind === "sos" ? selectedPin.item.id : undefined} onSelectResource={(item) => { setSelectedFacility(null); setSelectedPin({ kind: "resource", item }); }} onSelectCenter={(item) => { setSelectedFacility(null); setSelectedPin({ kind: "center", item }); }} onSelectSos={(item) => { setSelectedFacility(null); setSelectedPin({ kind: "sos", item }); }} onSelectFacility={(facility) => { setSelectedPin(null); setSelectedFacility(facility); }} onReady={(map) => { setGoogleMap(map); setGoogleMapTilesReady(false); setGoogleMapError(null); }} onTilesReady={() => setGoogleMapTilesReady(true)} onError={setGoogleMapError} />
      {(!googleMapTilesReady || googleMapError) && <svg className={`gis-map-canvas ${displayedBasemap === "satellite" ? "satellite" : "operational"} ${commandMapMode ? "command-map-canvas" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={regionalContext ? "Satellite and operational regional map showing Balangiga, Eastern Samar, Leyte Gulf, and surrounding provincial context" : "Satellite and operational map of Balangiga response resources and evacuation constraints"}>
        <defs><clipPath id="gis-map-clip"><rect width={width} height={height} /></clipPath><pattern id="gis-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1" /></pattern><linearGradient id="gis-satellite-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#082436" stopOpacity=".08" /><stop offset="1" stopColor="#082436" stopOpacity=".28" /></linearGradient></defs>
        <g clipPath="url(#gis-map-clip)" transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
        {displayedBasemap === "satellite" ? <><rect width={width} height={height} fill="#153d4d" /><image href={satelliteUrl} x="0" y="0" width={width} height={height} preserveAspectRatio="none" /><rect width={width} height={height} fill="url(#gis-satellite-shade)" /></> : <><rect width={width} height={height} fill={darkMapTreatment ? "#07141a" : "#dceff1"} /><path d={`M0 0 H${width} V92 C720 132 690 112 612 138 C492 178 420 108 330 134 C218 168 120 110 0 148 Z`} fill={darkMapTreatment ? "#0a2c35" : "#bde4df"} /><rect width={width} height={height} fill="url(#gis-grid)" opacity={darkMapTreatment ? ".14" : ".7"} /><path d={`M80 ${height - 36} C210 300 340 340 474 224 S724 160 840 74`} fill="none" stroke={darkMapTreatment ? "#70b9c5" : "#ffffff"} strokeWidth="10" strokeLinecap="round" opacity={darkMapTreatment ? ".72" : ".78"} /><path d={`M120 82 C248 176 340 116 440 192 S630 330 804 336`} fill="none" stroke={darkMapTreatment ? "#397886" : "#ffffff"} strokeWidth="7" strokeLinecap="round" opacity={darkMapTreatment ? ".78" : ".78"} /></>}
        {displayedLayers.radar && radarTiles.map((tile) => <image key={`${tile.z}-${tile.x}-${tile.y}`} className="gis-radar-overlay" href={tile.url} x={((tile.west - minLon) / (maxLon - minLon)) * width} y={((maxLat - tile.north) / (maxLat - minLat)) * height} width={((tile.east - tile.west) / (maxLon - minLon)) * width} height={((tile.north - tile.south) / (maxLat - minLat)) * height} preserveAspectRatio="none" />)}
        {regionalContext && <g className="gis-regional-labels">{regionalPlaces.map((place) => { const p = point(place); return <g key={place.label} className={place.kind}><circle cx={p.x} cy={p.y} r={place.kind === "focus" ? 10 : 4} /><text x={p.x + 8} y={p.y - 7}>{place.label}</text>{place.kind === "focus" && <circle className="gis-focus-ring" cx={p.x} cy={p.y} r="17" />}</g>; })}</g>}
        {displayedLayers.hazards && snapshot.hazards.map((hazard) => <path key={hazard.id} d={polygonPath(hazard.polygon)} fill={hazard.severity === "critical" ? "#ef4444" : "#f59e0b"} fillOpacity={hazard.status === "active" ? ".28" : ".13"} stroke={hazard.severity === "critical" ? "#be123c" : "#b45309"} strokeWidth="2" strokeDasharray={hazard.status === "active" ? undefined : "6 5"}><title>{hazard.name} · {hazard.action}</title></path>)}
        {displayedLayers.route && route && <path d={linePath(route.route)} fill="none" stroke="#0f766e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".2" />}
        {displayedLayers.route && route && <path d={linePath(route.route)} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><title>{route.center_name} · {route.route_status} · {route.avoided_hazard_count} hazards avoided</title></path>}
        {displayedLayers.centers && snapshot.centers.map((center) => { const p = point(center.position); const select = () => setSelectedPin({ kind: "center", item: center }); return <g key={center.id} className={`gis-marker gis-center-marker ${selectedPin?.kind === "center" && selectedPin.item.id === center.id ? "selected" : ""}`} transform={`translate(${p.x} ${p.y})`} onClick={select} onKeyDown={(event) => pinKeyActivate(event, select)} role="button" tabIndex={0} aria-label={`Inspect evacuation center ${center.name}`}><circle r="11" /><text x="0" y="4" textAnchor="middle">⌂</text><title>{center.name} · {center.occupancy_current}/{center.capacity_total}</title></g>; })}
        {displayedLayers.sos && snapshot.sos.map((incident) => { const p = point(incident.position); const select = () => setSelectedPin({ kind: "sos", item: incident }); return <g key={incident.id} className={`gis-marker gis-sos-marker ${selectedPin?.kind === "sos" && selectedPin.item.id === incident.id ? "selected" : ""}`} transform={`translate(${p.x} ${p.y})`} onClick={select} onKeyDown={(event) => pinKeyActivate(event, select)} role="button" tabIndex={0} aria-label={`Inspect SOS alert ${incident.id}`}><circle r="9" /><text x="0" y="4" textAnchor="middle">!</text><title>{incident.summary} · {incident.status}</title></g>; })}
        {displayedLayers.resources && snapshot.resources.map((resource) => { const p = point(resource.position); const select = () => setSelectedPin({ kind: "resource", item: resource }); return <g key={resource.id} className={`gis-marker gis-resource-marker ${selectedResource?.id === resource.id ? "selected" : ""}`} transform={`translate(${p.x} ${p.y})`} onClick={select} onKeyDown={(event) => pinKeyActivate(event, select)} role="button" tabIndex={0} aria-label={`Inspect response resource ${resource.label}`}><circle r="10" /><text x="0" y="4" textAnchor="middle">{resource.kind === "medical" ? "+" : resource.kind === "boat" ? "⌁" : "•"}</text><title>{resource.label} · {resource.state} · {resource.reported_at ? formatAge(resource.reported_at) : "no position time"}</title></g>; })}
        {displayedLayers.typhoon && typhoon?.active && visibleTyphoonPoint && <>{typhoon.track.length > 1 && <path className="gis-typhoon-track" d={linePath(typhoon.track)} />}<g className="gis-typhoon-marker" transform={`translate(${visibleTyphoonPoint.x} ${visibleTyphoonPoint.y})`}><circle r="15" /><text textAnchor="middle" y="6">{typhoonOutsideExtent ? "↖" : "◌"}</text><text className="gis-typhoon-label" x="20" y="-14">{typhoon.name || "Tropical cyclone"}{typhoonOutsideExtent ? " · outside view" : ""}</text><title>{typhoon.name || "Tropical cyclone"} · {typhoonCoordinates} · PAGASA bulletin {typhoon.issued_at || "time not listed"}{typhoonOutsideExtent ? " · position lies outside this map extent" : ""}</title></g></>}
        </g>
      </svg>}
      <div className="gis-tool-rail" aria-label="Map tools"><div className="gis-zoom-controls" role="group" aria-label="Map zoom controls"><button aria-label="Zoom in" onClick={() => zoomAround(viewTransform.scale * 1.3)}>+</button><button aria-label="Zoom out" onClick={() => zoomAround(viewTransform.scale / 1.3)}>−</button><button aria-label="Reset map view" onClick={resetViewport}>Reset</button></div>{layerTool}{filterTool}</div>
      {commandMapMode && <section className={`official-facility-layer ${facilityControlOpen ? "is-open" : ""}`} aria-label="Official facility registry controls"><button className="official-facility-trigger" type="button" onClick={() => setFacilityControlOpen((open) => { const next = !open; onFacilityControlOpenChange?.(next); return next; })} aria-expanded={facilityControlOpen} aria-controls="official-facility-layer-panel"><span aria-hidden="true">✚</span><span>Facilities</span></button>{facilityControlOpen && <div id="official-facility-layer-panel" className="official-facility-panel"><div><span>OFFICIAL REGISTRY</span><b>Balangiga health facilities</b></div><label className="layer-switch"><span><i className="teal" />Show source records</span><button type="button" role="switch" aria-checked={officialFacilitiesVisible} onClick={() => setOfficialFacilitiesVisible((visible) => !visible)} disabled={!facilityRegistry}><b /></button></label>{facilityRegistry && <><div className="facility-category-filters" role="group" aria-label="Official facility categories">{(["hospital", "rural_health_unit"] as const).map((category) => <button type="button" className={facilityCategories.includes(category) ? "active" : ""} key={category} aria-pressed={facilityCategories.includes(category)} onClick={() => setFacilityCategories((categories) => categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category])}>{category === "hospital" ? "Hospitals" : "Rural health units"}</button>)}</div><p>{facilityRegistry.scope}</p><p className="facility-source-status">{facilityRegistry.decision_limit}</p></>}{facilityError && <p>{facilityError}</p>}{!facilityRegistry && !facilityError && <p>Loading official registry references…</p>}</div>}</section>}
      <div className="gis-map-badge"><span className={`health-dot ${weatherError || googleMapError || radar?.stale || typhoon?.stale ? "stale" : ""}`} />{googleMapError || weatherError || (radar?.frames.length ? `Radar ${radar.stale ? "cached" : "updated"} ${formatAge(radar.fetched_at)} · supported through map zoom ${rainviewerMaxZoom}` : "Radar unavailable")} · PAGASA/QPE pending approval · Lightning provider pending · {googleBasemap === "satellite" ? "Satellite imagery" : googleBasemap === "terrain" ? "Terrain context" : "Road map"}</div>
      <div className="map-legend gis-legend"><span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> Active hazard</span><span className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }} /> Watch / closure</span><span className="legend-item"><span className="legend-dot" style={{ background: "#2563eb" }} /> Tracked resource</span><span className="legend-item"><span className="legend-dot" style={{ background: "#7c3aed" }} /> Radar / cyclone</span></div>
      <div className="gis-attribution">{googleMapError ? <>{displayedBasemap === "satellite" && <><a href="https://www.esri.com/en-us/arcgis/products/arcgis-living-atlas" target="_blank" rel="noreferrer">© Esri imagery</a><span> · </span></>}</> : <><span>Google Maps {googleBasemap === "satellite" ? "satellite imagery" : googleBasemap === "terrain" ? "terrain" : "road map"}</span><span> · </span></>}<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">Weather data by RainViewer</a><span> · </span><a href={typhoon?.source_url || "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin"} target="_blank" rel="noreferrer">PAGASA bulletin{typhoon?.issued_at ? ` · ${typhoon.issued_at}` : ""}</a></div>
    </div>
    {selectedPin && <aside className="map-pin-sheet" role="region" aria-label={`${selectedPin.kind === "resource" ? "Response resource" : selectedPin.kind === "center" ? "Evacuation center" : "SOS alert"} information sheet`}><div className="map-pin-sheet-heading"><div><span>{selectedPin.kind === "resource" ? "RESPONSE RESOURCE" : selectedPin.kind === "center" ? "EVACUATION CENTER" : "SOS ALERT"}</span><h2>{selectedPin.kind === "resource" ? selectedPin.item.label : selectedPin.kind === "center" ? selectedPin.item.name : selectedPin.item.summary}</h2></div><button type="button" onClick={() => setSelectedPin(null)} aria-label="Close information sheet">×</button></div>{selectedPin.kind === "resource" ? <><p>{selectedPin.item.owner} · {selectedPin.item.current_assignment || "No active assignment"}</p><div className="map-pin-sheet-grid"><span><b>{selectedPin.item.state.replace("_", " ")}</b> state</span><span><b>{selectedPin.item.reported_at ? formatAge(selectedPin.item.reported_at) : "unknown"}</b> position age</span><span><b>{selectedPin.item.accuracy_meters ? `±${Math.round(selectedPin.item.accuracy_meters)}m` : "—"}</b> accuracy</span><span><b>{selectedPin.item.battery_pct == null ? "—" : `${selectedPin.item.battery_pct}%`}</b> battery</span></div><div className="map-pin-sheet-coordinates">{selectedPin.item.position.latitude.toFixed(5)}, {selectedPin.item.position.longitude.toFixed(5)} · reported location</div><div className="map-pin-sheet-actions"><button className="tiny-button" disabled={updating} onClick={markPositionChecked}>{updating ? "Saving…" : "Mark position checked"}</button></div></> : selectedPin.kind === "center" ? <><p>{selectedPin.item.status.replace("_", " ")} · capacity status reported by the operating snapshot</p><div className="map-pin-sheet-grid"><span><b>{selectedPin.item.occupancy_current}/{selectedPin.item.capacity_total}</b> occupancy</span><span><b>{Math.max(selectedPin.item.capacity_total - selectedPin.item.occupancy_current, 0)}</b> reported spaces</span><span><b>{selectedPin.item.status.replace("_", " ")}</b> status</span><span><b>Snapshot</b> source</span></div><div className="map-pin-sheet-coordinates">{selectedPin.item.position.latitude.toFixed(5)}, {selectedPin.item.position.longitude.toFixed(5)} · reported location</div></> : <><p>{selectedPin.item.summary}</p><div className="map-pin-sheet-grid"><span><b>{selectedPin.item.severity}</b> severity</span><span><b>{selectedPin.item.status.replace("_", " ")}</b> status</span><span><b>{selectedPin.item.accuracy_meters ? `±${Math.round(selectedPin.item.accuracy_meters)}m` : "—"}</b> reported accuracy</span><span><b>Snapshot</b> source</span></div><div className="map-pin-sheet-coordinates">{selectedPin.item.position.latitude.toFixed(5)}, {selectedPin.item.position.longitude.toFixed(5)} · reported location</div></>}<div className="map-pin-sheet-safeguard">Verify with the reporting party, center coordinator, and field teams before changing operations, routing, or safety status.</div><div className="map-pin-sheet-actions map-workspace-handoff">{selectedPin.kind === "sos" && onOpenIncidentWorkspace && <button className="tiny-button" onClick={() => onOpenIncidentWorkspace(selectedPin.item.id)}>Open Incident triage →</button>}{selectedPin.kind === "resource" && onOpenResourceWorkspace && <button className="tiny-button" onClick={() => onOpenResourceWorkspace(selectedPin.item.id)}>Open Field response →</button>}{selectedPin.kind === "center" && onOpenCenterWorkspace && <button className="tiny-button" onClick={() => onOpenCenterWorkspace(selectedPin.item.id)}>Open Community safety →</button>}</div></aside>}
    {selectedFacility && <aside className="map-pin-sheet official-facility-sheet" role="region" aria-label="Official facility registry information sheet"><div className="map-pin-sheet-heading"><div><span>OFFICIAL FACILITY REFERENCE</span><h2>{selectedFacility.name}</h2></div><button type="button" onClick={() => setSelectedFacility(null)} aria-label="Close official facility information sheet">×</button></div><p>{selectedFacility.category === "hospital" ? "Public hospital" : "Rural health unit"} · {selectedFacility.ownership} ownership</p><div className="map-pin-sheet-grid"><span><b>{selectedFacility.coordinate_validation_status.replaceAll("_", " ")}</b> pin validation</span><span><b>Registry</b> source type</span><span><b>{selectedFacility.category.replaceAll("_", " ")}</b> category</span><span><b>Reference</b> operational role</span></div><div className="map-pin-sheet-coordinates">{selectedFacility.position.latitude.toFixed(5)}, {selectedFacility.position.longitude.toFixed(5)} · provisional map placement</div><p className="official-facility-address">{selectedFacility.address}</p><p className="official-facility-source"><a href={selectedFacility.source_url} target="_blank" rel="noreferrer">{selectedFacility.source_name} ↗</a><br />{selectedFacility.coordinate_source}</p><div className="map-pin-sheet-safeguard">{selectedFacility.validation_message} Registry inclusion does not confirm staffing, access, capacity, supplies, communications, or mission suitability.</div></aside>}
    <div className="map-caption"><span>{regionalContext ? "Regional labels are geographic context only; live operations remain centered on Balangiga." : `${snapshot.resources.filter((resource) => resource.state !== "offline").length} tracked assets · ${snapshot.resources.filter((resource) => resource.reported_at && Date.now() - new Date(resource.reported_at).getTime() > 15 * 60 * 1000).length} stale over 15 min`}</span><span>{noahContext?.decision_limit || (displayedBasemap === "satellite" ? "Imagery is not a live damage, flood, road-status, or safety feed." : "Position confidence and field confirmation remain dispatch guardrails")}</span></div>
  </section>;
}

export function SosQueue({ incidents, onSelect }: { incidents: SosIncident[]; onSelect: (incident: SosIncident) => void }) {
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

export function AlertFeed({ alerts, health, onAction }: { alerts: AlertItem[]; health: FeedHealth[]; onAction: OperationalAction }) {
  return (
    <section className="panel">
      <PanelHeader title="Verified alert feed" subtitle="Official and LGU-published information only" action={<button className="panel-link" onClick={() => onAction("feeds.reviewed", "feed_health", undefined, "Reviewed feed freshness from the overview.")}>Record review →</button>} />
      <div className="feed-health-strip">{health.map((item) => <div className="health-chip" key={item.source_name}><span className={`health-dot ${item.stale ? "stale" : ""}`} />{item.source_name}<strong>{item.stale ? "stale" : "verified"}</strong></div>)}</div>
      <div className="panel-body">{alerts.map((alert) => <article className="alert-card" key={alert.id}><div className="alert-card-top"><div className="alert-title">{alert.title}</div><span className={`badge ${alert.severity}`}>{alert.severity}</span></div><p className="alert-body">{alert.body}</p><div className="alert-meta"><span className="source-dot" />{alert.source_name} · issued {formatAge(alert.issued_at)} · expires {formatTime(alert.expires_at)}</div><div className="inline-actions"><button className="tiny-button" onClick={() => onAction("alert.verified", "verified_alert", alert.id, `Verified ${alert.title}`)}>Verify</button><button className="tiny-button" onClick={() => onAction("bulletin.queued", "verified_alert", alert.id, `Queued public bulletin for ${alert.title}`)}>Queue bulletin</button></div></article>)}</div>
    </section>
  );
}

export function CenterList({ centers, onAction }: { centers: Center[]; onAction: OperationalAction }) {
  return (
    <section className="panel">
      <PanelHeader title="Evacuation capacity" subtitle="Last verified center snapshot" action={<button className="panel-link" onClick={() => onAction("centers.capacity_reviewed", "evacuation_center", undefined, "Reviewed center capacity from overview.")}>Review →</button>} />
      <div className="panel-body">{centers.map((center) => { const ratio = Math.min(100, Math.round((center.occupancy_current / Math.max(center.capacity_total, 1)) * 100)); return <div className="center-row" key={center.id}><div><div className="center-name">{center.name}</div><div className="center-location">{center.barangay} · {center.amenities.slice(0, 2).join(" · ")}</div><div className="capacity-bar"><div className={`capacity-fill ${ratio > 75 ? "high" : ""}`} style={{ width: `${ratio}%` }} /></div></div><div className="center-count"><div>{center.occupancy_current}/{center.capacity_total}</div><div className={`center-status ${center.status !== "open" ? "muted" : ""}`}>{center.status}</div></div></div>; })}</div>
    </section>
  );
}

export function CommandMapView({ summary, gis, groups, health, user, connection, appearance, onAppearanceChange, onSelect, onNavigate, onAction, onRefresh, error }: { summary: DashboardSummary; gis: GisMapSnapshot; groups: ResponseGroupSnapshot; health: FeedHealth[]; user: UserIdentity | null; connection: "live" | "cached"; appearance: AppearanceMode; onAppearanceChange: () => void; onSelect: (incident: SosIncident) => void; onNavigate: (tab: CommandCenterTab) => void; onAction: OperationalAction; onRefresh: () => void; error: string | null }) {
  const [layers, setLayers] = useState<CommandMapLayers>({ weatherRadar: true, floodRisk: true, pagasaRadar: false, pagasaStations: false, pagasaSatellite: false, lightning: false, noahFlood: false, noahLandslide: false, noahStormSurge: false });
  const [noahContext, setNoahContext] = useState<NoahMapContext | null>(null);
  const [noahError, setNoahError] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<GoogleBasemap>("roadmap");
  const [layerDrawerOpen, setLayerDrawerOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("Selected barangays");
  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [triageFilters, setTriageFilters] = useState<CommandMapTriageFilters>(commandMapFilterDefaults);
  const [triageFiltersOpen, setTriageFiltersOpen] = useState(false);
  const [triageFiltersLoaded, setTriageFiltersLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void getNoahMapContext().then((context) => { if (active) { setNoahContext(context); setNoahError(null); } }).catch(() => { if (active) setNoahError("Project NOAH reference layers are unavailable; the live operational map remains active."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COMMAND_MAP_TRIAGE_FILTERS_KEY);
      if (stored) setTriageFilters({ ...commandMapFilterDefaults, ...JSON.parse(stored) });
    } catch { /* A malformed local preference must not block map access. */ }
    setTriageFiltersLoaded(true);
  }, []);
  useEffect(() => {
    if (!triageFiltersLoaded) return;
    window.localStorage.setItem(COMMAND_MAP_TRIAGE_FILTERS_KEY, JSON.stringify(triageFilters));
  }, [triageFilters, triageFiltersLoaded]);
  const normalizedQuery = query.trim().toLowerCase();
  const coordinateQuery = /^-?\d+(?:\.\d+)?\s*[,\s]\s*-?\d+(?:\.\d+)?$/.test(query.trim());
  const matchingZones = useMemo(() => Array.from(new Set([...summary.sos.map((incident) => incident.barangay), ...summary.centers.map((center) => center.barangay)])).filter((zone) => normalizedQuery && zone.toLowerCase().includes(normalizedQuery)).slice(0, 3), [normalizedQuery, summary.centers, summary.sos]);
  const matchingGroups = useMemo(() => groups.groups.filter((group) => normalizedQuery && `${group.id} ${group.call_sign} ${group.name}`.toLowerCase().includes(normalizedQuery)).slice(0, 3), [groups.groups, normalizedQuery]);
  const matchingIncidents = useMemo(() => summary.sos.filter((incident) => normalizedQuery && `${incident.id} ${incident.barangay} ${incident.emergency_type}`.toLowerCase().includes(normalizedQuery)).slice(0, 3), [normalizedQuery, summary.sos]);
  const filteredGis = useMemo(() => {
    const nowMs = Date.now();
    const incidentById = new Map(summary.sos.map((incident) => [incident.id, incident]));
    const isFresh = (timestamp?: string | null) => {
      if (!timestamp) return false;
      return nowMs - new Date(timestamp).getTime() <= 15 * 60 * 1000;
    };
    const resources = gis.resources.filter((resource) => {
      const stateMatches = triageFilters.resourceState === "all" || (triageFilters.resourceState === "active" ? resource.state === "en_route" || resource.state === "deployed" : triageFilters.resourceState === "stale" ? resource.state === "stale" || resource.state === "offline" || !isFresh(resource.reported_at) : resource.state === "ready" || resource.state === "standby");
      const freshnessMatches = triageFilters.freshness === "all" || (triageFilters.freshness === "fresh" ? isFresh(resource.reported_at) : !isFresh(resource.reported_at));
      return stateMatches && freshnessMatches;
    });
    const sos = gis.sos.filter((item) => {
      const incident = incidentById.get(item.id);
      const severity = incident?.severity || item.severity;
      const status = incident?.status || item.status;
      return (triageFilters.sosSeverity === "all" || severity === triageFilters.sosSeverity) && (triageFilters.sosStatus === "all" || status === triageFilters.sosStatus);
    });
    const centers = gis.centers.filter((center) => triageFilters.centerState === "all" || (triageFilters.centerState === "open" ? center.status === "open" : center.status !== "open" || center.occupancy_current >= center.capacity_total));
    const hazards = gis.hazards.filter((hazard) => triageFilters.hazardState === "all" || (triageFilters.hazardState === "active" ? hazard.status === "active" : hazard.status === "monitoring"));
    return { ...gis, resources, sos, centers, hazards };
  }, [gis, summary.sos, triageFilters]);
  const filterSummary = `${filteredGis.sos.length}/${gis.sos.length} SOS · ${filteredGis.resources.length}/${gis.resources.length} units · ${filteredGis.centers.length}/${gis.centers.length} centers · ${filteredGis.hazards.length}/${gis.hazards.length} hazards`;
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
  return <div className="workspace-navigation-shell command-map-workspace"><CommandCenterNavigation activeTab="Overview" onNavigate={onNavigate} className="command-map-sidebar" /><main className={`command-map-shell appearance-${appearance}`} aria-label="Command Map Live Operations">
    <GISMapPanel snapshot={filteredGis} onAction={onAction} variant="command" appearance={appearance} commandLayers={layers} mapBasemap={basemap} noahContext={noahContext} activeAuxiliaryDrawer={triageFiltersOpen ? "filters" : layerDrawerOpen ? "layers" : null} onFacilityControlOpenChange={(open) => { if (open) { setTriageFiltersOpen(false); setLayerDrawerOpen(false); } }} layerTool={<CommandMapLayerTool layers={layers} toggleLayer={toggleLayer} basemap={basemap} setBasemap={setBasemap} noahContext={noahContext} noahError={noahError} open={layerDrawerOpen} onToggle={() => { setLayerDrawerOpen((current) => !current); setTriageFiltersOpen(false); }} />} filterTool={<CommandMapTriageFilterTool filters={triageFilters} onChange={setTriageFilters} onClear={() => setTriageFilters(commandMapFilterDefaults)} summary={filterSummary} open={triageFiltersOpen} onToggle={() => { setTriageFiltersOpen((current) => !current); setLayerDrawerOpen(false); }} />} onOpenIncidentWorkspace={(id) => { const incident = summary.sos.find((item) => item.id === id); if (incident) onSelect(incident); onNavigate("Incident Triage"); }} onOpenResourceWorkspace={() => onNavigate("Fleet & Responder Safety")} onOpenCenterWorkspace={() => onNavigate("Evacuation Centers")} />
    <header className="command-map-topbar">
      <div className="command-map-brand"><img src="/cfr-reference-emblem.png" alt="EnvScie CommandCenter emblem" /><div><strong>EnvScie CommandCenter</strong><span>COMMAND MAP · LIVE OPERATIONS</span></div><time dateTime={now.toISOString()}>{commandTime} PST</time></div>
      <div className="command-search-wrap"><form className="command-search" onSubmit={runSearch}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSearchStatus(null); }} placeholder="Search coordinates, LGU zone, responder ID" aria-label="Search coordinates, LGU zones, or responder IDs" /><button type="submit">Search</button></form>{normalizedQuery && <div className="command-search-results" role="status">{coordinateQuery && <button type="button" onClick={() => setSearchStatus(`Coordinates located: ${query.trim()}`)}>◎ Coordinates · {query.trim()}</button>}{matchingIncidents.map((incident) => <button type="button" key={incident.id} onClick={() => onSelect(incident)}>! SOS · {incident.emergency_type} · {incident.barangay}</button>)}{matchingGroups.map((group) => <button type="button" key={group.id} onClick={() => setSearchStatus(`${group.name} is visible in Responder Radar.`)}>◎ Unit · {group.call_sign} · {group.name}</button>)}{matchingZones.map((zone) => <button type="button" key={zone} onClick={() => setSearchStatus(`${zone} is within the active operational map extent.`)}>⌖ LGU zone · {zone}</button>)}{!coordinateQuery && !matchingIncidents.length && !matchingGroups.length && !matchingZones.length && <span>No matching operational record.</span>}</div>}</div>
      <div className="command-map-session"><div className={`system-health ${systemHealthy ? "healthy" : "degraded"}`}><span />{systemHealthy ? "Systems connected" : "Review source health"}</div><button className="command-avatar" type="button" aria-label="Current operator profile">{user?.display_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DR"}</button><AppearanceToggle appearance={appearance} onAppearanceChange={onAppearanceChange} /></div>
    </header>
    {error && <div className="command-map-error" role="alert">Cached operating picture · {error}</div>}
    {searchStatus && <div className="command-search-status" role="status">{searchStatus}<button type="button" onClick={() => setSearchStatus(null)} aria-label="Dismiss search result">×</button></div>}
    <section className="responder-radar" aria-label="Responder radar"><div className="responder-radar-heading"><div><span>FIELD UNITS</span><h2>Responder radar</h2></div><button type="button" onClick={() => onNavigate("Response Groups")}>Open roster →</button></div><div className="responder-carousel">{groups.groups.filter((group) => group.status !== "offline").slice(0, 8).map((group) => <button type="button" className={`responder-radar-card ${group.status}`} key={group.id} onClick={() => setSearchStatus(`${group.name} · ${group.location_label} · last updated ${formatAge(group.last_location_at)}`)}><span className="responder-status-dot" /><strong>{group.name}</strong><small>{group.vehicle_or_asset || group.group_type}</small><div><span>{group.status.replaceAll("_", " ")}</span><b>{group.estimated_response_minutes ? `${group.estimated_response_minutes} min` : "ETA —"}</b></div></button>)}{!groups.groups.length && <div className="command-empty">No responder groups are reporting.</div>}</div></section>
    <button className="broadcast-fab" type="button" onClick={() => setBroadcastOpen(true)} aria-label="Open Mass Area Notification"><span aria-hidden="true">⌁</span><em>Broadcast</em></button>
    {broadcastOpen && <div className="mass-notification-backdrop" role="presentation" onClick={() => setBroadcastOpen(false)}><section className="mass-notification-modal" role="dialog" aria-modal="true" aria-label="Mass Area Notification" onClick={(event) => event.stopPropagation()}><div className="mass-notification-heading"><div><span>BROADCAST DRAFT</span><h2>Mass Area Notification</h2></div><button type="button" onClick={() => setBroadcastOpen(false)} aria-label="Close mass area notification">×</button></div><form onSubmit={(event) => void submitBroadcast(event)}><label>Audience scope<select value={scope} onChange={(event) => setScope(event.target.value)}><option>Selected barangays</option><option>Municipal-wide</option><option>Evacuation centers</option><option>Response groups</option></select></label><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the approved notification draft…" /></label><p>Draft only. Radius selection, approval, and delivery confirmation remain required before any public transmission.</p><div className="mass-notification-actions"><button type="button" onClick={() => setBroadcastOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!message.trim()}>Save broadcast draft</button></div></form></section></div>}
  </main></div>;
}
