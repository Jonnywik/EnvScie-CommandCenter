import type React from "react";
import { BellRing, ClipboardList, LayoutDashboard, Map, Route, Settings2, Siren, UsersRound, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

export const civilianNavigation: { href: string; key: "home" | "directions" | "explore" | "report" | "alerts" | "prepare"; icon: LucideIcon; urgent?: boolean }[] = [
  { href: "/", key: "home", icon: LayoutDashboard },
  { href: "/directions", key: "directions", icon: Route },
  { href: "/crisis-map", key: "explore", icon: Map },
  { href: "/report", key: "report", icon: Siren, urgent: true },
  { href: "/alerts", key: "alerts", icon: BellRing },
  { href: "/prepare", key: "prepare", icon: ClipboardList },
];

export function mobileNavigationStateClasses(active: boolean, urgent = false) {
  if (active) return "drrm-mobile-nav-link--active -translate-y-1 bg-[#e97f63] text-white shadow-[0_8px_20px_rgba(233,127,99,0.36)]";
  if (urgent) return "drrm-mobile-nav-link--urgent text-[#ffb3a1]";
  return "text-white/75 hover:bg-white/10 hover:text-white";
}

export function CivilianShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { copy } = useLocale();
  return <div className="drrm-shell min-h-screen bg-[#f7fbfa] text-[#063448]"><div className="drrm-command-strip border-b border-white/10 bg-[#063448] px-4 py-2 text-center text-[10px] font-bold tracking-[0.01em] text-white sm:px-6 sm:text-[11px]"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#87e3c9] align-middle"/>{copy.coverage}</div><header className="drrm-primary-header sticky top-0 z-40 border-b border-[#e1ece9]/80 bg-[#f7fbfa]/95 backdrop-blur-xl"><div className="container flex h-16 items-center justify-between gap-3 md:h-[72px]"><Link href="/"><BrandMark className="scale-90 origin-left sm:scale-100"/></Link><nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">{civilianNavigation.map((item) => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); return <Link key={item.href} href={item.href} className={cn("drrm-nav-link rounded-xl px-3 py-2 text-sm font-bold transition-colors", active ? "drrm-nav-link--active bg-[#dff7ef] text-[#0e715f]" : "text-[#527176] hover:bg-white hover:text-[#063448]")}>{copy.nav[item.key]}</Link>; })}<Link href="/circle" className={cn("ml-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold", location.startsWith("/circle") ? "bg-[#dff7ef] text-[#0e715f]" : "text-[#527176] hover:bg-white hover:text-[#063448]")}><UsersRound className="h-4 w-4"/>Circle</Link><Link href="/ops" className="drrm-operations-link ml-2 inline-flex items-center gap-2 rounded-xl bg-[#063448] px-3.5 py-2 text-sm font-bold text-white">{copy.nav.operations}</Link></nav><div className="flex items-center gap-2"><Link href="/circle" className={cn("grid h-11 w-11 place-items-center rounded-2xl border transition-transform active:scale-[0.97] md:hidden", location.startsWith("/circle") ? "border-[#83dac1] bg-[#dff7ef] text-[#0e715f]" : "border-[#d8e5e2] bg-white text-[#063448]")} aria-label="Open trusted circle"><UsersRound className="h-[18px] w-[18px]"/></Link><Link href="/alerts" className="drrm-header-action hidden h-11 w-11 place-items-center rounded-2xl border border-[#d8e5e2] bg-white text-[#063448] md:grid" aria-label="View alerts"><BellRing className="h-[18px] w-[18px]"/></Link><Link href="/settings" className={cn("drrm-header-action grid h-11 w-11 place-items-center rounded-2xl border transition-transform active:scale-[0.97]", location === "/settings" ? "border-[#83dac1] bg-[#dff7ef] text-[#0e715f]" : "border-[#d8e5e2] bg-white text-[#063448]")} aria-label={copy.nav.settings}><Settings2 className="h-[18px] w-[18px]"/></Link></div></div></header><main className="pb-28 md:pb-10">{children}</main><nav className="drrm-mobile-navigation fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#063448]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(6,52,72,0.2)] backdrop-blur md:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-lg grid-cols-6 gap-1">{civilianNavigation.map((item) => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("drrm-mobile-nav-link flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[10px] font-extrabold transition-all active:scale-[0.96]", mobileNavigationStateClasses(active, item.urgent))}><Icon className="h-[18px] w-[18px]" strokeWidth={active || item.urgent ? 2.5 : 2}/><span>{copy.nav[item.key]}</span></Link>; })}</div></nav></div>;
}
