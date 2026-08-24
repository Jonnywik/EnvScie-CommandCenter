import { useEffect, useMemo, useState } from "react";
import {
  type AssignmentNotification,
  type DispatchLifecycleSnapshot,
  type IncidentRecord,
  type ResponseGroup,
  type SosIncident,
  type SosVerificationCategory,
  type SosVerificationRecord,
  createSosVerificationRecord,
  getNotifications,
  getResponseGroups,
  getSosVerificationRecords,
} from "../../lib/api";

function formatAge(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes === 1 ? "1 min ago" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;
}

const verificationLabels: Record<SosVerificationCategory, string> = {
  location_callback: "Location callback",
  barangay_contact: "Barangay contact",
  field_report: "Field report",
  official_source: "Official source",
  other: "Other reported input",
};

export function IncidentWorkboard({ incident, lifecycle, commandRecord, onRecorded }: {
  incident: SosIncident;
  lifecycle: DispatchLifecycleSnapshot | null;
  commandRecord: IncidentRecord | null;
  onRecorded?: () => void;
}) {
  const [records, setRecords] = useState<SosVerificationRecord[]>([]);
  const [notifications, setNotifications] = useState<AssignmentNotification[]>([]);
  const [assignedGroup, setAssignedGroup] = useState<ResponseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<SosVerificationCategory>("location_callback");
  const [sourceRole, setSourceRole] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [note, setNote] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const activeAssignment = lifecycle?.assignments.find((assignment) => !["cancelled", "closed"].includes(assignment.status)) || null;
  const nextActions = [
    records.length === 0 ? "Record the reported basis for location or incident verification." : null,
    incident.status === "received" ? "Complete human verification before acknowledging this SOS." : null,
    incident.status === "acknowledged" && !activeAssignment ? "Review team freshness, route constraints, and a human-confirmed dispatch proposal." : null,
    activeAssignment ? `Review the active dispatch lifecycle: ${activeAssignment.status.replaceAll("_", " ")}.` : null,
    commandRecord && (!commandRecord.follow_up_owner || !commandRecord.follow_up_due_at) ? "Assign the Incident Command Record follow-up owner and due date before closure review." : null,
    !commandRecord ? "Consider creating an Incident Command Record when the coordinator needs durable follow-up and handover ownership." : null,
  ].filter(Boolean) as string[];
  const timeline = useMemo(() => [
    ...records.map((record) => ({ id: `verification-${record.id}`, at: record.recorded_at, label: verificationLabels[record.category], detail: `${record.source_role} via ${record.contact_method}: ${record.note}` })),
    ...(lifecycle?.assignments.flatMap((assignment) => assignment.events.map((event) => ({ id: `dispatch-${event.id}`, at: event.occurred_at, label: `Dispatch ${event.to_status.replaceAll("_", " ")}`, detail: event.note || `Assignment ${assignment.assignment_id.slice(0, 8)} lifecycle event.` }))) || []),
    ...(commandRecord?.events.map((event) => ({ id: `incident-${event.id}`, at: event.occurred_at, label: `Command record ${event.to_status.replaceAll("_", " ")}`, detail: event.note || "Human incident-record transition." })) || []),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).slice(0, 12), [commandRecord?.events, lifecycle?.assignments, records]);
  const handoverBrief = [
    `SOS ${incident.id.slice(0, 8)} · ${incident.severity.toUpperCase()} ${incident.emergency_type} · ${incident.barangay}`,
    `State: ${incident.status.replaceAll("_", " ")} · ${incident.channel.toUpperCase()} · report ${formatAge(incident.received_at)} · location ±${incident.location.accuracy_meters ?? "unknown"} m.`,
    `Open work: ${nextActions.join(" ") || "Review the incident timeline and confirm no new work is required."}`,
    `Dispatch lifecycle: ${activeAssignment ? activeAssignment.status.replaceAll("_", " ") : "none returned"}. Follow-up owner: ${commandRecord?.follow_up_owner || "unassigned"}.`,
    "Handover preserves reported context only. Re-verify conditions, responder acknowledgement, route constraints, and authority before acting.",
  ].join("\n");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setRecords([]);
    setNotifications([]);
    setAssignedGroup(null);
    try {
      const [verificationResult, notificationResult, groupsResult] = await Promise.allSettled([getSosVerificationRecords(incident.id), getNotifications(), getResponseGroups()]);
      if (verificationResult.status === "fulfilled") setRecords(verificationResult.value.records);
      else throw verificationResult.reason;
      if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value.notifications.filter((item) => item.target_type === "sos_request" && item.target_id === incident.id));
      if (groupsResult.status === "fulfilled" && activeAssignment) setAssignedGroup(groupsResult.value.groups.find((group) => group.id === activeAssignment.group_id) || null);
      else if (!activeAssignment) setAssignedGroup(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Verification evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [incident.id, activeAssignment?.assignment_id]);

  const submit = async () => {
    if (sourceRole.trim().length < 2 || contactMethod.trim().length < 2 || note.trim().length < 5) return;
    setSaving(true);
    setMessage(null);
    try {
      await createSosVerificationRecord(incident.id, {
        category,
        source_role: sourceRole.trim(),
        contact_method: contactMethod.trim(),
        note: note.trim(),
        reference_number: referenceNumber.trim() || undefined,
      });
      setSourceRole("");
      setContactMethod("");
      setNote("");
      setReferenceNumber("");
      setMessage("Verification input recorded. It remains a reported human input and does not change SOS, dispatch, or safety status.");
      await load();
      onRecorded?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification input could not be recorded.");
    } finally {
      setSaving(false);
    }
  };

  const copyHandover = async () => {
    if (!navigator.clipboard) {
      setMessage("Copy is unavailable in this browser. Review the visible handover brief instead.");
      return;
    }
    try {
      await navigator.clipboard.writeText(handoverBrief);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Copy is unavailable in this browser. Review the visible handover brief instead.");
    }
  };

  return <section className="drawer-section incident-workboard" aria-label="Incident workboard">
    <div className="drawer-label">Incident workboard</div>
    <div className="drawer-note">Required next actions are workflow prompts. They do not acknowledge, dispatch, resolve, or prove the validity of a report.</div>

    <div className="workboard-action-list">
      {nextActions.map((action, index) => <div key={action} className="workboard-action"><strong>{String(index + 1).padStart(2, "0")}</strong><span>{action}</span></div>)}
    </div>

    <div className="workboard-card workboard-context-card">
      <div><span>Follow-up owner</span><strong>{commandRecord?.follow_up_owner || "Not assigned"}</strong></div>
      <div><span>Next review</span><strong>{commandRecord?.follow_up_due_at ? new Date(commandRecord.follow_up_due_at).toLocaleString() : "Not scheduled"}</strong></div>
      <div className="workboard-context-wide"><span>Decision inputs</span><strong>SOS report {formatAge(incident.received_at)} · {records.length} recorded verification input{records.length === 1 ? "" : "s"}</strong></div>
    </div>

    {activeAssignment && <div className="workboard-card workboard-freshness-card"><strong>Assigned-team data</strong><p>{assignedGroup ? <>Location {formatAge(assignedGroup.last_location_at)} · check-in {formatAge(assignedGroup.last_check_in_at)} · reported {assignedGroup.status.replaceAll("_", " ")}</> : "Team freshness was not returned; refresh and contact the unit before relying on a planning estimate."}</p><span>A reported location or check-in does not establish field safety, access, or route clearance.</span></div>}

    <div className="workboard-card">
      <strong>Communications context</strong>
      {notifications.length ? <ul className="workboard-list">{notifications.map((notification) => <li key={notification.id}>{notification.recipient_label} · {notification.channel.toUpperCase()} · technical status {notification.status.replaceAll("_", " ")} · {formatAge(notification.created_at)}</li>)}</ul> : <p>No assignment-notification record is linked to this SOS.</p>}
      <span>Technical delivery and notification acknowledgement remain distinct from reported responder task acknowledgement.</span>
    </div>

    <div className="workboard-card">
      <strong>Shift handover brief</strong>
      <p>Copy the current reported context for the next duty officer. This action does not transfer authority or confirm acceptance.</p>
      <button type="button" className="tiny-button" onClick={() => void copyHandover()}>{copied ? "Copied" : "Copy incident handover"}</button>
    </div>

    <details className="workboard-disclosure">
      <summary>Record reported verification input</summary>
      <div className="workboard-form">
        <select aria-label="Verification input category" value={category} onChange={(event) => setCategory(event.target.value as SosVerificationCategory)} className="workboard-control"><option value="location_callback">Location callback</option><option value="barangay_contact">Barangay contact</option><option value="field_report">Field report</option><option value="official_source">Official source</option><option value="other">Other reported input</option></select>
        <input aria-label="Verification source role" value={sourceRole} onChange={(event) => setSourceRole(event.target.value)} maxLength={120} placeholder="Source or contact role, for example barangay focal person" className="workboard-control" />
        <input aria-label="Verification contact method" value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} maxLength={80} placeholder="Contact method, for example radio relay or callback" className="workboard-control" />
        <input aria-label="Verification reference number" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={160} placeholder="Optional reference or log number" className="workboard-control" />
        <textarea aria-label="Verification note" value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000} placeholder="Record the reported basis and any limit of this input" className="workboard-control workboard-note-input" />
        <button type="button" className="tiny-button" disabled={saving || sourceRole.trim().length < 2 || contactMethod.trim().length < 2 || note.trim().length < 5} onClick={() => void submit()}>{saving ? "Recording…" : "Record verification input"}</button>
      </div>
    </details>

    <details className="workboard-disclosure">
      <summary>Evidence and lifecycle timeline</summary>
      {loading ? <p className="workboard-empty-timeline">Loading reported evidence…</p> : <ol className="workboard-timeline">{timeline.length ? timeline.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{formatAge(item.at)} · {item.detail}</span></li>) : <li className="workboard-empty-timeline">No reported verification, dispatch, or command-record events are available for this selected SOS.</li>}</ol>}
    </details>
    {(message || loadError) && <div className="inline-status mt-3" role="status">{message || loadError}</div>}
  </section>;
}
