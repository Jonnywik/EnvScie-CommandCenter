import { useEffect, useMemo, useState } from "react";
import {
  type DispatchLifecycleSnapshot,
  type IncidentRecord,
  type AssignmentNotification,
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
    ...records.map((record) => ({ id: `verification-${record.id}`, at: record.recorded_at, label: verificationLabels[record.category], detail: `${record.source_role} via ${record.contact_method}: ${record.note}`, kind: "verification" })),
    ...(lifecycle?.assignments.flatMap((assignment) => assignment.events.map((event) => ({ id: `dispatch-${event.id}`, at: event.occurred_at, label: `Dispatch ${event.to_status.replaceAll("_", " ")}`, detail: event.note || `Assignment ${assignment.assignment_id.slice(0, 8)} lifecycle event.`, kind: "dispatch" }))) || []),
    ...(commandRecord?.events.map((event) => ({ id: `incident-${event.id}`, at: event.occurred_at, label: `Command record ${event.to_status.replaceAll("_", " ")}`, detail: event.note || "Human incident-record transition.", kind: "incident" })) || []),
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
    try {
      const [verificationResult, notificationResult, groupsResult] = await Promise.allSettled([getSosVerificationRecords(incident.id), getNotifications(), getResponseGroups()]);
      if (verificationResult.status === "fulfilled") setRecords(verificationResult.value.records);
      else throw verificationResult.reason;
      if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value.notifications.filter((item) => item.target_type === "sos_request" && item.target_id === incident.id));
      if (groupsResult.status === "fulfilled" && activeAssignment) setAssignedGroup(groupsResult.value.groups.find((group) => group.id === activeAssignment.group_id) || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification evidence could not be loaded.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [incident.id]);

  const submit = async () => {
    if (sourceRole.trim().length < 2 || contactMethod.trim().length < 2 || note.trim().length < 5) return;
    setSaving(true); setMessage(null);
    try {
      await createSosVerificationRecord(incident.id, { category, source_role: sourceRole.trim(), contact_method: contactMethod.trim(), note: note.trim(), reference_number: referenceNumber.trim() || undefined });
      setSourceRole(""); setContactMethod(""); setNote(""); setReferenceNumber("");
      setMessage("Verification input recorded. It remains a reported human input and does not change SOS, dispatch, or safety status.");
      await load(); onRecorded?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification input could not be recorded.");
    } finally { setSaving(false); }
  };

  return <section className="drawer-section incident-workboard" aria-label="Incident workboard">
    <div className="drawer-label">Incident workboard</div>
    <div className="drawer-note">Required next actions are workflow prompts. They do not acknowledge, dispatch, resolve, or prove the validity of a report.</div>
    <div className="mt-3 grid gap-2">{nextActions.map((action, index) => <div key={action} className="rounded-lg border border-teal-300/20 bg-teal-300/5 px-3 py-2 text-xs text-slate-700"><strong>{String(index + 1).padStart(2, "0")}</strong> · {action}</div>)}</div>
    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"><div><strong>Follow-up owner:</strong> {commandRecord?.follow_up_owner || "Not assigned"}</div><div><strong>Next review:</strong> {commandRecord?.follow_up_due_at ? new Date(commandRecord.follow_up_due_at).toLocaleString() : "Not scheduled"}</div><div><strong>Decision inputs:</strong> SOS report {formatAge(incident.received_at)} · {records.length} recorded verification input{records.length === 1 ? "" : "s"}</div></div>
    {activeAssignment && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700"><strong>Assigned-team data:</strong> {assignedGroup ? <>location {formatAge(assignedGroup.last_location_at)} · check-in {formatAge(assignedGroup.last_check_in_at)} · reported {assignedGroup.status.replaceAll("_", " ")}</> : "Team freshness was not returned; refresh and contact the unit before relying on a planning estimate."}<span className="mt-1 block text-slate-500">A reported location or check-in does not establish field safety, access, or route clearance.</span></div>}
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700"><strong>Communications context</strong>{notifications.length ? <ul className="mb-0 mt-2 space-y-1 pl-4">{notifications.map((notification) => <li key={notification.id}>{notification.recipient_label} · {notification.channel.toUpperCase()} · technical status {notification.status.replaceAll("_", " ")} · {formatAge(notification.created_at)}</li>)}</ul> : <p className="mb-0 mt-1 text-slate-500">No assignment-notification record is linked to this SOS.</p>}<span className="mt-2 block text-slate-500">Technical delivery and notification acknowledgement remain distinct from reported responder task acknowledgement.</span></div>
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700"><strong>Shift handover brief</strong><p className="mb-2 mt-1 text-slate-500">Copy the current reported context for the next duty officer. This action does not transfer authority or confirm acceptance.</p><button type="button" className="tiny-button" onClick={() => void navigator.clipboard?.writeText(handoverBrief).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }).catch(() => setMessage("Copy is unavailable in this browser. Review the visible handover brief instead."))}>{copied ? "Copied" : "Copy incident handover"}</button></div>
    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-teal-800">Record reported verification input</summary><div className="mt-3 grid gap-2"><select aria-label="Verification input category" value={category} onChange={(event) => setCategory(event.target.value as SosVerificationCategory)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="location_callback">Location callback</option><option value="barangay_contact">Barangay contact</option><option value="field_report">Field report</option><option value="official_source">Official source</option><option value="other">Other reported input</option></select><input aria-label="Verification source role" value={sourceRole} onChange={(event) => setSourceRole(event.target.value)} maxLength={120} placeholder="Source or contact role, for example barangay focal person" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input aria-label="Verification contact method" value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} maxLength={80} placeholder="Contact method, for example radio relay or callback" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input aria-label="Verification reference number" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={160} placeholder="Optional reference or log number" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><textarea aria-label="Verification note" value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000} placeholder="Record the reported basis and any limit of this input" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="button" className="tiny-button" disabled={saving || sourceRole.trim().length < 2 || contactMethod.trim().length < 2 || note.trim().length < 5} onClick={() => void submit()}>{saving ? "Recording…" : "Record verification input"}</button></div></details>
    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-teal-800">Evidence and lifecycle timeline</summary>{loading ? <p className="mb-0 mt-3 text-xs text-slate-500">Loading reported evidence…</p> : <ol className="mb-0 mt-3 space-y-2 border-l border-slate-200 pl-3">{timeline.length ? timeline.map((item) => <li key={item.id} className="relative text-xs text-slate-600"><span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white" /><strong className="block text-slate-800">{item.label}</strong><span>{formatAge(item.at)} · {item.detail}</span></li>) : <li className="text-xs text-slate-500">No reported verification, dispatch, or command-record events are available for this selected SOS.</li>}</ol>}</details>
    {message && <div className="inline-status mt-3" role="status">{message}</div>}
  </section>;
}
