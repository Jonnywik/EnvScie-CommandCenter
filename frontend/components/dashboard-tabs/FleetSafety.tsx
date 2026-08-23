"use client";

import { useEffect, useMemo, useState } from "react";
import { type GisMapSnapshot, type GisResource, type OptimizedRoute, type ResponseGroup, type ResponseGroupSnapshot, optimizeGisRoute, sendCoordinationCommunication } from "../../lib/api";
import { AppearanceToggle, type AppearanceMode } from "./AppearanceToggle";
import { CommandCenterNavigation, FunctionalViewSelector } from "./CommandCenterNavigation";
import type { CommandCenterTab, OperationalAction } from "./contracts";
type FleetFilter = "all" | "idle" | "en_route" | "on_scene";
type FleetSort = "unit" | "status" | "assignment" | "eta";

function formatAge(timestamp?: string | null) {
  if (!timestamp) return "Not reported";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

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

export function FleetResponderSafetyView({ groups, gis, appearance, onAppearanceChange, onAction, onRefresh, onReturn, onNavigate }: { groups: ResponseGroupSnapshot; gis: GisMapSnapshot; appearance: AppearanceMode; onAppearanceChange: () => void; onAction: OperationalAction; onRefresh: () => Promise<void>; onReturn: () => void; onNavigate: (tab: CommandCenterTab) => void }) {
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

  return <div className="workspace-navigation-shell"><CommandCenterNavigation activeTab="Fleet & Responder Safety" onNavigate={onNavigate} /><main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="Field Response fleet safety dashboard">
    <header className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · ASSET READINESS AND FIELD PROTECTION</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">Field Response <span className="font-normal text-slate-400">/ Fleet Safety</span></h1></div><div className="flex items-center gap-2"><AppearanceToggle appearance={appearance} onAppearanceChange={onAppearanceChange} className="workspace-appearance-toggle" /><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></div></header>
    <FunctionalViewSelector activeTab="Fleet & Responder Safety" onNavigate={onNavigate} className="mx-auto mt-4 max-w-[1800px]" />
    <section className="mx-auto grid max-w-[1800px] gap-3 py-4 sm:grid-cols-3" aria-label="Fleet KPI dashboard"><article className="rounded-xl border border-teal-300/25 bg-teal-300/[.08] px-4 py-3"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-200">TOTAL FLEET READINESS</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl text-white">{readinessScore}<span className="text-base text-slate-400">/100</span></strong><span className="text-xs text-slate-300">{readinessBase.length}/{fleetUnits.length} non-offline units</span></div></article><article className="rounded-xl border border-sky-300/25 bg-sky-300/[.08] px-4 py-3"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-sky-200">ACTIVE DEPLOYMENTS</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl text-white">{activeDeployments}</strong><span className="text-xs text-slate-300">en route or on scene</span></div></article><article className={`rounded-xl border px-4 py-3 ${reviewCount ? "border-red-400 bg-red-500/15" : "border-white/15 bg-white/[.04]"}`}><p className={`m-0 text-[10px] font-bold tracking-[0.18em] ${reviewCount ? "text-red-100" : "text-slate-300"}`}>SAFETY BREACHES <span className="font-normal">/ REVIEW FLAGS</span></p><div className="mt-2 flex items-end justify-between gap-3"><strong className={`text-3xl text-white ${reviewCount ? "animate-pulse motion-reduce:animate-none" : ""}`}>{reviewCount}</strong><span className={`text-xs ${reviewCount ? "text-red-100" : "text-slate-300"}`}>{reviewCount ? "needs coordinator review" : "no current review flags"}</span></div></article></section>
    <section className="mx-auto grid max-w-[1800px] gap-4 lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]" aria-label="Fleet deployment and selected unit console">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl"><div className="flex flex-col gap-3 border-b border-white/10 p-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">DEPLOYMENT MATRIX</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Physical asset roster</h2></div><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Search fleet by unit ID or personnel" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Unit ID or personnel" className="min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-teal-300" /><div className="flex rounded-lg border border-white/15 bg-slate-950 p-1" role="group" aria-label="Fleet status filters">{(["all", "idle", "en_route", "on_scene"] as FleetFilter[]).map((item) => <button type="button" key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${filter === item ? "bg-teal-300 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>{item === "all" ? "All" : item === "idle" ? "Idle" : item === "en_route" ? "En Route" : "On-Scene"}</button>)}</div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-white/10 bg-slate-950/60 text-[10px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-4 py-3"><button type="button" onClick={() => selectSort("unit")} className="font-bold text-inherit">Unit ID {sort === "unit" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-3 py-3"><button type="button" onClick={() => selectSort("status")} className="font-bold text-inherit">Status {sort === "status" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-3 py-3"><button type="button" onClick={() => selectSort("assignment")} className="font-bold text-inherit">Assignment {sort === "assignment" ? (sortAscending ? "↑" : "↓") : ""}</button></th><th className="px-4 py-3 text-right"><button type="button" onClick={() => selectSort("eta")} className="font-bold text-inherit">Target ETA {sort === "eta" ? (sortAscending ? "↑" : "↓") : ""}</button></th></tr></thead><tbody>{filteredUnits.map((unit) => <tr key={unit.group.id} onClick={() => setSelectedId(unit.group.id)} aria-selected={selected?.group.id === unit.group.id} className={`cursor-pointer border-b border-white/[.07] transition hover:bg-white/[.05] ${selected?.group.id === unit.group.id ? "bg-teal-300/[.09]" : ""}`}><td className="px-4 py-3"><strong className="block text-sm text-white">{unit.group.call_sign || unit.group.id}</strong><span className="block max-w-[240px] truncate text-xs text-slate-400">{unit.group.name} · {unit.group.lead}</span></td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${fleetStatusTone(unit.group)}`}>{fleetStatusLabel(unit.group)}</span></td><td className="max-w-[250px] px-3 py-3"><span className="block truncate text-xs text-slate-200">{unit.group.current_assignment || "Unassigned / monitoring"}</span><span className="block text-[10px] text-slate-500">{unit.group.vehicle_or_asset}</span></td><td className="px-4 py-3 text-right"><strong className="text-sm text-white">{unit.group.estimated_response_minutes == null ? "—" : `${unit.group.estimated_response_minutes} min`}</strong><span className="mt-1 block text-[10px] text-slate-500">readiness {unit.group.readiness_score}/100</span></td></tr>)}{!filteredUnits.length && <tr><td colSpan={4} className="p-8 text-center text-sm text-slate-400">No fleet units match this filter.</td></tr>}</tbody></table></div><p className="m-0 border-t border-white/10 px-4 py-3 text-xs text-slate-400">Select a unit to update the local GPS context, reported telemetry, and advisory safety review panes.</p></section>
      <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(250px,.86fr)_minmax(410px,1.14fr)]">{selected ? <><section className={`rounded-2xl border p-4 shadow-command ${reviewRequired ? "border-red-400 bg-red-500/[.12]" : "border-slate-500/60 bg-slate-900/90"}`} aria-label="Hazard Proximity Monitor"><div className="flex items-start justify-between gap-3"><div><p className={`m-0 text-[10px] font-bold tracking-[0.18em] ${reviewRequired ? "text-red-100" : "text-slate-400"}`}>HAZARD PROXIMITY MONITOR</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">{selected.group.call_sign || selected.group.name}</h2></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${reviewRequired ? "border-red-200/70 bg-red-500 text-white" : "border-slate-500 bg-slate-800 text-slate-200"}`}>{reviewRequired ? "Safety review" : "No review trigger"}</span></div>{reviewRequired ? <><div className="mt-4 flex gap-3 rounded-xl border border-red-300/45 bg-black/15 p-3"><span className="text-xl text-red-200" aria-hidden="true">⚠</span><div><strong className="text-sm text-red-50">Safety review required</strong><ul className="mb-0 mt-2 space-y-1 pl-4 text-xs leading-5 text-red-100">{selected.reviewTriggers.map((trigger) => <li key={trigger}>{trigger}</li>)}</ul></div></div><p className="mb-0 mt-3 text-xs leading-5 text-red-100">This is an advisory review hold. Confirm field conditions, communications, and route viability; map geometry does not establish a safety clearance.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={actionBusy} onClick={() => setHailConfirmOpen(true)} className="rounded-lg bg-white px-3 py-2.5 text-xs font-bold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Hail Unit via Comms</button><button type="button" disabled={routeLoading} onClick={() => void calculateRoute("reroute_review")} title="Creates an advisory route preview and audit record; it does not force a field reroute." className="rounded-lg border border-red-200/70 bg-red-700/50 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{routeLoading ? "Reviewing…" : "Force Reroute"}</button></div></> : <div className="mt-5 rounded-xl border border-slate-600 bg-slate-950/45 p-4 text-sm text-slate-300"><strong className="block text-slate-100">All units within safe operational perimeters.</strong><span className="mt-2 block text-xs leading-5 text-slate-400">No selected review trigger is present in the current roster, telemetry, or active GIS geometry. Continue field confirmation before movement.</span><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled className="rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-bold text-slate-500">Hail Unit via Comms</button><button type="button" disabled className="rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-bold text-slate-500">Force Reroute</button></div></div>}</section>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-command" aria-label="Dynamic Routing Console"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">DYNAMIC ROUTING CONSOLE</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Local GPS context</h2></div><span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-100">GPS focus</span></div><div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#071820]"><svg viewBox={`0 0 ${miniWidth} ${miniHeight}`} className="block h-40 w-full" role="img" aria-label={`Localized map preview centered on ${selected.group.name}`}><defs><pattern id="fleet-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#5eead4" strokeOpacity=".16" strokeWidth="1" /></pattern><clipPath id="fleet-mini-clip"><rect width={miniWidth} height={miniHeight} /></clipPath></defs><rect width={miniWidth} height={miniHeight} fill="#08232a" /><rect width={miniWidth} height={miniHeight} fill="url(#fleet-grid)" /><path d="M-20 132 C85 98 142 182 234 120 S356 38 448 74" fill="none" stroke="#488391" strokeWidth="18" opacity=".45" />{localHazards.map((hazard) => <path key={hazard.id} clipPath="url(#fleet-mini-clip)" d={`${hazard.polygon.map((point, index) => { const p = miniPoint(point); return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ")} Z`} fill="#ef4444" fillOpacity=".3" stroke="#fca5a5" strokeWidth="2" />)}{miniRoute && <path d={miniRoute} fill="none" stroke="#5eead4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}{route && <g transform={`translate(${miniPoint(route.route.at(-1) || selected.position).x} ${miniPoint(route.route.at(-1) || selected.position).y})`}><circle r="7" fill="#fbbf24" stroke="#fff" strokeWidth="2" /><title>{route.center_name}</title></g>}<g transform={`translate(${miniWidth / 2} ${miniHeight / 2})`}><circle r="15" fill="#2dd4bf" fillOpacity=".14" /><circle r="6" fill="#2dd4bf" stroke="#ecfeff" strokeWidth="2" /><path d="M0 -11V-20" stroke="#ecfeff" strokeWidth="2" /></g><text x="12" y="20" fill="#ccfbf1" fontSize="10" fontWeight="700">LOCKED TO SELECTED GPS POSITION</text></svg><div className="flex flex-wrap justify-between gap-2 border-t border-white/10 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-300"><span>{selectedPosition.latitude.toFixed(5)}, {selectedPosition.longitude.toFixed(5)}</span><span>{localHazards.length ? `${localHazards.length} active hazard geometry in local view` : "No active hazard geometry in local view"}</span></div></div><dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Speed</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.speed_kph == null ? "Not reported" : `${selected.telemetry.speed_kph} kph`}</dd></div><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Last ping</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.reported_at || selected.group.last_location_at ? formatAge(selected.telemetry?.reported_at || selected.group.last_location_at) : "Not reported"}</dd></div><div className="rounded-lg bg-white/[.04] p-2"><dt className="text-slate-500">Battery / fuel</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.telemetry?.battery_pct == null ? "Not reported" : `${selected.telemetry.battery_pct}%`}</dd></div></dl><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={routeLoading} onClick={() => void calculateRoute("recalculate")} className="rounded-lg bg-teal-300 px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{routeLoading ? "Calculating…" : "Recalculate Route"}</button><button type="button" disabled={!route || actionBusy} onClick={() => void recordMobileDraft()} title="Audits a draft only; this workspace has no mobile delivery endpoint." className="rounded-lg border border-white/20 bg-white/[.05] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500">Push to Mobile</button></div><p className="mb-0 mt-3 text-[11px] leading-4 text-slate-400">Route previews use current GIS constraints for advisory planning only. They do not prove clearance, force a reroute, or deliver instructions to a mobile device.</p>{route && <div className={`mt-3 rounded-lg border p-3 text-xs ${route.route_status === "blocked" ? "border-red-300/40 bg-red-500/10 text-red-100" : "border-teal-300/25 bg-teal-300/[.06] text-teal-100"}`}><strong className="block">{route.center_name} · {route.route_status}</strong><span className="mt-1 block">{route.distance_meters.toLocaleString()} m · {Math.round(route.estimated_seconds / 60)} min · {route.avoided_hazard_count} hazard geometry record(s) avoided · {route.blocked_segment_count} blocked segment(s)</span></div>}{actionStatus && <div className="mt-3 rounded-lg border border-white/15 bg-black/20 p-3 text-xs leading-5 text-slate-200" role="status">{actionStatus}</div>}</section></> : <section className="grid min-h-[520px] place-items-center rounded-2xl border border-white/10 bg-slate-900/90 p-8 text-center text-slate-400">Select a fleet unit to review its reported telemetry and safety context.</section>}</div>
    </section>
    {hailConfirmOpen && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="presentation"><section className="w-full max-w-md rounded-2xl border border-red-300/50 bg-slate-900 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Confirm safety hail"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-red-200">OPERATOR CONFIRMATION</p><h2 className="m-0 mt-2 text-lg font-semibold text-white">Send a safety hail?</h2><p className="mb-0 mt-3 text-sm leading-6 text-slate-300">This will submit an urgent VHF request to {selected.group.call_sign || selected.group.name} asking for position, welfare, route, and readiness confirmation. It does not change assignment, route, or safety status.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setHailConfirmOpen(false)} className="rounded-lg border border-white/15 px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10">Cancel</button><button type="button" disabled={actionBusy} onClick={() => void sendHail()} className="rounded-lg bg-red-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-700">{actionBusy ? "Sending…" : "Send Hail Request"}</button></div></section></div>}
  </main></div>;
}
