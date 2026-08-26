import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const TEXT_SCALE_MIN = 90;
export const TEXT_SCALE_MAX = 140;
export const TEXT_SCALE_STEP = 5;
export const TEXT_SCALE_DEFAULT = 100;
export const LARGE_TEXT_MIN_SCALE = 118;
export function clampTextScale(value: number) { const rounded = Math.round(value / TEXT_SCALE_STEP) * TEXT_SCALE_STEP; return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, rounded)); }

type AccessibilityValue = { largeText: boolean; highContrast: boolean; textScale: number; effectiveTextScale: number; setLargeText: (value: boolean) => void; setHighContrast: (value: boolean) => void; setTextScale: (value: number) => void };
const AccessibilityContext = createContext<AccessibilityValue | undefined>(undefined);
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [largeText, setLargeText] = useState(() => new URLSearchParams(window.location.search).get("largeText") === "1" || localStorage.getItem("harborline-large-text") === "true");
  const [highContrast, setHighContrast] = useState(() => new URLSearchParams(window.location.search).get("highContrast") === "1" || localStorage.getItem("harborline-high-contrast") === "true");
  const [textScale, setTextScaleState] = useState(() => { const preview = Number(new URLSearchParams(window.location.search).get("textScale")); const stored = Number(localStorage.getItem("harborline-text-scale")); return clampTextScale(Number.isFinite(preview) && preview > 0 ? preview : Number.isFinite(stored) && stored > 0 ? stored : TEXT_SCALE_DEFAULT); });
  const setTextScale = (value: number) => setTextScaleState(clampTextScale(value));
  const effectiveTextScale = largeText ? Math.max(textScale, LARGE_TEXT_MIN_SCALE) : textScale;
  useEffect(() => { document.documentElement.classList.toggle("large-text", largeText); localStorage.setItem("harborline-large-text", String(largeText)); }, [largeText]);
  useEffect(() => { document.documentElement.classList.toggle("high-contrast", highContrast); localStorage.setItem("harborline-high-contrast", String(highContrast)); }, [highContrast]);
  useEffect(() => { document.documentElement.style.setProperty("--harborline-text-scale", `${effectiveTextScale}%`); document.documentElement.dataset.textScale = String(effectiveTextScale); localStorage.setItem("harborline-text-scale", String(textScale)); }, [effectiveTextScale, textScale]);
  const value = useMemo(() => ({ largeText, highContrast, textScale, effectiveTextScale, setLargeText, setHighContrast, setTextScale }), [largeText, highContrast, textScale, effectiveTextScale]);
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}
export function useAccessibility() { const context = useContext(AccessibilityContext); if (!context) throw new Error("useAccessibility must be used within AccessibilityProvider"); return context; }
