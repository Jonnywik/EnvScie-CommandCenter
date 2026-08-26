export type CrisisDetailFeature = {
  layer: "weather" | "flood" | "faultLines" | "evacuationCenters" | "responseTeams" | "roadClosures" | "incidents";
  status?: string;
  severity?: string;
  properties: Record<string, string | number | boolean>;
};

export type CrisisDetailSheetModel = {
  category: "response-team" | "evacuation-center" | "road-closure" | "incident" | "map-feature";
  title: string;
  statusLabel: string;
  availableSlots: number | null;
  showPlaceholderNotice: boolean;
};

export function crisisFeatureName(feature: CrisisDetailFeature) {
  return typeof feature.properties.name === "string"
    ? feature.properties.name
    : typeof feature.properties.title === "string"
      ? feature.properties.title
      : feature.layer;
}

export function buildCrisisDetailSheet(feature: CrisisDetailFeature): CrisisDetailSheetModel {
  const isResponseTeam = feature.layer === "responseTeams";
  const isEvacuationCenter = feature.layer === "evacuationCenters";
  const isRoadClosure = feature.layer === "roadClosures";
  const isIncident = feature.layer === "incidents";
  return {
    category: isResponseTeam ? "response-team" : isEvacuationCenter ? "evacuation-center" : isRoadClosure ? "road-closure" : isIncident ? "incident" : "map-feature",
    title: crisisFeatureName(feature),
    statusLabel: feature.status ?? feature.severity ?? "Reference",
    availableSlots: typeof feature.properties.availableSlots === "number" ? feature.properties.availableSlots : null,
    showPlaceholderNotice: isResponseTeam,
  };
}

export function getCrisisMapSurfaceMode(tileOffline: boolean) {
  return tileOffline ? "cached-regional-snapshot" : "live-osm-tiles";
}
