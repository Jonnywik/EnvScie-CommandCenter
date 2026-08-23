import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");
const workspaceSource = [
  dashboardSource,
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/AppearanceToggle.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/contracts.ts"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/CommandCenterNavigation.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/CommandMap.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/IncidentTriage.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/FleetSafety.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/Intelligence.tsx"), "utf8"),
].join("\n");
const stylesSource = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("compact operational interface", () => {
  it("removes the quick-guide entry point while retaining the active workspace title and refresh control", () => {
    expect(dashboardSource).not.toContain("⌨ Quick keys");
    expect(dashboardSource).toContain("<h1>{pageMeta[tab].title}</h1>");
    expect(dashboardSource).toContain("↻ Refresh");
  });

  it("hides guide-only descriptions while preserving critical manual-intake safety context", () => {
    expect(stylesSource).toContain("Compact operational mode");
    expect(stylesSource).toContain(".page-heading > div > p");
    expect(stylesSource).toContain(".subtab-intro { display: none; }");
    expect(stylesSource).not.toContain(".subtab-intro { display: flex;");
    expect(stylesSource).toContain(".provincial-weather-grid > .panel:nth-child(2) { display: none; }");
    expect(stylesSource).toContain(".manual-intake-form .callout");
    expect(stylesSource).toContain("display: flex;");
  });

  it("removes the requested Overview planning and posture panels", () => {
    expect(dashboardSource).not.toContain("Incident objectives");
    expect(dashboardSource).not.toContain("Operational task board");
    expect(dashboardSource).not.toContain("Responder posture");
    expect(dashboardSource).not.toContain("<ObjectiveBoard");
  });

  it("uses a compact rapid-information dashboard layout on the Overview", () => {
    expect(dashboardSource).toContain("overview-command-grid");
    expect(dashboardSource).toContain("OverviewQuickActions");
    expect(dashboardSource).toContain("overview-queues-grid");
    expect(workspaceSource).toContain('title="Operational checks"');
    expect(stylesSource).toContain(".overview-command-grid");
    expect(stylesSource).toContain(".overview-queues-grid");
    expect(stylesSource).toContain(".quick-actions-grid");
  });

  it("renders the map-first Command Map dashboard with protected operational controls", () => {
    expect(workspaceSource).toContain("CommandMapView");
    expect(workspaceSource).toContain('variant="command"');
    expect(workspaceSource).toContain("EnvScie CommandCenter");
    expect(workspaceSource).not.toContain("PRIORITY FEED");
    expect(workspaceSource).not.toContain("Situational awareness");
    expect(workspaceSource).toContain("Responder radar");
    expect(workspaceSource).toContain("Mass Area Notification");
    expect(workspaceSource).toContain("Live Weather Radar");
    expect(workspaceSource).toContain("Flood Risk Zones");
    expect(workspaceSource).toContain("PAGASA Radar/QPE");
    expect(workspaceSource).toContain("PAGASA Stations");
    expect(workspaceSource).toContain("Himawari Context");
    expect(workspaceSource).toContain("Licensed Lightning");
    expect(workspaceSource).toContain("Provider access pending");
    expect(workspaceSource).toContain("Provider procurement pending");
    expect(workspaceSource).toContain("getMapOverlays");
    expect(workspaceSource).toContain("command-map-layer-rail");
    expect(workspaceSource).toContain('aria-controls="command-map-layer-drawer"');
    expect(workspaceSource).toContain("CommandCenterNavigation");
    expect(workspaceSource).toContain("GoogleOperationalMap");
    expect(workspaceSource).toContain("onSelectCenter");
    expect(workspaceSource).toContain("onSelectSos");
    expect(workspaceSource).toContain("MapInspectablePin");
    expect(workspaceSource).toContain("map-pin-sheet");
    expect(workspaceSource).toContain("Inspect evacuation center");
    expect(workspaceSource).toContain("Inspect SOS alert");
    expect(workspaceSource).toContain("Verify with the reporting party, center coordinator, and field teams");
    expect(workspaceSource).toContain('"satellite"');
    expect(workspaceSource).toContain("command-map-basemap-controls");
    expect(workspaceSource).toContain("regional scale ≤10");
    expect(workspaceSource).toContain("{googleMapError && <svg");
    expect(workspaceSource).toContain("Google Maps {googleBasemap");
    expect(workspaceSource).toContain("unified-command-sidebar");
    expect(workspaceSource).toContain("Command Center workspaces");
    expect(workspaceSource).toContain("cfr_navigation_collapsed");
    expect(workspaceSource).toContain("Collapse Command Center navigation");
    expect(workspaceSource).toContain("Expand Command Center navigation");
    expect(workspaceSource).toContain("commandWorkspaces");
    expect(workspaceSource).toContain("workspace.defaultTab");
    expect(workspaceSource).toContain("aria-label={workspace.id}");
    expect(workspaceSource).toContain("FunctionalViewSelector");
    expect(workspaceSource).toContain("aria-current={activeTab === view ? \"page\" : undefined}");
    expect(workspaceSource).toContain("1–5");
    expect(workspaceSource).toContain('"Command Map"');
    expect(workspaceSource).toContain('"Incidents"');
    expect(workspaceSource).toContain('"Field Response"');
    expect(workspaceSource).toContain('"Community Safety"');
    expect(workspaceSource).toContain('"Intelligence"');
    expect(workspaceSource).not.toContain("Open Command Center navigation");
    expect(workspaceSource).toContain("Switch to ${targetMode} mode");
    expect(workspaceSource).toContain("appearance-${appearance}");
    expect(dashboardSource).toContain("cfr_appearance");
    expect(dashboardSource).toContain("topbar-actions");
    expect(workspaceSource).toContain("workspace-appearance-toggle");
    expect(workspaceSource).toContain("IncidentTriageView");
    expect(workspaceSource).toContain("FleetResponderSafetyView");
    expect(workspaceSource).toContain("IntelligenceDashboardView");
    expect(workspaceSource).toContain("Fleet & Responder Safety");
    expect(workspaceSource).toContain("DRRMO Intelligence");
    expect(workspaceSource).toContain("Verified Alerts");
    expect(workspaceSource).toContain("Provincial Weather");
    expect(workspaceSource).toContain("Evacuation Centers");
    expect(workspaceSource).toContain("Response Groups");
    expect(workspaceSource).toContain("Communications");
    expect(workspaceSource).toContain("incident-response-packet");
    expect(workspaceSource).toContain("Incident response packet");
    expect(workspaceSource).toContain("Verification, hazard review, responder tasking");
    expect(stylesSource).toContain(".command-map-shell");
    expect(stylesSource).toContain(".command-map-topbar");
    expect(stylesSource).toContain(".mass-notification-modal");
    expect(stylesSource).toContain('html[data-appearance="dark"]');
    expect(stylesSource).toContain(".command-map-shell.appearance-light");
    expect(stylesSource).toContain(".workspace-navigation-shell");
    expect(stylesSource).toContain(".command-map-sidebar");
    expect(stylesSource).toContain(".sidebar.is-collapsed");
    expect(stylesSource).toContain(".nav-collapse-toggle");
    expect(stylesSource).toContain(".functional-view-selector");
    expect(stylesSource).toContain(".google-operational-map");
    expect(stylesSource).toContain(".command-map-basemap-controls");
    expect(stylesSource).toContain(".layer-switch-group");
    expect(stylesSource).toContain(".layer-switch.pending");
    expect(stylesSource).toContain(".map-pin-sheet");
    expect(stylesSource).toContain(".gis-marker.selected");
    expect(stylesSource).toContain(".nav-item:focus-visible");
    expect(stylesSource).toContain("Appearance compliance: shared legacy surfaces");
    expect(stylesSource).toContain('html[data-appearance="dark"] .sidebar');
    expect(stylesSource).toContain('html[data-appearance="dark"] .panel');
    expect(stylesSource).toContain('html[data-appearance="light"] .panel');
  });

  it("contains wheel and touch gestures within the operational map", () => {
    expect(workspaceSource).toContain("const mapShellRef = useRef<HTMLDivElement | null>(null)");
    expect(workspaceSource).toContain('mapShell.addEventListener("wheel", containWheel, { passive: false })');
    expect(workspaceSource).toContain('mapShell.addEventListener("touchmove", containTouchMove, { passive: false })');
    expect(workspaceSource).toContain("ref={mapShellRef}");
    expect(stylesSource).toContain("overscroll-behavior: contain");
    expect(stylesSource).toContain("touch-action: none");
  });

  it("keeps narrow Command Map controls contained and separates the broadcast action from the responder radar", () => {
    expect(stylesSource).toContain(".command-map-shell { min-height: 100dvh; overflow: hidden;");
    expect(stylesSource).toContain(".responder-radar { position: fixed");
    expect(stylesSource).toContain(".broadcast-fab { right: auto; bottom: 190px; left: 17px;");
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(stylesSource).toContain(".gis-tool-rail { position: absolute");
    expect(stylesSource).toContain(".command-map-layer-rail { position: relative");
    expect(stylesSource).toContain(".command-map-layer-rail.is-open .command-map-layer-trigger");
    expect(stylesSource).toContain(".command-map-navigation { position: fixed");
    expect(stylesSource).toContain(".command-map-navigation-list { display: grid");
    expect(stylesSource).toContain(".command-map-shell:has(.command-map-navigation.is-open) .broadcast-fab");
  });

  it("provides a selectable split-pane Incident Triage workspace with guarded recommendations", () => {
    expect(dashboardSource).toContain('"Incident Triage"');
    expect(workspaceSource).toContain("IncidentTriageView");
    expect(workspaceSource).toContain("Incoming Alerts");
    expect(workspaceSource).toContain("Sort by Severity");
    expect(workspaceSource).toContain("Codec decoder");
    expect(workspaceSource).toContain("LGU verification checklist");
    expect(workspaceSource).toContain("WMCDA DISPATCH RECOMMENDATIONS");
    expect(workspaceSource).toContain("getDispatchRecommendations");
    expect(workspaceSource).toContain("assignResponseGroup");
    expect(workspaceSource).toContain("!verificationComplete");
    expect(workspaceSource).toContain("lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]");
  });

  it("provides a responsive Fleet and Responder Safety workspace with advisory safety safeguards", () => {
    expect(dashboardSource).toContain('"Fleet & Responder Safety"');
    expect(workspaceSource).toContain("FleetResponderSafetyView");
    expect(workspaceSource).toContain("TOTAL FLEET READINESS");
    expect(workspaceSource).toContain("SAFETY BREACHES");
    expect(workspaceSource).toContain("DEPLOYMENT MATRIX");
    expect(workspaceSource).toContain("HAZARD PROXIMITY MONITOR");
    expect(workspaceSource).toContain("DYNAMIC ROUTING CONSOLE");
    expect(workspaceSource).toContain("lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]");
    expect(workspaceSource).toContain("setSelectedId(unit.group.id)");
    expect(workspaceSource).toContain("optimizeGisRoute");
    expect(workspaceSource).toContain("No mobile delivery endpoint is configured");
    expect(workspaceSource).toContain("OPERATOR CONFIRMATION");
    expect(workspaceSource).toContain("does not force a field reroute");
  });

  it("provides DRRMO Intelligence with bounded immutable audit review and deliberate exports", () => {
    expect(dashboardSource).toContain('"DRRMO Intelligence"');
    expect(workspaceSource).toContain("IntelligenceDashboardView");
    expect(workspaceSource).toContain('aria-label="System health and analytics grid"');
    expect(workspaceSource).toContain("IMMUTABLE ACTION LEDGER");
    expect(workspaceSource).toContain("AUTOMATED LGU REPORTING");
    expect(workspaceSource).toContain("getAuditEvents(200)");
    expect(workspaceSource).toContain("filteredEvents.slice(0, 150)");
    expect(workspaceSource).toContain("Filters change this view only; they never alter the ledger.");
    expect(workspaceSource).toContain("intelligence.audit_ledger_export_compiled");
    expect(workspaceSource).toContain("not signed official forms and require local approval");
    expect(workspaceSource).toContain("No socket-health metric reported");
  });
});
