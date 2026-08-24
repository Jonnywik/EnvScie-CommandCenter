import { useEffect, useMemo, useState } from "react";
import { type IncidentAction, type IncidentRecord, type SosIncident, createIncidentFromSos, getIncidents, transitionIncident } from "../../lib/api";
import type { OperationalAction } from "./contracts";

function displayTime(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export function IncidentCommandRecord({ sos, onAction, onRefresh }: { sos: SosIncident; onAction: OperationalAction; onRefresh: () => Promise<void> }) {
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const incident = useMemo(() => records.find((item) => item.linked_sos_ids.includes(sos.id)) || null, [records, sos.id]);
  const load = async () => { setLoading(true); try { setRecords((await getIncidents()).incidents); } catch (error) { setStatus(error instanceof Error ? error.message : "Incident command records are unavailable."); } finally { setLoading(false); } };
  useEffect(() => { setStatus(null); setNote(""); void load(); }, [sos.id]);
  const create = async () => {
    setStatus(null);
    try {
      const record = await createIncidentFromSos(sos.id, { follow_up_owner: owner || undefined, follow_up_due_at: dueAt ? new Date(dueAt).toISOString() : undefined });
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      await onAction("incident.created", "incident", record.id, "Human-created incident command record linked to SOS evidence.");
      setStatus("Incident command record created. It organizes reported evidence and does not authorize dispatch or verify field conditions.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Incident record could not be created."); }
  };
  const transition = async (action: IncidentAction) => {
    if (!incident || note.trim().length < 5) return;
    if (action === "close" && (!owner.trim() || !dueAt)) { setStatus("Closure requires a named follow-up owner and due date; it does not cancel active dispatch records."); return; }
    setStatus(null);
    try {
      const record = await transitionIncident(incident.id, { action, note: note.trim(), follow_up_owner: owner.trim() || undefined, follow_up_due_at: dueAt ? new Date(dueAt).toISOString() : undefined });
      setRecords((current) => current.map((item) => item.id === record.id ? record : item));
      await onAction(`incident.${action}`, "incident", record.id, `Human incident transition recorded: ${record.status}.`);
      setNote(""); setStatus(`Incident status recorded as ${record.status.replaceAll("_", " ")}. ${record.decision_limit}`); await onRefresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Incident transition could not be recorded."); }
  };
  return <section className="mx-auto mt-4 max-w-[1800px] rounded-2xl border border-teal-300/25 bg-slate-900/90 p-4 shadow-command backdrop-blur-xl" aria-label="Incident command record">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-[10px] font-bold tracking-[0.2em] text-teal-300">INCIDENT COMMAND RECORD</p><h2 className="m-0 mt-1 text-lg font-semibold text-white">Evidence, follow-up &amp; human closure</h2></div>{loading && <span className="text-xs text-slate-400">Loading record…</span>}{incident && <span className="rounded-full border border-teal-300/40 bg-teal-300/10 px-3 py-1 text-xs font-bold capitalize text-teal-100">{incident.status.replaceAll("_", " ")}</span>}</div>
    {!loading && !incident && <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-slate-950/50 p-4"><p className="m-0 text-sm text-slate-300">No durable command record is linked to this SOS. Create one only after a coordinator has decided to organize the reported evidence as an incident.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={owner} onChange={(event) => setOwner(event.target.value)} maxLength={120} placeholder="Optional follow-up owner" className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /></div><button type="button" onClick={() => void create()} className="mt-3 rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950">Create incident command record</button></div>}
    {incident && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]"><div className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="grid gap-3 sm:grid-cols-3"><div><span className="text-[10px] font-bold tracking-[.16em] text-slate-500">LINKED INTAKE</span><p className="mb-0 mt-1 text-sm font-semibold text-white">{incident.linked_sos_ids.length} SOS record</p></div><div><span className="text-[10px] font-bold tracking-[.16em] text-slate-500">FOLLOW-UP OWNER</span><p className="mb-0 mt-1 text-sm font-semibold text-white">{incident.follow_up_owner || "Unassigned"}</p></div><div><span className="text-[10px] font-bold tracking-[.16em] text-slate-500">FOLLOW-UP DUE</span><p className="mb-0 mt-1 text-sm font-semibold text-white">{incident.follow_up_due_at ? displayTime(incident.follow_up_due_at) : "Not scheduled"}</p></div></div><p className="mb-0 mt-4 text-xs leading-5 text-slate-400">{incident.decision_limit}</p><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><input value={owner} onChange={(event) => setOwner(event.target.value)} maxLength={120} placeholder="Follow-up owner" className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /></div><textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000} placeholder="Required human decision note for monitoring, escalation, stabilization, closure, or reopening" className="mt-3 min-h-20 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void transition("monitor")} disabled={note.trim().length < 5} className="tiny-button">Monitor</button><button type="button" onClick={() => void transition("escalate")} disabled={note.trim().length < 5} className="tiny-button">Escalate</button><button type="button" onClick={() => void transition("stabilize")} disabled={note.trim().length < 5} className="tiny-button">Stabilize</button>{incident.status === "closed" ? <button type="button" onClick={() => void transition("reopen")} disabled={note.trim().length < 5} className="tiny-button">Reopen</button> : <button type="button" onClick={() => void transition("close")} disabled={note.trim().length < 5 || !owner.trim() || !dueAt} className="rounded-lg border border-amber-300/50 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50">Close with follow-up</button>}</div></div><div className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><h3 className="m-0 text-sm font-semibold text-white">Immutable incident timeline</h3><ol className="mb-0 mt-3 space-y-3 border-l border-white/10 pl-4">{incident.events.map((event) => <li key={event.id} className="relative text-xs text-slate-300"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-teal-300 ring-4 ring-slate-950" /><strong className="block capitalize text-white">{event.to_status.replaceAll("_", " ")}</strong><span>{displayTime(event.occurred_at)} · {event.actor_role || "operator"}</span>{event.note && <p className="mb-0 mt-1 leading-5 text-slate-400">{event.note}</p>}</li>)}</ol></div></div>}
    {status && <div className="mt-4 rounded-lg border border-teal-300/30 bg-teal-300/10 p-3 text-sm text-teal-100" role="status">{status}</div>}
  </section>;
}
