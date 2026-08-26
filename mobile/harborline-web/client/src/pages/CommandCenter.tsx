import { Link } from "wouter";
import { RadioTower, ShieldAlert } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { BrandMark } from "@/components/drrm/BrandMark";
import { CommandCenterResponsePanel } from "@/components/drrm/CommandCenterResponsePanel";
import { DrrmNotice } from "@/components/drrm/DrrmDomain";
import { StatusPill } from "@/components/drrm/DrrmPrimitives";

export default function CommandCenter() {
  const { user } = useAuth();
  return <div className="min-h-screen bg-[#f7fbfa]"><header className="sticky top-0 z-40 border-b border-white/10 bg-[#063448]/95 backdrop-blur"><div className="container flex h-16 items-center justify-between sm:h-[72px]"><BrandMark className="scale-90 origin-left sm:scale-100"/><div className="flex items-center gap-3"><StatusPill tone="mint" className="hidden sm:inline-flex">Command center</StatusPill><Link href="/ops/management" className="rounded-xl border border-white/30 px-3 py-2 text-sm font-extrabold text-white">Operations management</Link></div></div></header><main className="container py-6 sm:py-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#589b8d]">Balangiga, Eastern Samar</p><h1 className="font-display mt-1 text-3xl font-extrabold tracking-[-0.055em]">Coordinate the next safe move.</h1></div><p className="text-sm font-semibold text-[#6d8487]"><RadioTower className="mr-1.5 inline h-4 w-4 text-[#0e715f]"/>Mobile intake and response coordination</p></div><CommandCenterResponsePanel authorized={user?.role === "admin"} requestLogin={startLogin}/><DrrmNotice tone="watch" className="mt-6"><ShieldAlert className="mr-1 inline h-4 w-4"/>A queue item means that Harborline received a mobile submission. Operators must acknowledge and document action before treating it as active coordination.</DrrmNotice></main></div>;
}
