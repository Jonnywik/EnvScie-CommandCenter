import { useEffect, useState, type FormEvent } from "react";
import {
  type FacilityReportedAccess,
  type FacilityVerificationOutcome,
  type FacilityVerificationSnapshot,
  type OfficialFacilityRegistry,
  createFacilityVerification,
  getFacilityVerifications,
  getOfficialFacilityRegistry,
} from "../../lib/api";

function displayTime(timestamp: string) {
  return new Date(timestamp).toLocaleString([], { hour: "2-digit", minute: "2-digit", year: "numeric", month: "short", day: "numeric" });
}

export function FacilityVerificationWorkspace() {
  const [registry, setRegistry] = useState<OfficialFacilityRegistry | null>(null);
  const [verifications, setVerifications] = useState<FacilityVerificationSnapshot | null>(null);
  const [facilityId, setFacilityId] = useState("");
  const [coordinateConfirmed, setCoordinateConfirmed] = useState(false);
  const [contactAttempted, setContactAttempted] = useState(false);
  const [reportedAccess, setReportedAccess] = useState<FacilityReportedAccess>("not_assessed");
  const [outcome, setOutcome] = useState<FacilityVerificationOutcome>("follow_up_required");
  const [sourceDocumentReference, setSourceDocumentReference] = useState("");
  const [revalidationDue, setRevalidationDue] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    try {
      const [nextRegistry, nextVerifications] = await Promise.all([getOfficialFacilityRegistry(), getFacilityVerifications()]);
      setRegistry(nextRegistry); setVerifications(nextVerifications);
      setFacilityId((current) => current || nextRegistry.facilities[0]?.id || "");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Facility references or verification records are unavailable."); }
  };
  useEffect(() => { void load(); }, []);
  const selectedFacility = registry?.facilities.find((item) => item.id === facilityId) || registry?.facilities[0] || null;
  const history = verifications?.records.filter((item) => item.facility_id === selectedFacility?.id) || [];
  useEffect(() => { if (selectedFacility) setSourceDocumentReference((current) => current || `${selectedFacility.source_name}: ${selectedFacility.source_url}`); }, [selectedFacility]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!facilityId || note.trim().length < 5 || sourceDocumentReference.trim().length < 3 || !revalidationDue || saving) return;
    setSaving(true); setStatus(null);
    try {
      const record = await createFacilityVerification({
        facility_id: facilityId, coordinate_confirmed: coordinateConfirmed, contact_attempted: contactAttempted,
        reported_access: reportedAccess, verification_outcome: outcome, source_document_reference: sourceDocumentReference.trim(),
        revalidation_due_at: new Date(revalidationDue).toISOString(), verification_note: note.trim(),
      });
      setVerifications((current) => current ? { ...current, records: [record, ...current.records] } : { generated_at: record.verified_at, source: "demo-seed", records: [record] });
      setNote("");
      setStatus(`Verification record saved at ${displayTime(record.verified_at)}. ${record.decision_limit}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Facility verification could not be saved."); }
    finally { setSaving(false); }
  };

  return <section className="panel facility-verification-workspace" aria-label="LGU DRRMO facility verification workspace">
    <div className="panel-header"><div><div className="panel-title">LGU/DRRMO facility verification</div><div className="panel-subtitle">Record source-pin, contact, and reported-access checks without inferring readiness</div></div><span className="panel-link">Reference-only safeguards</span></div>
    <div className="panel-body">
      <div className="callout"><strong>Operational boundary</strong><span>Entries are auditable records of human reference checks. They do not confirm staffing, beds, supplies, communications, structural safety, accessibility, or emergency-task suitability.</span></div>
      {registry ? <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <form onSubmit={(event) => void save(event)} className="space-y-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <label className="block text-sm font-semibold text-slate-100">Official facility reference<select value={facilityId} onChange={(event) => setFacilityId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white">{registry.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
          {selectedFacility && <div className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs text-slate-300"><strong className="block text-sm text-white">{selectedFacility.name}</strong><span className="mt-1 block">{selectedFacility.address}</span><span className="mt-2 block">Registry pin: {selectedFacility.coordinate_validation_status.replaceAll("_", " ")} · {selectedFacility.position.latitude.toFixed(5)}, {selectedFacility.position.longitude.toFixed(5)}</span><a className="mt-2 inline-block text-teal-200 underline" href={selectedFacility.source_url} target="_blank" rel="noreferrer">Open official source ↗</a></div>}
          <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.03] p-3 text-sm text-slate-200"><input type="checkbox" checked={coordinateConfirmed} onChange={(event) => setCoordinateConfirmed(event.target.checked)} className="h-4 w-4 accent-teal-300" />Pin checked against local reference</label><label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.03] p-3 text-sm text-slate-200"><input type="checkbox" checked={contactAttempted} onChange={(event) => setContactAttempted(event.target.checked)} className="h-4 w-4 accent-teal-300" />Facility or LGU contact attempted</label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-200">Reported access<select value={reportedAccess} onChange={(event) => setReportedAccess(event.target.value as FacilityReportedAccess)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"><option value="not_assessed">Not assessed</option><option value="reported_open">Reported open</option><option value="reported_restricted">Reported restricted</option><option value="reported_unavailable">Reported unavailable</option></select></label><label className="text-sm font-semibold text-slate-200">Verification outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as FacilityVerificationOutcome)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"><option value="reference_verified">Reference details verified</option><option value="follow_up_required">Follow-up required</option><option value="not_verified">Not verified</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><label className="block text-sm font-semibold text-slate-200">Source document or reference<textarea value={sourceDocumentReference} onChange={(event) => setSourceDocumentReference(event.target.value)} minLength={3} maxLength={500} required placeholder="Official directory, contact log, document ID, or verified reference URL" className="mt-1 min-h-20 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" /></label><label className="block text-sm font-semibold text-slate-200">Revalidation due<input type="datetime-local" value={revalidationDue} onChange={(event) => setRevalidationDue(event.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" /><span className="mt-1 block text-xs font-normal leading-4 text-slate-400">Schedule a renewed human check; this is not an operational readiness expiry.</span></label></div>
          <label className="block text-sm font-semibold text-slate-200">Verification note<textarea value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000} required placeholder="State what was checked, who was contacted, and what remains unverified. Do not enter a readiness claim." className="mt-1 min-h-24 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" /></label>
          <button className="primary-button" type="submit" disabled={saving || note.trim().length < 5 || sourceDocumentReference.trim().length < 3 || !revalidationDue}>{saving ? "Saving…" : "Record verification"}</button>
        </form>
        <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="m-0 text-sm font-semibold text-white">Verification history</h3><p className="mb-0 mt-1 text-xs text-slate-400">Latest entries for the selected facility reference.</p></div><button type="button" className="tiny-button" onClick={() => void load()}>Refresh</button></div><div className="mt-3 space-y-3">{history.map((record) => <article key={record.id} className="rounded-lg border border-white/10 bg-white/[.03] p-3 text-xs text-slate-300"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="capitalize text-white">{record.verification_outcome.replaceAll("_", " ")}</strong><span className="badge advisory">{record.reported_access.replaceAll("_", " ")}</span></div><p className="mb-0 mt-2 leading-5">{record.verification_note}</p><span className="mt-2 block leading-5 text-slate-400">Evidence: {record.source_document_reference}</span><span className="mt-1 block text-slate-500">{displayTime(record.verified_at)} · {record.verified_by_role || "operator"} · revalidate by {displayTime(record.revalidation_due_at)} · pin {record.coordinate_confirmed ? "checked" : "not checked"} · contact {record.contact_attempted ? "attempted" : "not attempted"}</span></article>)}{!history.length && <div className="empty-state">No LGU/DRRMO verification record has been entered for this facility reference.</div>}</div></section>
      </div> : <div className="empty-state">Loading official facility references…</div>}
      {status && <div className="inline-status mt-4" role="status">{status}</div>}
    </div>
  </section>;
}
