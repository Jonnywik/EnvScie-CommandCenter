import { useCallback, useEffect, useRef, useState } from "react";
import {
  type DispatchLifecycleSnapshot,
  type IncidentRecord,
  type RecommendationResponse,
  type ResponderSafetyAssessment,
  type ResponseGroup,
  type SosIncident,
  type SosStatus,
  assessResponderSafety,
  assignResponseGroup,
  getDispatchLifecycle,
  getDispatchRecommendations,
  getIncidents,
  getResponseGroups,
  updateSosStatus,
} from "../../lib/api";
import { focusFirst, isolateBackground, trapFocus } from "./dialogFocus";
import { DispatchTeamSelector } from "./DispatchTeamSelector";
import { IncidentWorkboard } from "./IncidentWorkboard";
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

type PendingTransition = Extract<SosStatus, "false_alarm" | "resolved"> | null;

export function TriageDrawer({ incident, onClose, onUpdated, onAction }: { incident: SosIncident; onClose: () => void; onUpdated: (incident: SosIncident) => void; onAction: OperationalAction }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dispatchTriggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  const [saving, setSaving] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [pendingTransition, setPendingTransition] = useState<PendingTransition>(null);
  const [safetyAssessment, setSafetyAssessment] = useState<ResponderSafetyAssessment | null>(null);
  const [teamSelectorOpen, setTeamSelectorOpen] = useState(false);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectingTeam, setSelectingTeam] = useState(false);
  const [dispatchTeams, setDispatchTeams] = useState<ResponseGroup[]>([]);
  const [dispatchRecommendation, setDispatchRecommendation] = useState<RecommendationResponse | null>(null);
  const [dispatchLifecycle, setDispatchLifecycle] = useState<DispatchLifecycleSnapshot | null>(null);
  const [commandRecord, setCommandRecord] = useState<IncidentRecord | null>(null);
  const assessmentEligible = incident.status === "acknowledged" || incident.status === "dispatched";
  const activeDispatch = dispatchLifecycle?.assignments.find((assignment) => !["cancelled", "closed"].includes(assignment.status)) || null;
  const closureBlockers = [
    activeDispatch ? `An active dispatch lifecycle (${activeDispatch.status.replaceAll("_", " ")}) must be reviewed separately before this SOS can be resolved.` : null,
    commandRecord && (!commandRecord.follow_up_owner || !commandRecord.follow_up_due_at) ? "The linked Incident Command Record lacks a named follow-up owner or due date." : null,
  ].filter(Boolean) as string[];
  const isBusy = saving || assessing || selectorLoading || selectingTeam;

  const refreshContext = useCallback(async () => {
    const [lifecycleResult, recordsResult] = await Promise.allSettled([getDispatchLifecycle(incident.id), getIncidents()]);
    if (lifecycleResult.status === "fulfilled") setDispatchLifecycle(lifecycleResult.value);
    if (recordsResult.status === "fulfilled") setCommandRecord(recordsResult.value.incidents.find((record) => record.linked_sos_ids.includes(incident.id)) || null);
  }, [incident.id]);

  useEffect(() => {
    const restoreBackground = isolateBackground(backdropRef.current);
    focusFirst(dialogRef.current, closeRef.current);
    void refreshContext().catch(() => setError("Some incident context could not be loaded. Recheck the lifecycle and command record before acting."));
    return () => {
      restoreBackground();
      window.requestAnimationFrame(() => returnFocusRef.current?.isConnected && returnFocusRef.current.focus());
    };
  }, [refreshContext]);

  const closeSafely = () => {
    if (isBusy) {
      setError("An incident action is still in progress. Wait for the visible result before closing this record.");
      return;
    }
    onClose();
  };

  const transition = async (status: SosStatus, note: string) => {
    setSaving(true); setError(null);
    try {
      const updated = await updateSosStatus(incident.id, status, note);
      onUpdated({ ...incident, ...updated });
      await onAction(`sos.${status}`, "sos_request", incident.id, note);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The incident state could not be updated. Keep the record open and retry.");
    } finally { setSaving(false); }
  };

  const confirmTransition = async () => {
    if (!pendingTransition || transitionReason.trim().length < 5) return;
    if (pendingTransition === "resolved" && closureBlockers.length) {
      setError(closureBlockers.join(" "));
      return;
    }
    await transition(pendingTransition, transitionReason.trim());
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

  const openDispatchSelector = async () => {
    if (incident.status !== "acknowledged" || selectorLoading) return;
    setSelectorLoading(true); setError(null);
    try {
      const lifecycle = await getDispatchLifecycle(incident.id);
      setDispatchLifecycle(lifecycle);
      const activeAssignment = lifecycle.assignments.find((assignment) => !["cancelled", "closed"].includes(assignment.status));
      if (activeAssignment) {
        setError(`Dispatch team selection is blocked because assignment ${activeAssignment.assignment_id.slice(0, 8)} is ${activeAssignment.status.replaceAll("_", " ")}. Review, confirm, or cancel the existing lifecycle record before selecting another team.`);
        return;
      }
      const requiredSpecialties = /flood|water|trapped/i.test(incident.emergency_type) ? ["water_rescue"] : incident.emergency_type === "MEDICAL" ? ["medical"] : [];
      const [groups, ranking] = await Promise.all([getResponseGroups(), getDispatchRecommendations({ incident_id: incident.id, severity: incident.severity, emergency_type: incident.emergency_type, latitude: incident.location.latitude, longitude: incident.location.longitude, required_specialties: requiredSpecialties, max_results: 3 })]);
      setDispatchTeams(groups.groups.filter((group) => group.availability !== "offline"));
      setDispatchRecommendation(ranking);
      setTeamSelectorOpen(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Response teams could not be loaded for this triage record.");
    } finally { setSelectorLoading(false); }
  };

  const selectDispatchTeam = async (team: ResponseGroup) => {
    if (team.availability !== "available" || team.status !== "ready" || selectingTeam) return;
    setSelectingTeam(true); setError(null);
    try {
      const ranked = dispatchRecommendation?.recommendations.find((item) => item.group_id === team.id);
      const proposal = await assignResponseGroup({ group_id: team.id, target_type: "sos_request", target_id: incident.id, assignment_note: `Triage Queue selection. ${ranked ? `Advisory rank ${ranked.rank}; score ${ranked.score}/100.` : "Coordinator-selected available team after review."}` });
      await onAction("triage_queue.dispatch_proposed", "sos_request", incident.id, `Triage Queue created a pending confirmation proposal for ${team.name}; no dispatch or notification was sent.`);
      setTeamSelectorOpen(false);
      await refreshContext();
      setError(`Pending confirmation created for ${team.name}. ${proposal.decision_limit}`);
    } catch (requestError) {
      await refreshContext();
      setTeamSelectorOpen(false);
      setError(requestError instanceof Error ? requestError.message : "The pending dispatch proposal could not be created.");
    } finally { setSelectingTeam(false); }
  };

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); closeSafely(); return;
    }
    trapFocus(event.nativeEvent, dialogRef.current);
  };

  return <div ref={backdropRef} className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSafely(); }}>
    <aside ref={dialogRef} className="drawer" role="dialog" aria-modal="true" aria-label="SOS triage details" aria-describedby="sos-triage-limit" onKeyDown={onDialogKeyDown} onClick={(event) => event.stopPropagation()}>
      <div className="drawer-header"><div><div className="eyebrow">Incoming SOS · {incident.channel.toUpperCase()}</div><h2 tabIndex={-1}>{incident.emergency_type}</h2><p className="panel-subtitle">{incident.barangay} · received {formatAge(incident.received_at)}</p></div><button ref={closeRef} className="close-button" type="button" disabled={isBusy} onClick={closeSafely} aria-label="Close SOS triage details">×</button></div>
      <div className="drawer-body">
        <section className="drawer-section incident-response-packet" aria-label="Incident response packet"><div className="drawer-label">Incident response packet</div><div className="incident-packet-grid"><span><b>{incident.status.replace("_", " ")}</b> current state</span><span><b>{formatAge(incident.received_at)}</b> report age</span><span><b>±{incident.location.accuracy_meters ?? "unknown"} m</b> location confidence</span><span><b>{incident.channel.toUpperCase()}</b> reported channel</span></div><div id="sos-triage-limit" className="drawer-note">Current report, location, and status are shown together for review. Verification, hazard review, responder tasking, route checks, and public communication remain separate human decisions.</div></section>
        <section className="drawer-section"><div className="drawer-label">Current status</div><div className="drawer-value"><span className={`badge ${severityClass(incident.status)}`}>{incident.status.replace("_", " ")}</span></div></section>
        <section className="drawer-section"><div className="drawer-label">Incident summary</div><div className="drawer-value">{incident.summary}</div><div className="drawer-note">Received through {incident.channel.toUpperCase()}. Location confidence is ±{incident.location.accuracy_meters ?? "unknown"} meters.</div></section>
        <section className="drawer-section"><div className="drawer-label">Coordinates and routing guardrail</div><div className="drawer-value">{incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}</div><div className="drawer-note">Dispatch routing must avoid active flood polygons. Confirm the route again immediately before departure.</div></section>
        <section className="drawer-section"><div className="drawer-label">Incident decision context</div>{activeDispatch && <div className="inline-status"><strong>Active dispatch lifecycle</strong> · {activeDispatch.status.replaceAll("_", " ")} · assignment {activeDispatch.assignment_id.slice(0, 8)}. This record must be reviewed separately before another team is selected or this SOS is resolved.</div>}{commandRecord && <div className="drawer-note">Incident Command Record: {commandRecord.status.replaceAll("_", " ")} · follow-up {commandRecord.follow_up_owner && commandRecord.follow_up_due_at ? "assigned" : "needs review"}.</div>}{!activeDispatch && !commandRecord && <div className="drawer-note">No active dispatch lifecycle or linked Incident Command Record was returned for this SOS.</div>}</section>
        <IncidentWorkboard incident={incident} lifecycle={dispatchLifecycle} commandRecord={commandRecord} onRecorded={() => void refreshContext()} />
        <section className="drawer-section responder-safety-section"><div className="drawer-label">Responder-safety assessment</div><div className="drawer-note">For verified / acknowledged SOS only. Scores identify exposure and controls; they never create a dispatch, clear a route, or authorize entry.</div>{assessmentEligible ? <button className="secondary-button" type="button" disabled={assessing} onClick={() => void runSafetyAssessment()}>{assessing ? "Assessing responder risk…" : "Assess responder safety"}</button> : <div className="inline-status">Acknowledge and verify this SOS before assessing responder exposure.</div>}{safetyAssessment && <div className="responder-safety-result"><div className="assessment-summary"><div><strong>Assessment {safetyAssessment.assessment_id.slice(-8)}</strong><span>{formatAge(safetyAssessment.generated_at)} · {safetyAssessment.active_hazard_count} active map hazard record(s)</span></div><span className="badge advisory">review only</span></div>{safetyAssessment.assessments.map((candidate) => <article className="safety-candidate" key={candidate.group_id}><div className="safety-candidate-head"><div><strong>{candidate.group_name}</strong><span>{candidate.call_sign || "Call sign unlisted"} · {candidate.distance_meters.toLocaleString()} m away · readiness {candidate.readiness_score}/100</span></div><span className={`badge ${severityClass(candidate.risk_band === "severe" ? "critical" : candidate.risk_band)}`}>{candidate.risk_band} · {candidate.risk_score}/100</span></div><div className="safety-meta"><span>Location {candidate.location_age_minutes} min old</span><span>Check-in {candidate.check_in_age_minutes} min old</span><span>{candidate.availability}</span></div>{candidate.hold_reasons.length > 0 && <div className="safety-holds"><strong>Hold before tasking</strong><ul>{candidate.hold_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}</article>)}</div>}</section>
        <section className="drawer-section"><div className="drawer-label">Triage actions</div><div className="triage-actions">{incident.status === "received" && <><button className="primary-button" type="button" disabled={isBusy} onClick={() => void transition("acknowledged", "Acknowledged by coordinator after triage review.")}>Acknowledge receipt</button><button className="ghost-button" type="button" disabled={isBusy} onClick={() => { setPendingTransition("false_alarm"); setTransitionReason(""); setError(null); }}>Mark false alarm</button></>}{incident.status === "acknowledged" && <button ref={dispatchTriggerRef} className="primary-button" type="button" disabled={isBusy} onClick={() => void openDispatchSelector()}>{selectorLoading ? "Loading response teams…" : "Dispatch response team"}</button>}{incident.status === "dispatched" && <button className="primary-button" type="button" disabled={isBusy} onClick={() => { setPendingTransition("resolved"); setTransitionReason(""); setError(null); }}>Mark resolved</button>}{["resolved", "false_alarm"].includes(incident.status) && <div className="empty-state">This record is closed. Review the audit trail for the last handover.</div>}</div>
          {pendingTransition && <div className="mt-3 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3"><strong className="block text-sm text-amber-50">Confirm {pendingTransition === "false_alarm" ? "false-alarm" : "resolution"} status</strong><p className="mb-2 mt-1 text-xs leading-5 text-amber-100">This records a human status decision. It does not cancel dispatches, prove field safety, or replace the linked Incident Command Record.</p>{closureBlockers.length > 0 && <ul className="mb-2 list-disc space-y-1 pl-5 text-xs text-amber-100">{closureBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}<label className="text-xs font-semibold text-slate-100">Reason for this transition<textarea value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} minLength={5} maxLength={500} placeholder="Record the reported basis for this human decision" className="mt-1 min-h-20 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /></label><div className="mt-3 flex gap-2"><button type="button" className="primary-button" disabled={transitionReason.trim().length < 5 || (pendingTransition === "resolved" && closureBlockers.length > 0) || saving} onClick={() => void confirmTransition()}>{saving ? "Recording…" : `Record ${pendingTransition.replaceAll("_", " ")}`}</button><button type="button" className="ghost-button" disabled={saving} onClick={() => setPendingTransition(null)}>Cancel</button></div></div>}
          {error && <div className="inline-status error-status" role="alert">{error}</div>}
        </section>
      </div>
    </aside>
    {teamSelectorOpen && <DispatchTeamSelector teams={dispatchTeams} incident={incident} recommendation={dispatchRecommendation} loading={selectingTeam} onSelect={(team) => void selectDispatchTeam(team)} onClose={() => setTeamSelectorOpen(false)} returnFocusTarget={dispatchTriggerRef.current} />}
  </div>;
}
