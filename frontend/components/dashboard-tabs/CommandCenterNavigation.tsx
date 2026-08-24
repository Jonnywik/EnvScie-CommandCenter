import { useEffect, useState } from "react";
import { commandWorkspaces, type CommandCenterTab, type CommandWorkspace, workspaceForTab } from "./contracts";

const viewLabel: Record<CommandCenterTab, string> = {
  Overview: "Map",
  "Live SOS": "SOS Queue",
  "Incident Triage": "Triage & Dispatch",
  "Verified Alerts": "Verified Alerts",
  "Fleet & Responder Safety": "Fleet Safety",
  "Response Groups": "Teams & Assets",
  Resources: "Resource Logistics",
  Communications: "Communications",
  "Provincial Weather": "Weather & Warnings",
  "Risk Map": "Risk Context",
  "Evacuation Centers": "Evacuation Centers",
  "DRRMO Intelligence": "System Health",
};

export function CommandCenterNavigation({ activeTab, onNavigate, badges = {}, className = "", overlayOnExpand = false }: { activeTab: CommandCenterTab; onNavigate: (tab: CommandCenterTab) => void; badges?: Partial<Record<CommandWorkspace, number | string>>; className?: string; overlayOnExpand?: boolean }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("cfr_navigation_collapsed") === "true");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const activeWorkspace = workspaceForTab(activeTab).id;
  const setNavigationCollapsed = (next: boolean) => { setCollapsed(next); window.localStorage.setItem("cfr_navigation_collapsed", String(next)); };
  const railOnly = overlayOnExpand || collapsed;
  const closeOverlay = () => setOverlayOpen(false);
  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeOverlay(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlayOpen]);
  const toggleNavigation = () => overlayOnExpand ? setOverlayOpen((open) => !open) : setNavigationCollapsed(!collapsed);
  const navigationIsExpanded = overlayOnExpand ? overlayOpen : !collapsed;
  const buttonLabel = navigationIsExpanded ? "Collapse Command Center navigation" : "Expand Command Center navigation";
  return <>{overlayOnExpand && overlayOpen && <button className="command-map-navigation-backdrop" type="button" aria-label="Close Command Center navigation" onClick={closeOverlay} />}<aside className={`sidebar unified-command-sidebar ${railOnly ? "is-collapsed" : ""} ${overlayOpen ? "is-overlay-open" : ""} ${className}`.trim()} aria-label="Command Center workspaces"><button className="nav-collapse-toggle" type="button" onClick={toggleNavigation} aria-expanded={navigationIsExpanded} aria-controls="unified-command-navigation" aria-label={buttonLabel} title={buttonLabel}><span aria-hidden="true">{navigationIsExpanded ? "‹" : "›"}</span><b>{navigationIsExpanded ? "Collapse" : "Expand"}</b></button><div className="sidebar-label">Command center</div><nav id="unified-command-navigation" className="unified-command-navigation">{commandWorkspaces.map((workspace) => <button key={workspace.id} type="button" className={`nav-item ${activeWorkspace === workspace.id ? "active" : ""}`} aria-current={activeWorkspace === workspace.id ? "page" : undefined} aria-label={workspace.id} onClick={() => { onNavigate(workspace.defaultTab); closeOverlay(); }} title={workspace.id}><span className="nav-icon" aria-hidden="true">{workspace.icon}</span><span>{workspace.id}</span>{badges[workspace.id] != null && <span className="nav-notification-badge">{badges[workspace.id]}</span>}</button>)}</nav></aside></>;
}

export function FunctionalViewSelector({ activeTab, onNavigate, className = "" }: { activeTab: CommandCenterTab; onNavigate: (tab: CommandCenterTab) => void; className?: string }) {
  const workspace = workspaceForTab(activeTab);
  if (workspace.views.length < 2) return null;
  return <nav className={`functional-view-selector ${className}`.trim()} aria-label={`${workspace.id} views`}>{workspace.views.map((view) => <button key={view} type="button" aria-current={activeTab === view ? "page" : undefined} className={activeTab === view ? "active" : ""} onClick={() => onNavigate(view)}>{viewLabel[view]}</button>)}</nav>;
}
