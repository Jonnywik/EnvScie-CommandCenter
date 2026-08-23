"use client";

import { useEffect, useMemo, useState } from "react";
import { type AlertItem, type RecommendationResponse, type ResponseGroupSnapshot, type SosIncident, assignResponseGroup, getDispatchRecommendations, updateSosStatus } from "../../lib/api";
import { AppearanceToggle, type AppearanceMode } from "./AppearanceToggle";
import { CommandCenterNavigation, FunctionalViewSelector } from "./CommandCenterNavigation";
import type { CommandCenterTab, OperationalAction } from "./contracts";

function severityClass(value: string) {
  if (["critical", "received", "high", "active"].includes(value)) return "critical";
  if (["warning", "acknowledged", "medium", "monitoring", "low"].includes(value)) return "warning";
  return "advisory";
}

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
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

export function IncidentTriageView({ incidents, alerts, appearance, onAppearanceChange, onAction, onRefresh, onReturn, onNavigate, selectedIncidentId }: { incidents: SosIncident[]; alerts: AlertItem[]; appearance: AppearanceMode; onAppearanceChange: () => void; onAction: OperationalAction; onRefresh: () => Promise<void>; onReturn: () => void; onNavigate: (tab: CommandCenterTab) => void; selectedIncidentId?: string | null }) {
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
    const mapSelectedKey = selectedIncidentId ? `sos:${selectedIncidentId}` : "";
    if (mapSelectedKey && records.some((record) => record.key === mapSelectedKey)) setSelectedKey(mapSelectedKey);
  }, [records, selectedIncidentId]);
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

  return <div className="workspace-navigation-shell"><CommandCenterNavigation activeTab="Incident Triage" onNavigate={onNavigate} /><main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="Incident Triage SOS and Alerts">
    <header className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · HIGH-VOLUME INTAKE</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">Incidents <span className="font-normal text-slate-400">/ Triage & Dispatch</span></h1></div><div className="flex items-center gap-2"><AppearanceToggle appearance={appearance} onAppearanceChange={onAppearanceChange} className="workspace-appearance-toggle" /><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></div></header>
    <FunctionalViewSelector activeTab="Incident Triage" onNavigate={onNavigate} className="mx-auto mt-4 max-w-[1800px]" />
    <section className="mx-auto grid max-w-[1800px] gap-4 pt-4 lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]" aria-label="Incident triage split pane">
      <aside className="flex min-h-[42vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl lg:min-h-[calc(100vh-132px)]"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4"><div><h2 className="m-0 text-base font-semibold text-white">Incoming Alerts</h2><p className="m-0 mt-1 text-xs text-slate-400">{sortedRecords.length} records in view</p></div><select aria-label="Rapid alert sorting" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-lg border border-white/15 bg-slate-950 px-2 py-2 text-xs font-medium text-slate-200 outline-none ring-teal-300 focus:ring-2"><option value="severity">Sort by Severity</option><option value="time">Sort by Time</option><option value="unread">Unread</option></select></div><div className="flex-1 space-y-2 overflow-y-auto p-3 pr-2">{sortedRecords.map((record) => <button type="button" key={record.key} onClick={() => setSelectedKey(record.key)} aria-pressed={selected?.key === record.key} className={`w-full border-l-4 p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-teal-300 ${record.severity === "critical" ? "border-red-500 bg-red-500/10 hover:bg-red-500/15" : record.severity === "warning" ? "border-amber-400 bg-amber-300/10 hover:bg-amber-300/15" : "border-teal-300 bg-white/5 hover:bg-white/10"} ${selected?.key === record.key ? "ring-1 ring-teal-300" : ""}`}><div className="flex items-start justify-between gap-3"><span className="text-xs font-medium text-slate-300">{formatAge(record.receivedAt)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${record.severity === "critical" ? "bg-red-500 text-white" : record.severity === "warning" ? "bg-amber-300 text-slate-950" : "bg-teal-300 text-slate-950"}`}>{record.source === "sos" ? "SOS" : "ALERT"}</span></div><strong className="mt-3 block text-sm text-white">{record.title}</strong><p className="mb-0 mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{record.description}</p><span className="mt-3 block text-[11px] text-slate-400">◎ {record.locationLabel}</span></button>)}{!sortedRecords.length && <div className="p-6 text-center text-sm text-slate-400">No incoming alerts match this filter.</div>}</div></aside>
      <section className="min-h-[54vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command backdrop-blur-xl lg:min-h-[calc(100vh-132px)]">{selected ? <div className="flex h-full flex-col"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-5"><div><p className="m-0 text-[10px] font-bold tracking-[0.22em] text-teal-300">{selected.source === "sos" ? "INCOMING SOS" : "VERIFIED EXTERNAL ALERT"}</p><h2 className="m-0 mt-1 break-all text-2xl font-bold text-white sm:text-3xl">{selected.id}</h2><p className="mb-0 mt-2 text-sm text-slate-300">{selected.title} · {selected.locationLabel}</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide ${selected.sos?.status === "received" ? "border-red-400/60 bg-red-500/15 text-red-200" : "border-teal-300/40 bg-teal-300/10 text-teal-200"}`}>[{triageStatus(selected)}]</span></div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><div className="space-y-4"><details className="rounded-xl border border-white/10 bg-slate-950/60 p-4" open><summary className="cursor-pointer text-sm font-semibold text-white">Codec decoder <span className="ml-2 text-xs font-normal text-slate-400">Raw payload → operational fields</span></summary><pre className="mt-3 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5 text-teal-100">{selected.sos ? `CR-SOS|${selected.sos.id}|${selected.sos.emergency_type}|${selected.sos.severity}|${selected.sos.location.latitude.toFixed(6)},${selected.sos.location.longitude.toFixed(6)}|${selected.sos.channel}` : `LGU-ALERT|${selected.alert?.source_name}|${selected.alert?.source_event_id}|${selected.alert?.severity}|${selected.alert?.hazard || "general"}`}</pre><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><div><dt className="text-slate-500">Urgency</dt><dd className="m-0 mt-1 font-semibold capitalize text-white">{selected.severity}</dd></div><div><dt className="text-slate-500">State</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.sos?.emergency_type || selected.alert?.hazard || "External warning"}</dd></div><div><dt className="text-slate-500">Ingress</dt><dd className="m-0 mt-1 font-semibold text-white">{selected.channel || selected.alert?.source_name || "API"}</dd></div></dl></details><section className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="m-0 text-sm font-semibold text-white">LGU verification checklist</h3><p className="mb-0 mt-1 text-xs text-slate-400">Checklist updates are recorded in the operations audit trail.</p></div><span className="text-xs text-teal-200">{Object.values(checks).filter(Boolean).length}/{triageChecklist.length}</span></div><div className="mt-4 space-y-2">{triageChecklist.map((item) => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[.03] px-3 py-3"><span className="text-sm text-slate-200">{item.label}</span><button type="button" role="switch" aria-checked={!!checks[item.key]} onClick={() => toggleCheck(item)} className={`relative h-6 w-11 rounded-full transition ${checks[item.key] ? "bg-teal-300" : "bg-slate-700"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checks[item.key] ? "left-6" : "left-1"}`} /></button></label>)}</div>{selected.sos?.status === "received" && <button type="button" disabled={!verificationComplete} onClick={() => void acknowledge()} className="mt-4 w-full rounded-lg bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Verify and acknowledge SOS</button>}</section></div>
          <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.2em] text-amber-300">WMCDA DISPATCH RECOMMENDATIONS</p><h3 className="m-0 mt-1 text-lg font-semibold text-white">Ranked response groups</h3></div>{loadingRecommendation && <span className="text-xs text-slate-400">Ranking…</span>}</div>{selected.source === "alert" ? <div className="mt-5 rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">A field location is required before ranking a response group for this external alert.</div> : recommendationError ? <div className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{recommendationError}</div> : recommendation ? <div className="mt-5 space-y-3">{recommendation.recommendations.slice(0, 3).map((item, index) => <article key={item.group_id} className={`rounded-xl border p-4 ${index === 0 ? "border-teal-300/70 bg-teal-300/10" : "border-white/10 bg-white/[.03]"}`}><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold tracking-[0.18em] text-slate-400">RANK {item.rank}</span><h4 className="m-0 mt-1 text-sm font-semibold text-white">{item.group_name}</h4></div><span className="rounded bg-slate-950 px-2 py-1 text-xs font-bold text-teal-200">{item.score}/100</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300"><span>Readiness score {item.score}</span><span>ETA {item.estimated_response_minutes ?? "—"} min</span><span>Freshness {item.freshness_minutes} min</span></div><p className="mb-0 mt-3 text-xs leading-5 text-slate-400">{item.reasons[0] || "Ranked by operational readiness, specialty, distance, and constraints."}</p>{index === 0 && <button type="button" disabled={!verificationComplete || deploying || item.eligibility === "ineligible"} onClick={() => void deployTopRecommendation()} className="mt-4 w-full rounded-lg bg-orange-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{deploying ? "Deploying…" : "Deploy"}</button>}</article>)}<p className="mb-0 text-xs text-slate-500">Recommendations are advisory. Deployment does not clear routes or override responder-safety holds.</p></div> : <div className="mt-5 rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">Select an SOS record to request the top three eligible response-group rankings.</div>}{actionStatus && <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm text-teal-100" role="status">{actionStatus}</div>}</section></div></div> : <div className="grid h-full place-items-center p-8 text-center text-slate-400">Select an incoming SOS or alert to begin verification.</div>}</section>
    </section>
  </main></div>;
}
