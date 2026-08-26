export type CrisisLayerKey = "weather" | "flood" | "faultLines" | "evacuationCenters" | "responseTeams" | "roadClosures" | "incidents";
export type CrisisLayerVisibility = Record<CrisisLayerKey, boolean>;
export const emergencyLayerVisibility: CrisisLayerVisibility = { weather: true, flood: true, faultLines: false, evacuationCenters: true, responseTeams: true, roadClosures: true, incidents: true };
export const clearLayerVisibility: CrisisLayerVisibility = { weather: false, flood: false, faultLines: false, evacuationCenters: false, responseTeams: false, roadClosures: false, incidents: false };
export function toggleCrisisLayer(visible: CrisisLayerVisibility, key: CrisisLayerKey): CrisisLayerVisibility { return { ...visible, [key]: !visible[key] }; }
