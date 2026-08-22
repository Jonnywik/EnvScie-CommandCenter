import type { AlertItem, NotificationSnapshot, SosIncident, UserIdentity } from "./api";

export type OperatorShortcut = "close" | "help" | "refresh" | "record-emergency" | "switch-tab";

export function resolveOperatorShortcut({
  key,
  editable,
  canRecordEmergency,
  tabCount,
}: {
  key: string;
  editable: boolean;
  canRecordEmergency: boolean;
  tabCount: number;
}): { action: OperatorShortcut; tabIndex?: number } | null {
  if (editable) return null;
  if (key === "Escape") return { action: "close" };
  if (key === "?") return { action: "help" };
  if (key.toLowerCase() === "r") return { action: "refresh" };
  if (key.toLowerCase() === "n" && canRecordEmergency) return { action: "record-emergency" };
  const tabIndex = Number(key);
  if (tabIndex >= 1 && tabIndex <= tabCount) return { action: "switch-tab", tabIndex: tabIndex - 1 };
  return null;
}

export function buildShiftHandoff({
  incidents,
  alerts,
  notifications,
  now = new Date(),
}: {
  incidents: SosIncident[];
  alerts: AlertItem[];
  notifications: NotificationSnapshot;
  now?: Date;
}): string {
  const openIncidents = incidents.filter((incident) => incident.status === "received" || incident.status === "acknowledged");
  const priorityAlerts = alerts.filter((alert) => alert.severity === "critical" || alert.severity === "warning");
  return [
    `CODE FOR RESILIENCE · SHIFT HANDOFF · ${now.toLocaleString()}`,
    `Open SOS requiring attention: ${openIncidents.length}.`,
    ...openIncidents.map((incident) => `- ${incident.severity.toUpperCase()} ${incident.emergency_type} · ${incident.barangay} · ${incident.status} · ${incident.channel.toUpperCase()} · ${incident.summary}`),
    `Priority verified alerts: ${priorityAlerts.length}.`,
    ...priorityAlerts.map((alert) => `- ${alert.severity.toUpperCase()} · ${alert.title} · ${alert.source_name}`),
    `Pending response-group notifications: ${notifications.pending_count}; failed deliveries: ${notifications.failed_count}.`,
    "Before transfer: verify any cached record, confirm responder acknowledgement, and recheck the route against active hazards before dispatch.",
  ].join("\n");
}

export function canUseCoordinatorIntake(user: UserIdentity | null): boolean {
  return user?.role === "dispatcher" || user?.role === "admin";
}
