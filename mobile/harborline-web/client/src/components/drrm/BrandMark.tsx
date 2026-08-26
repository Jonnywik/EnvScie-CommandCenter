import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return <div className={cn("drrm-brand-lockup flex shrink-0 items-center gap-3", className)}><div className="drrm-brand-symbol relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#063448] shadow-[0_0_0_4px_#86dec6]"><div className="absolute -bottom-2 -left-2 h-7 w-11 rotate-[28deg] rounded-t-full border-t-2 border-white/90"/><div className="absolute bottom-2 left-2 h-4 w-5 rounded-tl-sm bg-[#83dac1] [clip-path:polygon(50%_0,100%_45%,100%_100%,0_100%,0_45%)]"/><Wind className="relative z-10 ml-4 h-6 w-6 text-white" strokeWidth={1.7}/></div>{!compact && <div className="leading-tight"><p className="drrm-brand-kicker whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.14em] text-[#5d7c7d] sm:text-[11px] sm:tracking-[0.2em]">Balangiga civilian</p><p className="drrm-brand-title whitespace-nowrap font-display text-[15px] font-extrabold tracking-[-0.04em] text-[#063448] sm:text-lg">Code for Resilience</p></div>}</div>;
}
