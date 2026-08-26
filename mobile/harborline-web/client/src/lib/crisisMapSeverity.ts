export const crisisSeverityOptions = ["advisory", "watch", "warning", "critical"] as const;
export type CrisisSeverity = (typeof crisisSeverityOptions)[number];

export const allCrisisSeverities: CrisisSeverity[] = [...crisisSeverityOptions];
export const emergencyCrisisSeverities: CrisisSeverity[] = ["warning", "critical"];

export function toggleCrisisSeverity(current: CrisisSeverity[], severity: CrisisSeverity): CrisisSeverity[] {
  return current.includes(severity) ? current.filter((item) => item !== severity) : [...current, severity];
}
