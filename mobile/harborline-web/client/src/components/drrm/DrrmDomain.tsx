import { CheckCircle2, CircleAlert, Info, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeTone = "safe" | "watch" | "urgent" | "info";
const noticeStyles: Record<NoticeTone, { shell: string; icon: typeof CheckCircle2 }> = {
  safe: { shell: "border-[#c9e7de] bg-[#eaf8f4] text-[#346469]", icon: CheckCircle2 },
  watch: { shell: "border-[#f3dcad] bg-[#fff8eb] text-[#8f631e]", icon: CircleAlert },
  urgent: { shell: "border-[#ffd1c7] bg-[#fff3f0] text-[#9f452f]", icon: CircleAlert },
  info: { shell: "border-[#cfe5ea] bg-[#eef8fa] text-[#335f6c]", icon: Info },
};

export function DrrmNotice({ tone = "info", title, children, className }: { tone?: NoticeTone; title?: string; children: React.ReactNode; className?: string }) {
  const { shell, icon: Icon } = noticeStyles[tone];
  return <div className={cn("rounded-2xl border p-4 text-sm leading-6", shell, className)}><Icon className="mr-2 inline h-4 w-4 align-[-2px]" />{title && <strong>{title} </strong>}{children}</div>;
}

export function OfflineSyncStatus({ state, className }: { state: "ready" | "queued" | "syncing"; className?: string }) {
  const labels = { ready: "Offline pack ready", queued: "Stored in offline queue", syncing: "Syncing saved updates" };
  return <span className={cn("inline-flex items-center gap-2 rounded-xl bg-[#f1f8f6] px-3 py-2 text-xs font-bold text-[#40666a]", className)}><WifiOff className="h-4 w-4 text-[#0e715f]" />{labels[state]}</span>;
}

export function FormLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-xs font-extrabold text-[#4a6b70]"><span>{label}</span>{hint && <span className="ml-1 font-medium text-[#789093]">{hint}</span>}<div className="mt-1.5">{children}</div></label>;
}

export function DrrmAlertCard({ icon: Icon, title, detail, area, timestamp, tone = "info", action }: { icon: LucideIcon; title: string; detail: string; area: string; timestamp: string; tone?: NoticeTone; action?: React.ReactNode }) {
  const iconTone: Record<NoticeTone, string> = { safe: "bg-[#dff7ef] text-[#0e715f]", watch: "bg-[#fff1d7] text-[#a45c0f]", urgent: "bg-[#fff0ec] text-[#b7422a]", info: "bg-[#e7f3f6] text-[#063448]" };
  return <section className="rounded-[1.35rem] border border-[#dce8e5] bg-white p-5 shadow-[0_12px_30px_rgba(6,52,72,0.05)]"><div className="flex gap-4"><div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", iconTone[tone])}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#589b8d]">{area}</span><span className="text-xs font-bold text-[#728a8d]">{timestamp}</span></div><h2 className="font-display mt-2 text-lg font-extrabold tracking-[-0.035em] text-[#063448]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#60797d]">{detail}</p>{action && <div className="mt-3">{action}</div>}</div></div></section>;
}

export function DrrmActionCard({ icon: Icon, title, detail, children, tone = "safe" }: { icon: LucideIcon; title: string; detail: string; children: React.ReactNode; tone?: NoticeTone }) {
  const iconTone: Record<NoticeTone, string> = { safe: "bg-[#dff7ef] text-[#0e715f]", watch: "bg-[#fff1d7] text-[#a45c0f]", urgent: "bg-[#fff0ec] text-[#b7422a]", info: "bg-[#e7f3f6] text-[#063448]" };
  return <section className="rounded-[1.5rem] border border-[#dbe8e5] bg-white p-5 shadow-[0_12px_32px_rgba(6,52,72,0.05)]"><div className={cn("grid h-11 w-11 place-items-center rounded-2xl", iconTone[tone])}><Icon className="h-5 w-5" /></div><h3 className="font-display mt-4 text-lg font-extrabold tracking-[-0.035em] text-[#063448]">{title}</h3><p className="mt-1 text-sm text-[#71898c]">{detail}</p><div className="mt-4">{children}</div></section>;
}

export function DrrmFormSection({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border border-[#dbe8e5] bg-white p-5 shadow-[0_12px_32px_rgba(6,52,72,0.05)] sm:p-6"><p className="font-display text-lg font-extrabold tracking-[-0.035em] text-[#063448]"><span className="mr-1 text-[#0e715f]">{step}.</span>{title}</p><div className="mt-4">{children}</div></section>;
}
