import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CommunicationEvent, CommunicationSnapshot, CommunicationsPlan, NotificationSnapshot, ResourceItem, ResponseGroupSnapshot } from "../../lib/api";
import type { CommandCenterTab } from "./contracts";

export type ResourceRequestDraft = {
  amount: number;
  owner: string;
  rationale: string;
  reviewAt: string;
};

export type CommunicationPreflight = {
  toUnit: string;
  channel: CommunicationEvent["channel"];
  priority: CommunicationEvent["priority"];
  message: string;
  incidentId?: string;
  incidentLabel: string;
  simulateAudio: boolean;
};

function focusableDialog(dialog: HTMLDivElement | null) {
  dialog?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
}

export function FieldResponseAttentionStrip({ groups, resources, communications, notificationSnapshot, onNavigate }: { groups: ResponseGroupSnapshot; resources: ResourceItem[]; communications: CommunicationSnapshot; notificationSnapshot: NotificationSnapshot; onNavigate: (tab: CommandCenterTab) => void }) {
  const staleGroups = groups.groups.filter((group) => {
    const location = new Date(group.last_location_at).getTime();
    const checkIn = new Date(group.last_check_in_at).getTime();
    const limit = 15 * 60 * 1000;
    return !Number.isFinite(location) || !Number.isFinite(checkIn) || Date.now() - location > limit || Date.now() - checkIn > limit || group.availability === "offline";
  }).length;
  const lowResources = resources.filter((resource) => resource.status === "low" || resource.status === "unavailable").length;
  const degradedChannels = Object.values(communications.channel_health).filter((state) => state !== "clear").length;
  const deliveryIssues = notificationSnapshot.pending_count + notificationSnapshot.failed_count;
  const attention = [
    staleGroups ? { label: `${staleGroups} unit${staleGroups === 1 ? "" : "s"} need reported-status review`, tab: "Fleet & Responder Safety" as CommandCenterTab, tone: "critical" } : null,
    lowResources ? { label: `${lowResources} resource line${lowResources === 1 ? "" : "s"} need accountability review`, tab: "Resources" as CommandCenterTab, tone: "warning" } : null,
    degradedChannels ? { label: `${degradedChannels} communication channel${degradedChannels === 1 ? "" : "s"} degraded`, tab: "Communications" as CommandCenterTab, tone: "warning" } : null,
    deliveryIssues ? { label: `${deliveryIssues} delivery item${deliveryIssues === 1 ? "" : "s"} need follow-up`, tab: "Response Groups" as CommandCenterTab, tone: "advisory" } : null,
  ].filter((item): item is { label: string; tab: CommandCenterTab; tone: string } => item !== null);
  if (!attention.length) return <div className="field-response-attention clear" role="status"><strong>Field Response review queue clear</strong><span>No stale reporting, low-resource, degraded-channel, or delivery-follow-up indicator is in the current snapshot.</span></div>;
  return <section className="field-response-attention" aria-label="Field Response review queue"><div><strong>Review queue</strong><span>These links change the current view only; they do not clear, acknowledge, dispatch, or update any operational record.</span></div><div className="field-response-attention-actions">{attention.map((item) => <button key={`${item.tab}-${item.label}`} type="button" className={item.tone} onClick={() => onNavigate(item.tab)}>{item.label} <span aria-hidden="true">→</span></button>)}</div></section>;
}

export function ResourceAccountabilityDialog({ resource, action, onClose, onSubmit }: { resource: ResourceItem; action: "resource.resupply_requested" | "resource.reserve_requested"; onClose: () => void; onSubmit: (draft: ResourceRequestDraft) => Promise<void> }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState(Math.max(1, Math.ceil(resource.total * .15)));
  const [owner, setOwner] = useState(resource.owner);
  const [rationale, setRationale] = useState("");
  const [reviewAt, setReviewAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = action === "resource.resupply_requested" ? "Prepare resupply request" : "Prepare reserve request";
  useEffect(() => {
    focusableDialog(dialogRef.current);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0 || !owner.trim() || !rationale.trim() || !reviewAt) { setError("Enter an amount, responsible owner, reason, and review time before recording the request."); return; }
    setBusy(true); setError(null);
    try { await onSubmit({ amount, owner: owner.trim(), rationale: rationale.trim(), reviewAt }); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The resource request could not be recorded."); }
    finally { setBusy(false); }
  };
  return <div className="field-response-dialog-backdrop" role="presentation" onMouseDown={onClose}><section ref={dialogRef} className="field-response-dialog" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}><div className="field-response-dialog-heading"><div><span>Resource accountability · human review</span><h2>{label}</h2><p>{resource.name} · reported {resource.available}/{resource.total} {resource.unit} · {resource.location}</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close resource request">×</button></div><form onSubmit={submit} className="field-response-dialog-form"><div className="field-response-dialog-grid"><label>Requested amount<input type="number" min="1" max={Math.max(resource.total * 4, 1)} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Responsible owner<input value={owner} maxLength={120} onChange={(event) => setOwner(event.target.value)} /></label><label>Review by<input type="datetime-local" value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} /></label></div><label>Operational reason<textarea value={rationale} maxLength={500} placeholder="State the reported gap, intended destination, and any constraint that needs review." onChange={(event) => setRationale(event.target.value)} /></label><div className="field-response-decision-limit"><strong>Decision limit</strong><span>This records a request for human follow-up. It does not prove stock movement, delivery, reservation, or resource availability.</span></div>{error && <p className="field-response-dialog-error" role="alert">{error}</p>}<div className="field-response-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Recording…" : "Record request for review"}</button></div></form></section></div>;
}

export function CommunicationPreflightDialog({ draft, channelHealth, onClose, onConfirm }: { draft: CommunicationPreflight; channelHealth: CommunicationSnapshot["channel_health"]; onClose: () => void; onConfirm: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedHealth = channelHealth[draft.channel] || "not reported";
  useEffect(() => {
    focusableDialog(dialogRef.current);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  const confirm = async () => { setBusy(true); setError(null); try { await onConfirm(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The communication could not be sent. The draft remains available for review."); } finally { setBusy(false); } };
  return <div className="field-response-dialog-backdrop" role="presentation" onMouseDown={onClose}><section ref={dialogRef} className="field-response-dialog" role="dialog" aria-modal="true" aria-label="Review command-to-field message" onMouseDown={(event) => event.stopPropagation()}><div className="field-response-dialog-heading"><div><span>Communication preflight · deliberate send</span><h2>Review command-to-field message</h2><p>Confirm recipient scope, reported channel status, incident context, and rehearsal setting before submitting the message.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close communication preflight">×</button></div><div className="field-response-preflight-grid"><div><span>Recipient</span><strong>{draft.toUnit}</strong></div><div><span>Channel</span><strong>{draft.channel} · reported {selectedHealth}</strong></div><div><span>Priority</span><strong>{draft.priority}</strong></div><div><span>Incident link</span><strong>{draft.incidentLabel}</strong></div></div><label className="field-response-preflight-message">Message<textarea readOnly value={draft.message} /></label><div className="field-response-decision-limit"><strong>{draft.simulateAudio ? "Simulation clip enabled" : "No simulation clip"}</strong><span>This creates a traceable communication event. It does not confirm message receipt, field acknowledgement, route clearance, or responder safety.</span></div>{error && <p className="field-response-dialog-error" role="alert">{error}</p>}<div className="field-response-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Return to draft</button><button type="button" onClick={() => void confirm()} disabled={busy || selectedHealth === "degraded"}>{busy ? "Sending…" : "Record and send message"}</button></div></section></div>;
}
