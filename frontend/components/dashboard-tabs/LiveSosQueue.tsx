import { useMemo, useState } from "react";
import type { SosIncident } from "../../lib/api";
import type { OperationalAction } from "./contracts";

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

function severityClass(value: string) {
  return ["critical", "received", "high", "active"].includes(value) ? "critical" : ["warning", "acknowledged", "medium", "monitoring", "low"].includes(value) ? "warning" : "advisory";
}

const severityRank: Record<SosIncident["severity"], number> = { critical: 0, warning: 1, advisory: 2 };
type QueueSort = "priority" | "oldest" | "newest" | "uncertain" | "awaiting_verification";

function queueFlag(incident: SosIncident) {
  if (incident.status === "received") return "awaiting verification";
  if ((incident.location.accuracy_meters ?? 0) > 100) return "location uncertain";
  if (incident.status === "acknowledged") return "dispatch review";
  if (incident.status === "dispatched") return "field update required";
  return "closed record";
}

export function LiveSosQueue({ incidents, onSelect, onAction }: { incidents: SosIncident[]; onSelect: (incident: SosIncident) => void; onAction: OperationalAction }) {
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<QueueSort>("priority");
  const [includeClosed, setIncludeClosed] = useState(false);
  const activeFilters = [
    status !== "all" ? `Status: ${status.replaceAll("_", " ")}` : null,
    channel !== "all" ? `Channel: ${channel}` : null,
    query.trim() ? `Search: ${query.trim()}` : null,
    includeClosed ? "Closed included" : null,
    sort !== "priority" ? `Sort: ${sort.replaceAll("_", " ")}` : null,
  ].filter(Boolean) as string[];
  const filtered = useMemo(() => {
    const rows = incidents.filter((item) => {
      const matchesText = `${item.emergency_type} ${item.barangay} ${item.summary}`.toLowerCase().includes(query.toLowerCase());
      const closed = ["resolved", "false_alarm"].includes(item.status);
      return (includeClosed || !closed) && (status === "all" || item.status === status) && (channel === "all" || item.channel === channel) && matchesText;
    });
    return rows.sort((left, right) => {
      const leftTime = new Date(left.received_at).getTime();
      const rightTime = new Date(right.received_at).getTime();
      if (sort === "oldest") return leftTime - rightTime;
      if (sort === "newest") return rightTime - leftTime;
      if (sort === "uncertain") return (right.location.accuracy_meters ?? 0) - (left.location.accuracy_meters ?? 0) || leftTime - rightTime;
      if (sort === "awaiting_verification") return Number(left.status !== "received") - Number(right.status !== "received") || severityRank[left.severity] - severityRank[right.severity] || leftTime - rightTime;
      return severityRank[left.severity] - severityRank[right.severity] || Number(left.status !== "received") - Number(right.status !== "received") || leftTime - rightTime;
    });
  }, [channel, includeClosed, incidents, query, sort, status]);
  const clearFilters = () => { setStatus("all"); setChannel("all"); setQuery(""); setSort("priority"); setIncludeClosed(false); };

  return <>
    <div className="subtab-intro"><div><div className="eyebrow">Life-safety operations</div><h2>Live SOS coordination</h2><p>Every request stays visible from receipt through acknowledgement, dispatch, resolution, or false-alarm closure. Queue flags identify where human review is still needed; they do not verify field conditions or task a team.</p></div><div className="readout-block"><strong>{filtered.length}</strong><span>records in view</span></div></div>
    <div className="control-strip live-sos-controls"><input aria-label="Search SOS" placeholder="Search barangay, type, or message" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter SOS status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All active statuses</option><option value="received">Received</option><option value="acknowledged">Acknowledged</option><option value="dispatched">Dispatched</option><option value="resolved">Resolved</option><option value="false_alarm">False alarm</option></select><select aria-label="Filter SOS channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option><option value="sms">SMS fallback</option><option value="internet">Internet</option><option value="mesh">Mesh</option><option value="manual">Manual</option></select><select aria-label="Sort SOS queue" value={sort} onChange={(event) => setSort(event.target.value as QueueSort)}><option value="priority">Priority: severity, verification, age</option><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="uncertain">Highest location uncertainty</option><option value="awaiting_verification">Awaiting verification</option></select><label className="queue-toggle"><input type="checkbox" checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} /> Include closed</label>{activeFilters.length > 0 && <button className="tiny-button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
    {activeFilters.length > 0 && <div className="active-filter-chips" aria-label="Active SOS queue filters">{activeFilters.map((filter) => <span key={filter}>{filter}</span>)}</div>}
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Triage queue</div><div className="panel-subtitle">Open a record to review location confidence, dispatch lifecycle, and valid next actions</div></div><span className="panel-link">{incidents.filter((item) => item.status === "received").length} awaiting acknowledgement</span></div><div className="sos-table"><div className="sos-table-head"><span>Incident</span><span>Channel / age</span><span>Location</span><span>State</span><span /></div>{filtered.map((incident) => <button className="sos-table-row" key={incident.id} onClick={() => onSelect(incident)}><span><strong>{incident.emergency_type} · {incident.barangay}</strong><small>{incident.summary}</small><small className="mobile-triage-meta">{incident.channel.toUpperCase()} · {formatAge(incident.received_at)} · ±{incident.location.accuracy_meters ?? "?"}m</small><em className={`queue-flag ${incident.status === "received" ? "critical" : ""}`}>{queueFlag(incident)}</em></span><span><strong>{incident.channel.toUpperCase()}</strong><small>{formatAge(incident.received_at)}</small></span><span><strong>±{incident.location.accuracy_meters ?? "?"}m</strong><small>{incident.location.latitude.toFixed(3)}, {incident.location.longitude.toFixed(3)}</small></span><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span><span className="chevron">›</span></button>)}{filtered.length === 0 && <div className="empty-state"><strong>No SOS records match the current filters.</strong><span className="mt-1 block">Widen the query or clear the active filters to return to the operational queue.</span>{activeFilters.length > 0 && <button type="button" className="tiny-button mt-3" onClick={clearFilters}>Clear all filters</button>}</div>}</div></section>
    <section className="operations-grid three-columns compact"><div className="callout critical-callout"><strong>Dispatch rule</strong><span>Do not send a team until the route has been checked against active constraints and the responder channel has reported acknowledgement.</span></div><div className="callout"><strong>SMS fallback</strong><span>SMS records may have delayed timestamps and larger location uncertainty. Confirm by callback or barangay focal point when safe.</span></div><div className="callout"><strong>Shift handover</strong><button className="tiny-button" type="button" onClick={() => onAction("sos.handover_reviewed", "sos_queue", undefined, "Reviewed live SOS queue for shift handover.")}>Record queue review</button></div></section>
  </>;
}
