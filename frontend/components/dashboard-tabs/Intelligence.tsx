"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type AlertItem, type AuditEvent, type Center, type DashboardSummary, type FeedHealth, type NotificationSnapshot, type ResponderSafetyAssessment, type ResponseGroupSnapshot, type SosIncident, type SosStatus, assessResponderSafety, getAuditEvents, updateSosStatus } from "../../lib/api";
import { AppearanceToggle, type AppearanceMode } from "./AppearanceToggle";
import { CommandCenterNavigation } from "./CommandCenterNavigation";
import type { CommandCenterTab, OperationalAction } from "./contracts";

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
function formatTime(timestamp?: string | null) { return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not yet sent"; }
function severityClass(value: string) { return ["critical", "received", "high", "active"].includes(value) ? "critical" : ["warning", "acknowledged", "medium", "monitoring", "low"].includes(value) ? "warning" : "advisory"; }
function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="panel-header"><div><div className="panel-title">{title}</div><div className="panel-subtitle">{subtitle}</div></div>{action}</div>; }
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

export function IntelligenceDashboardView({ health, connection, summary, appearance, onAppearanceChange, onAction, onReturn, onNavigate }: { health: FeedHealth[]; connection: "live" | "cached"; summary: DashboardSummary; appearance: AppearanceMode; onAppearanceChange: () => void; onAction: OperationalAction; onReturn: () => void; onNavigate: (tab: CommandCenterTab) => void }) {
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

  return <div className="workspace-navigation-shell"><CommandCenterNavigation activeTab="DRRMO Intelligence" onNavigate={onNavigate} /><main className="min-h-screen bg-slate-950 p-3 font-sans text-slate-100 sm:p-5" aria-label="DRRMO Intelligence Audit and Analytics dashboard">
    <header className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-teal-300">COMMAND CENTER · POST-INCIDENT REVIEW AND ACCOUNTABILITY</p><h1 className="m-0 text-xl font-semibold tracking-tight text-white sm:text-2xl">DRRMO Intelligence <span className="font-normal text-slate-400">/ Audit & Analytics</span></h1></div><div className="flex items-center gap-2"><AppearanceToggle appearance={appearance} onAppearanceChange={onAppearanceChange} className="workspace-appearance-toggle" /><button type="button" onClick={onReturn} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10">← Command Map</button></div></header>
    <section className="mx-auto grid max-w-[1800px] gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="System health and analytics grid">{cards.map((card) => <article key={card.label} className="rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-command"><div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-slate-400">{card.label.toUpperCase()}</p><strong className="mt-2 block text-sm text-white">{card.detail}</strong></div><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${card.state === "green" ? "bg-emerald-400" : card.state === "red" ? "bg-red-500" : "bg-amber-300"}`} aria-label={`${card.label}: ${card.state}`} /></div><div className="mt-4 flex h-8 items-end gap-1" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} className={`flex-1 rounded-t-sm ${card.state === "green" ? "bg-emerald-400/70" : card.state === "red" ? "bg-red-500/70" : "bg-amber-300/70"}`} style={{ height: `${28 + ((index * 17 + card.label.length * 3) % 64)}%` }} />)}</div><p className="mb-0 mt-3 text-[11px] leading-4 text-slate-400">{card.note}</p></article>)}</section>
    <section className="mx-auto grid max-w-[1800px] gap-4 lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]" aria-label="Audit ledger and LGU report hub">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-command"><div className="border-b border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">IMMUTABLE ACTION LEDGER</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Chronological accountability timeline</h2><p className="mb-0 mt-1 text-xs text-slate-400">Read-only audit records. Filters change this view only; they never alter the ledger.</p></div><button type="button" onClick={() => void refreshLedger()} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Refresh ledger</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><select aria-label="Audit ledger date range" value={range} onChange={(event) => setRange(event.target.value as typeof range)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="24h">Past 24 hours</option><option value="7d">Past 7 days</option><option value="all">All loaded records</option></select><select aria-label="Audit ledger operator filter" value={operator} onChange={(event) => setOperator(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="all">All operators / roles</option>{operators.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Audit ledger action filter" value={actionType} onChange={(event) => setActionType(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="all">All action types</option><option value="alerts">SOS & alerts</option><option value="fleet">Fleet actions</option><option value="feeds">Feed actions</option><option value="system">System actions</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/10 bg-slate-950/70 text-[10px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-4 py-3">Timestamp (PST)</th><th className="px-3 py-3">Operator / role</th><th className="px-3 py-3">Action taken</th><th className="px-3 py-3">Incident reference</th><th className="px-4 py-3">Authorization</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading protected audit records…</td></tr> : ledgerError ? <tr><td colSpan={5} className="px-4 py-10 text-center text-red-200">{ledgerError}</td></tr> : visibleEvents.map((event) => <tr key={event.id} className="border-b border-white/[.07] bg-white/[.015] align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatPst(event.created_at)}</td><td className="px-3 py-3"><strong className="block font-medium text-white">{event.actor_user_id || event.actor_role || "system"}</strong><span className="text-slate-500">{event.actor_role || "system"}</span></td><td className="px-3 py-3"><code className="rounded bg-slate-950 px-1.5 py-1 text-[11px] text-teal-100">{event.action}</code></td><td className="px-3 py-3 text-slate-300">{event.resource_id || "—"}</td><td className="px-4 py-3"><span className="rounded-full border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">{event.actor_role || "system"}</span></td></tr>)}{!loading && !ledgerError && !visibleEvents.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No immutable audit events match the selected query.</td></tr>}</tbody></table></div>{filteredEvents.length > visibleEvents.length && <p className="m-0 border-t border-white/10 px-4 py-3 text-xs text-amber-200">Rendering is capped at the first 150 matching records for a responsive operator view. Narrow the query before exporting a focused review.</p>}</section>
      <aside className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-command"><p className="m-0 text-[10px] font-bold tracking-[0.18em] text-teal-300">AUTOMATED LGU REPORTING</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Compile accountable working records</h2><p className="mb-0 mt-2 text-sm leading-5 text-slate-400">Choose a local working format, then export the filtered immutable ledger for DRRMO review. These templates are not signed official forms and require local approval.</p><label className="mt-5 block text-xs font-semibold text-slate-300">Report template<select aria-label="LGU report template" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-100">{intelligenceTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><article className="mt-3 rounded-xl border border-teal-300/20 bg-teal-300/[.06] p-3"><strong className="text-sm text-teal-100">{selectedTemplate.name}</strong><p className="mb-0 mt-1 text-xs leading-5 text-slate-300">{selectedTemplate.subtitle}</p></article><div className="mt-5 grid gap-2"><button type="button" disabled={!visibleEvents.length || Boolean(exportBusy)} onClick={() => void compileExport("pdf")} className="rounded-lg bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{exportBusy === "pdf" ? "Compiling…" : "Prepare PDF report"}</button><button type="button" disabled={!visibleEvents.length || Boolean(exportBusy)} onClick={() => void compileExport("csv")} className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500">{exportBusy === "csv" ? "Compiling…" : "Download filtered CSV"}</button></div>{exportStatus && <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs leading-5 text-slate-300" role="status">{exportStatus}</div>}<div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400"><strong className="text-slate-200">Performance and compliance boundary</strong><p className="mb-0 mt-1">The dashboard fetches a bounded audit page, derives filters in memory, and renders a bounded working view to keep dense logs responsive. The authoritative ledger remains backend-controlled and uneditable in this interface.</p></div></aside>
    </section>
  </main></div>;
}

export function TriageDrawer({ incident, onClose, onUpdated, onAction }: { incident: SosIncident; onClose: () => void; onUpdated: (incident: SosIncident) => void; onAction: OperationalAction }) {
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
  return <div className="drawer-backdrop" role="presentation" onClick={onClose}><aside className="drawer" role="dialog" aria-label="SOS triage details" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">Incoming SOS · {incident.channel.toUpperCase()}</div><h2>{incident.emergency_type}</h2><p className="panel-subtitle">{incident.barangay} · received {formatAge(incident.received_at)}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="drawer-body"><section className="drawer-section incident-response-packet" aria-label="Incident response packet"><div className="drawer-label">Incident response packet</div><div className="incident-packet-grid"><span><b>{incident.status.replace("_", " ")}</b> current state</span><span><b>{formatAge(incident.received_at)}</b> report age</span><span><b>±{incident.location.accuracy_meters ?? "unknown"} m</b> location confidence</span><span><b>{incident.channel.toUpperCase()}</b> reported channel</span></div><div className="drawer-note">Current report, location, and status are shown together for review. Verification, hazard review, responder tasking, route checks, and public communication remain separate human decisions.</div></section><div className="drawer-section"><div className="drawer-label">Current status</div><div className="drawer-value"><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span></div></div><div className="drawer-section"><div className="drawer-label">Incident summary</div><div className="drawer-value">{incident.summary}</div><div className="drawer-note">Received through {incident.channel.toUpperCase()}. Location confidence is ±{incident.location.accuracy_meters ?? "unknown"} meters.</div></div><div className="drawer-section"><div className="drawer-label">Coordinates and routing guardrail</div><div className="drawer-value">{incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}</div><div className="drawer-note">Dispatch routing must avoid active flood polygons. Confirm the route again immediately before departure.</div></div><div className="drawer-section responder-safety-section"><div className="drawer-label">Responder-safety assessment</div><div className="drawer-note">For verified / acknowledged SOS only. Scores identify exposure and controls; they never create a dispatch, clear a route, or authorize entry.</div>{assessmentEligible ? <button className="secondary-button" disabled={assessing} onClick={() => void runSafetyAssessment()}>{assessing ? "Assessing responder risk…" : "Assess responder safety"}</button> : <div className="inline-status">Acknowledge and verify this SOS before assessing responder exposure.</div>}{safetyAssessment && <div className="responder-safety-result"><div className="assessment-summary"><div><strong>Assessment {safetyAssessment.assessment_id.slice(-8)}</strong><span>{formatTime(safetyAssessment.generated_at)} · {safetyAssessment.active_hazard_count} active map hazard record(s)</span></div><span className="badge advisory">review only</span></div>{safetyAssessment.assessments.map((candidate) => <article className="safety-candidate" key={candidate.group_id}><div className="safety-candidate-head"><div><strong>{candidate.group_name}</strong><span>{candidate.call_sign || "Call sign unlisted"} · {candidate.distance_meters.toLocaleString()} m away · readiness {candidate.readiness_score}/100</span></div><span className={`badge ${severityClass(candidate.risk_band === "severe" ? "critical" : candidate.risk_band)}`}>{candidate.risk_band} · {candidate.risk_score}/100</span></div><div className="safety-meta"><span>Location {candidate.location_age_minutes} min old</span><span>Check-in {candidate.check_in_age_minutes} min old</span><span>{candidate.availability}</span></div>{candidate.hold_reasons.length > 0 && <div className="safety-holds"><strong>Hold before tasking</strong><ul>{candidate.hold_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<details className="safety-details"><summary>Risk factors and protective controls</summary><ul>{candidate.factors.map((factor) => <li key={factor.factor}><strong>{factor.factor.replaceAll("_", " ")}: {factor.points >= 0 ? "+" : ""}{factor.points}</strong> — {factor.detail}</li>)}</ul><strong>Field-team execution</strong><ul>{candidate.field_execution_tasks.map((task) => <li key={task}>{task}</li>)}</ul><strong>Protective controls before departure</strong><ul>{candidate.protective_controls.map((control) => <li key={control}>{control}</li>)}</ul></details></article>)}<div className="safety-command-tasks"><strong>Command Center execution</strong><ol>{safetyAssessment.command_center_tasks.map((task) => <li key={task}>{task}</li>)}</ol></div><div className="safety-limit"><strong>Decision limit</strong><span>{safetyAssessment.decision_limits[0]}</span></div></div>}</div><div className="drawer-section"><div className="drawer-label">Triage actions</div><div className="triage-actions">{actions.map((action) => <button key={action.status} className={action.className} disabled={saving} onClick={() => void transition(action.status)}>{action.label}</button>)}{actions.length === 0 && <div className="empty-state">This record is closed. Review the audit trail for the last handover.</div>}</div>{error && <div className="inline-status error-status" role="alert">{error}</div>}</div></div></aside></div>;
}

export function CommandReadinessBoard({ incidents, centers, health, groups, notifications }: { incidents: SosIncident[]; centers: Center[]; health: FeedHealth[]; groups: ResponseGroupSnapshot; notifications: NotificationSnapshot }) {
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

export function OverviewQuickActions({ incidents, alerts, centers, groups, onNavigate }: { incidents: SosIncident[]; alerts: AlertItem[]; centers: Center[]; groups: ResponseGroupSnapshot; onNavigate: (tab: CommandCenterTab) => void }) {
  const staleTeams = groups.groups.filter((group) => Date.now() - new Date(group.last_location_at).getTime() > 15 * 60 * 1000 || Date.now() - new Date(group.last_check_in_at).getTime() > 15 * 60 * 1000).length;
  const constrainedCenters = centers.filter((center) => center.status !== "open" || center.occupancy_current / Math.max(center.capacity_total, 1) >= 0.9).length;
  const actions: Array<{ tab: CommandCenterTab; icon: string; label: string; value: number; note: string; state: string }> = [
    { tab: "Live SOS", icon: "!", label: "SOS queue", value: incidents.filter((item) => item.status !== "resolved" && item.status !== "false_alarm").length, note: "Open triage", state: "critical" },
    { tab: "Verified Alerts", icon: "◈", label: "Active alerts", value: alerts.filter((alert) => !alert.expires_at || new Date(alert.expires_at).getTime() > Date.now()).length, note: "Review warnings", state: "warning" },
    { tab: "Evacuation Centers", icon: "⌂", label: "Center limits", value: constrainedCenters, note: "Capacity status", state: constrainedCenters ? "warning" : "good" },
    { tab: "Response Groups", icon: "◎", label: "Team updates", value: staleTeams, note: "Refresh roster", state: staleTeams ? "warning" : "good" },
  ];
  return <section className="panel overview-quick-actions"><PanelHeader title="Quick access" subtitle="Open the operational workspace" /><div className="quick-actions-grid">{actions.map((action) => <button className={`quick-action ${action.state}`} key={action.label} onClick={() => onNavigate(action.tab)}><span className="quick-action-icon">{action.icon}</span><span><strong>{action.label}</strong><small>{action.note}</small></span><b>{action.value}</b></button>)}</div></section>;
}
