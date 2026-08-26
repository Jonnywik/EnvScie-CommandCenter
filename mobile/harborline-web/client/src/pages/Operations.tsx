import { useState } from "react";
import { BellRing, ChevronRight, ClipboardList, MapPin, RadioTower, Send, ShieldAlert, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppCard, SectionTitle, StatusPill, StatTile } from "@/components/drrm/DrrmPrimitives";
import { BrandMark } from "@/components/drrm/BrandMark";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { DrrmNotice, FormLabel } from "@/components/drrm/DrrmDomain";
import { ClosureUpdateForm } from "@/components/drrm/ClosureUpdateForm";
import { EvacuationCenterPublishingPanel } from "@/components/drrm/EvacuationCenterPublishingPanel";

const reports = [
  { id: "REF-001", type: "Coastal access observation", place: "Balangiga, Eastern Samar", age: "Reference", severity: "High", status: "New" },
  { id: "REF-002", type: "Road condition observation", place: "Balangiga, Eastern Samar", age: "Reference", severity: "Medium", status: "Assigned" },
  { id: "REF-003", type: "Medical support request", place: "Balangiga, Eastern Samar", age: "Reference", severity: "High", status: "New" },
];

export default function Operations() {
  const [selected, setSelected] = useState(reports[0]);
  const [sent, setSent] = useState(false);
  const [targetName, setTargetName] = useState("Balangiga, Eastern Samar");
  const [alertMessage, setAlertMessage] = useState("Check official weather and Balangiga LGU advisories before travelling. Confirm local evacuation arrangements and coastal access conditions.");
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const recentReports = trpc.reports.recent.useQuery(undefined, { enabled: Boolean(user) });
  const { data: liveCenters } = trpc.centers.list.useQuery();
  const primaryCenter = liveCenters?.[0];
  const displayReports = recentReports.data?.length ? recentReports.data.map((report) => ({ id: `IR-${report.id}`, type: report.category.replaceAll("_", " "), place: report.locationLabel ?? "GPS location attached", age: "Live", severity: report.category === "medical_sos" ? "High" : "Medium", status: report.status === "new" ? "New" : "Assigned" })) : reports;
  const issueAlert = trpc.alerts.issue.useMutation({
    onSuccess: () => { setSent(true); void utils.alerts.active.invalidate(); toast.success("Geo-targeted alert placed in the delivery queue."); },
    onError: () => toast.error("Sign in with an authorized operations account to issue this alert."),
  });
  const sendAlert = () => {
    if (!user) { startLogin(); return; }
    issueAlert.mutate({ headline: alertMessage.slice(0, 200), body: alertMessage, severity: "warning", targetName });
  };

  return <div className="min-h-screen bg-[#f7fbfa]">
    <header className="sticky top-0 z-40 border-b border-[#d8e5e2] bg-white/95 backdrop-blur"><div className="container flex h-16 items-center justify-between sm:h-[72px]"><BrandMark className="scale-90 origin-left sm:scale-100"/><div className="flex items-center gap-2"><StatusPill tone="mint" className="hidden sm:inline-flex">Operations workspace</StatusPill><span className="grid h-8 w-8 place-items-center rounded-full bg-[#dff7ef] text-[#0e715f] sm:hidden" aria-label="Operations online"><RadioTower className="h-4 w-4" /></span><button className="grid h-11 w-11 place-items-center rounded-2xl border border-[#dce8e5] text-[#063448]" aria-label="Notification settings"><BellRing className="h-4 w-4" /></button></div></div></header>
    <main className="container py-6 sm:py-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#589b8d]">Balangiga, Eastern Samar</p><h1 className="font-display mt-1 text-3xl font-extrabold tracking-[-0.055em]">Coordinate the next safe move.</h1></div><p className="text-sm font-semibold text-[#6d8487]"><RadioTower className="mr-1.5 inline h-4 w-4 text-[#0e715f]"/>Local reference workspace</p></div>
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatTile icon={ClipboardList} label="Reference queue" value="3" detail="Review before action" tone="coral"/><StatTile icon={MapPin} label="Center roster" value={String(liveCenters?.length ?? 1)} detail="LGU verification needed" tone="mint"/><StatTile icon={UsersRound} label="Response partners" value="—" detail="Coordinate with LGU" tone="navy"/><StatTile icon={BellRing} label="Alert scope" value="Local" detail="Balangiga focused" tone="amber"/></section>
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]"><AppCard className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#e2ece9] p-5"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#589b8d]">Incoming intelligence</p><h2 className="font-display mt-1 text-xl font-extrabold tracking-[-0.04em]">Report triage</h2></div><StatusPill tone="coral">{recentReports.data?.length ?? 3} awaiting review</StatusPill></div><div className="divide-y divide-[#e6efed]">{displayReports.map((report) => <button onClick={() => setSelected(report)} key={report.id} className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${selected.id === report.id ? "bg-[#effaf6]" : "hover:bg-[#f8fbfa]"}`}><div className={`h-2.5 w-2.5 shrink-0 rounded-full ${report.severity === "High" ? "bg-[#e97f63]" : "bg-[#e5b25b]"}`}/><div className="min-w-0 flex-1"><div className="flex gap-2"><span className="text-xs font-extrabold text-[#0e715f]">{report.id}</span><span className="text-xs font-bold text-[#70878b]">{report.age}</span></div><p className="mt-1 truncate text-sm font-extrabold text-[#173f4a]">{report.type} · {report.place}</p></div><StatusPill tone={report.status === "New" ? "coral" : "navy"}>{report.status}</StatusPill><ChevronRight className="h-4 w-4 text-[#8ba0a1]" /></button>)}</div><div className="border-t border-[#e2ece9] bg-[#f8fbfa] p-5"><p className="text-sm font-extrabold">Selected: {selected.id} · {selected.type}</p><p className="mt-1 text-sm text-[#60797d]">GPS and secure evidence are available to authorized operators only.</p><div className="mt-4 flex gap-2"><button onClick={() => toast.success("Report assigned to the Balangiga response coordination queue.")} className="rounded-xl bg-[#063448] px-3 py-2.5 text-sm font-extrabold text-white">Assign response</button><button onClick={() => toast.success("Report marked as verified.")} className="rounded-xl border border-[#beded6] px-3 py-2.5 text-sm font-extrabold text-[#0e715f]">Verify</button></div></div></AppCard>
        <div className="space-y-5"><AppCard className="p-5"><SectionTitle eyebrow="Evacuation operations" title="Center publication"/><EvacuationCenterPublishingPanel center={primaryCenter ?? null} authorized={user?.role === "admin"} requestLogin={startLogin}/></AppCard>
          <AppCard className="p-5"><SectionTitle eyebrow="LGU map feed" title="Verified road closure"/><div className="mt-4"><ClosureUpdateForm authenticated={Boolean(user)} requestLogin={startLogin}/></div></AppCard>
          <AppCard className="p-5"><SectionTitle eyebrow="Geofenced communications" title="Issue an alert"/><div className="mt-4 space-y-3"><FormLabel label="Target area"><select value={targetName} onChange={(event) => setTargetName(event.target.value)} className="h-11 w-full rounded-xl border border-[#dbe8e5] bg-white px-3 text-sm font-semibold outline-none"><option>Balangiga, Eastern Samar</option><option>Coastal communities, Balangiga</option><option>Municipality-wide reference area</option></select></FormLabel><FormLabel label="Message"><textarea value={alertMessage} onChange={(event) => setAlertMessage(event.target.value)} className="min-h-20 w-full resize-none rounded-xl border border-[#dbe8e5] bg-white p-3 text-sm font-medium outline-none" /></FormLabel><button onClick={sendAlert} disabled={issueAlert.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e97f63] px-4 py-3 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-70"><Send className="h-4 w-4"/>{sent ? "Alert queued" : issueAlert.isPending ? "Issuing alert…" : "Issue emergency alert"}</button></div></AppCard></div>
      </section><DrrmNotice tone="safe" className="mt-6"><ShieldAlert className="mr-1 inline h-4 w-4"/>Critical alert delivery requires role authorization and is recorded in the operational audit trail.</DrrmNotice>
    </main>
  </div>;
}
