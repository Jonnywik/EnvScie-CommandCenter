import { useState } from "react";
import type { CommandCenterTab } from "./contracts";

export const commandCenterNavigationItems: Array<{ icon: string; label: CommandCenterTab }> = [
  { icon: "▦", label: "Overview" }, { icon: "↯", label: "Incident Triage" }, { icon: "▰", label: "Fleet & Responder Safety" }, { icon: "◫", label: "DRRMO Intelligence" },
  { icon: "!", label: "Live SOS" }, { icon: "◈", label: "Verified Alerts" }, { icon: "☁", label: "Provincial Weather" }, { icon: "⌖", label: "Risk Map" },
  { icon: "⌂", label: "Evacuation Centers" }, { icon: "▣", label: "Resources" }, { icon: "◎", label: "Response Groups" }, { icon: "◌", label: "Communications" },
];

export function CommandCenterNavigation({ activeTab, onNavigate, className = "" }: { activeTab: CommandCenterTab; onNavigate: (tab: CommandCenterTab) => void; className?: string }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("cfr_navigation_collapsed") === "true");
  const setNavigationCollapsed = (next: boolean) => { setCollapsed(next); window.localStorage.setItem("cfr_navigation_collapsed", String(next)); };
  return <aside className={`sidebar unified-command-sidebar ${collapsed ? "is-collapsed" : ""} ${className}`.trim()} aria-label="Command Center workspaces"><button className="nav-collapse-toggle" type="button" onClick={() => setNavigationCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls="unified-command-navigation" aria-label={collapsed ? "Expand Command Center navigation" : "Collapse Command Center navigation"} title={collapsed ? "Expand Command Center navigation" : "Collapse Command Center navigation"}><span aria-hidden="true">{collapsed ? "›" : "‹"}</span><b>{collapsed ? "Expand" : "Collapse"}</b></button><div className="sidebar-label">Command center</div><nav id="unified-command-navigation" className="unified-command-navigation">{commandCenterNavigationItems.map((item) => <button key={item.label} type="button" className={`nav-item ${activeTab === item.label ? "active" : ""}`} aria-current={activeTab === item.label ? "page" : undefined} aria-label={item.label} onClick={() => onNavigate(item.label)} title={item.label}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</nav></aside>;
}
