import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "mint" | "amber" | "coral" | "navy" | "slate" | "watch";

const toneClasses: Record<Tone, string> = {
  mint: "bg-[#dff7ef] text-[#0e715f] ring-[#afead8]",
  amber: "bg-[#fff1d7] text-[#a45c0f] ring-[#fed89b]",
  coral: "bg-[#fff0ec] text-[#b7422a] ring-[#ffc7bb]",
  navy: "bg-[#e7f3f6] text-[#063448] ring-[#bfdfe6]",
  slate: "bg-[#eef3f2] text-[#577276] ring-[#d8e2e0]",
  watch: "bg-[#fff1d7] text-[#a45c0f] ring-[#fed89b]",
};

export function StatusPill({ tone = "slate", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ring-1", toneClasses[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function AppCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-[1.5rem] border border-[#d8e5e2] bg-white shadow-[0_12px_32px_rgba(6,52,72,0.07)]", className)}>{children}</section>;
}

export function StatTile({ icon: Icon, label, value, detail, tone = "mint" }: { icon: LucideIcon; label: string; value: string; detail?: string; tone?: Tone }) {
  const iconTone: Record<Tone, string> = {
    mint: "bg-[#dff7ef] text-[#0e715f]",
    amber: "bg-[#fff1d7] text-[#a45c0f]",
    coral: "bg-[#fff0ec] text-[#b7422a]",
    navy: "bg-[#e7f3f6] text-[#063448]",
    slate: "bg-[#eef3f2] text-[#577276]",
    watch: "bg-[#fff1d7] text-[#a45c0f]",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-[#e2ece9] bg-white p-3.5">
      <div className={cn("mb-3 grid h-9 w-9 place-items-center rounded-xl", iconTone[tone])}><Icon className="h-4.5 w-4.5" /></div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6d8487]">{label}</p>
      <p className="mt-1 text-lg font-extrabold tracking-[-0.04em] text-[#063448]">{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-[#6d8487]">{detail}</p>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#589b8d]">{eyebrow}</p>}
        <h2 className="font-display text-xl font-extrabold tracking-[-0.045em] text-[#063448]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
