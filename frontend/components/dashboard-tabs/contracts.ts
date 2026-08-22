export type CommandCenterTab = "Overview" | "Incident Triage" | "Fleet & Responder Safety" | "DRRMO Intelligence" | "Live SOS" | "Verified Alerts" | "Provincial Weather" | "Risk Map" | "Evacuation Centers" | "Resources" | "Response Groups" | "Communications";

export type OperationalAction = (action: string, type: string, id?: string, note?: string) => Promise<void>;
