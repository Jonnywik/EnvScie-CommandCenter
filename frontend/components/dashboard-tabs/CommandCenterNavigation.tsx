import type { CommandCenterTab } from "./contracts";

export const commandCenterNavigationItems: Array<{ icon: string; label: CommandCenterTab }> = [
  { icon: "▦", label: "Overview" }, { icon: "↯", label: "Incident Triage" }, { icon: "▰", label: "Fleet & Responder Safety" }, { icon: "◫", label: "DRRMO Intelligence" },
  { icon: "!", label: "Live SOS" }, { icon: "◈", label: "Verified Alerts" }, { icon: "☁", label: "Provincial Weather" }, { icon: "⌖", label: "Risk Map" },
  { icon: "⌂", label: "Evacuation Centers" }, { icon: "▣", label: "Resources" }, { icon: "◎", label: "Response Groups" }, { icon: "◌", label: "Communications" },
];

export function CommandCenterNavigation({ activeTab, onNavigate, className = "" }: { activeTab: CommandCenterTab; onNavigate: (tab: CommandCenterTab) => void; className?: string }) {
  return <aside className={`sidebar unified-command-sidebar ${className}`.trim()} aria-label="Command Center workspaces"><div className="sidebar-label">Command center</div><nav className="unified-command-navigation">{commandCenterNavigationItems.map((item) => <button key={item.label} type="button" className={`nav-item ${activeTab === item.label ? "active" : ""}`} aria-current={activeTab === item.label ? "page" : undefined} onClick={() => onNavigate(item.label)}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</nav></aside>;
}
