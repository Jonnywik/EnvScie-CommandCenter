import React from "react";
import type { DirectionStep } from "@/lib/directions";

const distance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(1, Math.round(meters))} m`;
const duration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;
export function RouteSteps({ steps }: { steps: DirectionStep[] }) { if (!steps.length) return null; return <ol aria-label="Turn-by-turn directions" className="mt-4 space-y-3 border-t border-[#d4e6e1] pt-4">{steps.map((step, index) => <li key={`${step.instruction}-${index}`} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0e715f] text-xs font-extrabold text-white">{index + 1}</span><div><p className="text-sm font-bold leading-5 text-[#163f4a]">{step.instruction}</p><p className="mt-0.5 text-xs text-[#60797d]">{distance(step.meters)} · {duration(step.seconds)}</p></div></li>)}</ol>; }
