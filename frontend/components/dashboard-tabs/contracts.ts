export type CommandCenterTab = "Overview" | "Incident Triage" | "Fleet & Responder Safety" | "DRRMO Intelligence" | "Live SOS" | "Verified Alerts" | "Provincial Weather" | "Risk Map" | "Evacuation Centers" | "Resources" | "Response Groups" | "Communications";

export type CommandWorkspace = "Command Map" | "Incidents" | "Field Response" | "Community Safety" | "Intelligence";

export type WorkspaceDefinition = { id: CommandWorkspace; icon: string; defaultTab: CommandCenterTab; views: CommandCenterTab[] };

export const commandWorkspaces: WorkspaceDefinition[] = [
  { id: "Command Map", icon: "▦", defaultTab: "Overview", views: ["Overview"] },
  { id: "Incidents", icon: "↯", defaultTab: "Live SOS", views: ["Live SOS", "Incident Triage", "Verified Alerts"] },
  { id: "Field Response", icon: "▰", defaultTab: "Fleet & Responder Safety", views: ["Fleet & Responder Safety", "Response Groups", "Resources", "Communications"] },
  { id: "Community Safety", icon: "⌂", defaultTab: "Provincial Weather", views: ["Provincial Weather", "Risk Map", "Evacuation Centers"] },
  { id: "Intelligence", icon: "◫", defaultTab: "DRRMO Intelligence", views: ["DRRMO Intelligence"] },
];

export function workspaceForTab(tab: CommandCenterTab): WorkspaceDefinition {
  return commandWorkspaces.find((workspace) => workspace.views.includes(tab)) || commandWorkspaces[0];
}

export type OperationalAction = (action: string, type: string, id?: string, note?: string) => Promise<void>;
