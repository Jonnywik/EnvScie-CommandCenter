import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearLayerVisibility, emergencyLayerVisibility, toggleCrisisLayer, type CrisisLayerKey, type CrisisLayerVisibility } from "@/lib/crisisMapState";
import { allCrisisSeverities, emergencyCrisisSeverities, toggleCrisisSeverity, type CrisisSeverity } from "@/lib/crisisMapSeverity";

export type { CrisisLayerKey } from "@/lib/crisisMapState";
export type { CrisisSeverity } from "@/lib/crisisMapSeverity";
type Preset = "emergency" | "custom" | "clear";
type CrisisMapContextValue = { visible: CrisisLayerVisibility; severities: CrisisSeverity[]; preset: Preset; filterOpen: boolean; toggleLayer: (key: CrisisLayerKey) => void; toggleSeverity: (severity: CrisisSeverity) => void; showAllSeverities: () => void; emergencyDefault: () => void; clearAll: () => void; setFilterOpen: (open: boolean) => void };
const CrisisMapContext = createContext<CrisisMapContextValue | undefined>(undefined);

export function CrisisMapProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState<CrisisLayerVisibility>(() => { try { return { ...emergencyLayerVisibility, ...JSON.parse(localStorage.getItem("harborline-crisis-layers") ?? "{}") }; } catch { return emergencyLayerVisibility; } });
  const [severities, setSeverities] = useState<CrisisSeverity[]>(() => { try { const parsed = JSON.parse(localStorage.getItem("harborline-crisis-severities") ?? "null"); return Array.isArray(parsed) ? parsed.filter((value): value is CrisisSeverity => allCrisisSeverities.includes(value)) : allCrisisSeverities; } catch { return allCrisisSeverities; } });
  const [preset, setPreset] = useState<Preset>("emergency");
  const [filterOpen, setFilterOpen] = useState(false);
  useEffect(() => localStorage.setItem("harborline-crisis-layers", JSON.stringify(visible)), [visible]);
  useEffect(() => localStorage.setItem("harborline-crisis-severities", JSON.stringify(severities)), [severities]);
  const value = useMemo(() => ({
    visible,
    severities,
    preset,
    filterOpen,
    toggleLayer: (key: CrisisLayerKey) => { setVisible((current) => toggleCrisisLayer(current, key)); setPreset("custom"); },
    toggleSeverity: (severity: CrisisSeverity) => { setSeverities((current) => toggleCrisisSeverity(current, severity)); setPreset("custom"); },
    showAllSeverities: () => { setSeverities(allCrisisSeverities); setPreset("custom"); },
    emergencyDefault: () => { setVisible(emergencyLayerVisibility); setSeverities(emergencyCrisisSeverities); setPreset("emergency"); },
    clearAll: () => { setVisible(clearLayerVisibility); setSeverities([]); setPreset("clear"); },
    setFilterOpen,
  }), [visible, severities, preset, filterOpen]);
  return <CrisisMapContext.Provider value={value}>{children}</CrisisMapContext.Provider>;
}

export function useCrisisMap() { const context = useContext(CrisisMapContext); if (!context) throw new Error("useCrisisMap must be used within CrisisMapProvider"); return context; }
