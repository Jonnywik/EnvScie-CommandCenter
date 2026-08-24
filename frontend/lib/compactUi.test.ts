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
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/FacilityVerification.tsx"), "utf8"),
  readFileSync(resolve(process.cwd(), "components/dashboard-tabs/GoogleOperationalMap.tsx"), "utf8"),
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
    expect(workspaceSource).not.toContain("Responder radar");
    expect(workspaceSource).toContain("Mass Area Notification");
    expect(workspaceSource).toContain("Live Weather Radar");
    expect(workspaceSource).toContain("Flood Risk Zones");
    expect(workspaceSource).toContain("PAGASA Radar/QPE");
    expect(workspaceSource).toContain("PAGASA Stations");
    expect(workspaceSource).toContain("Himawari Context");
    expect(workspaceSource).toContain("Licensed Lightning");
    expect(workspaceSource).toContain("Provider access pending");
    expect(workspaceSource).toContain("getNoahMapContext");
    expect(workspaceSource).toContain("noahFlood: commandLayers.noahFlood");
    expect(workspaceSource).toContain("noahLandslide: commandLayers.noahLandslide");
    expect(workspaceSource).toContain("noahStormSurge: commandLayers.noahStormSurge");
    expect(workspaceSource).toContain("const noahOverlayUrl = new URL(layer.overlay_url, window.location.origin).toString()");
    expect(workspaceSource).toContain("const noahOverlay = new maps.GroundOverlay");
    expect(workspaceSource).toContain("noahOverlay.setMap(map)");
    expect(workspaceSource).toContain("getOfficialFacilityRegistry");
    expect(workspaceSource).toContain("PROJECT NOAH · REFERENCE");
    expect(workspaceSource).toContain("Flood · 100-year rain return");
    expect(workspaceSource).toContain("Open NOAH Studio facility context");
    expect(workspaceSource).toContain("critical_facilities.message");
    expect(workspaceSource).toContain("OFFICIAL FACILITY REFERENCE");
    expect(workspaceSource).toContain("FacilityVerificationWorkspace");
    expect(workspaceSource).toContain("LGU/DRRMO facility verification");
    expect(workspaceSource).toContain("Record source-pin, contact, and reported-access checks without inferring readiness");
    expect(workspaceSource).toContain("Source document or reference");
    expect(workspaceSource).toContain("Revalidation due");
    expect(workspaceSource).toContain("Schedule a renewed human check");
    expect(workspaceSource).toContain("Entries are auditable records of human reference checks");
    expect(workspaceSource).toContain("Record verification");
    expect(workspaceSource).toContain("Verification history");
    expect(workspaceSource).toContain("getFacilityVerifications");
    expect(workspaceSource).toContain("createFacilityVerification");
    expect(workspaceSource).toContain("Official facility registry controls");
    expect(workspaceSource).toContain("Show source records");
    expect(workspaceSource).toContain("Rural health units");
    expect(workspaceSource).toContain("coordinate_validation_status.replaceAll");
    expect(workspaceSource).toContain("Registry inclusion does not confirm staffing");
    expect(workspaceSource).toContain("getMapOverlays");
    expect(workspaceSource).toContain("CommandMapSourceHealthTool");
    expect(workspaceSource).toContain("SOURCE HEALTH");
    expect(workspaceSource).toContain("Freshness, provenance &amp; review");
    expect(workspaceSource).toContain("Record human review");
    expect(workspaceSource).toContain("reviewMapSource");
    expect(workspaceSource).toContain('activeUtilityPanel === "sources"');
    expect(workspaceSource).toContain("They do not refresh a provider, validate a hazard, clear a route, or authorize public action");
    expect(workspaceSource).toContain("command-map-layer-rail");
    expect(workspaceSource).toContain("CommandMapTriageFilterTool");
    expect(workspaceSource).toContain("cfr_command_map_triage_filters");
    expect(workspaceSource).toContain("Filters focus the map but do not alter, resolve, or remove operational records");
    expect(workspaceSource).toContain("Open Incident triage");
    expect(workspaceSource).toContain("Open Field response");
    expect(workspaceSource).toContain("Open Community safety");
    expect(workspaceSource).toContain("selectedResourceId");
    expect(workspaceSource).toContain("selectedCenterId");
    expect(workspaceSource).toContain("selectedSosId");
    expect(workspaceSource).toContain('aria-controls="command-map-layer-drawer"');
    expect(workspaceSource).toContain("CommandCenterNavigation");
    expect(workspaceSource).toContain("GoogleOperationalMap");
    expect(workspaceSource).toContain("GOOGLE_MAPS_SCRIPT_ID");
    expect(workspaceSource).toContain("retryTimer = window.setTimeout(() => initialize(1), 700)");
    expect(workspaceSource).toContain("googleMapsPromise = null");
    expect(workspaceSource).toContain("googleMapTilesReady");
    expect(workspaceSource).toContain('"tilesloaded"');
    expect(workspaceSource).toContain("onSelectCenter");
    expect(workspaceSource).toContain("onSelectSos");
    expect(workspaceSource).toContain("MapInspectablePin");
    expect(workspaceSource).toContain("map-pin-sheet");
    expect(workspaceSource).toContain("Inspect evacuation center");
    expect(workspaceSource).toContain("Inspect SOS alert");
    expect(workspaceSource).toContain("Verify with the reporting party, center coordinator, and field teams");
    expect(workspaceSource).toContain('"satellite"');
    expect(workspaceSource).toContain("command-map-basemap-controls");
    expect(workspaceSource).toContain("supported through map zoom");
    expect(workspaceSource).toContain("rainviewerMaxZoom");
    expect(workspaceSource).toContain("(!googleMapTilesReady || googleMapError) && <svg");
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
    expect(workspaceSource).toContain("command-map-sidebar");
    expect(workspaceSource).not.toContain('className="command-map-quicklinks"');
    expect(workspaceSource).toContain("CommandMapUtilityPanel");
    expect(workspaceSource).toContain("activeUtilityPanel");
    expect(workspaceSource).toContain('activeUtilityPanel === "view"');
    expect(workspaceSource).toContain('activeUtilityPanel === "triage"');
    expect(workspaceSource).toContain('activeUtilityPanel === "facilities"');
    expect(workspaceSource).toContain("map-control-dock");
    expect(workspaceSource).toContain('event.key === "Escape"');
    expect(workspaceSource).toContain("Map view");
    expect(workspaceSource).toContain("Triage");
    expect(workspaceSource).toContain("Facilities");
    expect(workspaceSource).toContain('"Command Map"');
    expect(workspaceSource).toContain('"Incidents"');
    expect(workspaceSource).toContain('"Field Response"');
    expect(workspaceSource).toContain('"Community Safety"');
    expect(workspaceSource).toContain('"Intelligence"');
    expect(workspaceSource).not.toContain("Open Command Center navigation");
    expect(workspaceSource).toContain("Switch to ${targetMode} mode");
    expect(workspaceSource).toContain("appearance-${appearance}");
    expect(dashboardSource).toContain("cfr_appearance");
    expect(dashboardSource).toContain("selectedIncidentId={selected?.id}");
    expect(dashboardSource).toContain("topbar-actions");
    expect(workspaceSource).toContain("workspace-appearance-toggle");
    expect(workspaceSource).toContain("IncidentTriageView");
    expect(workspaceSource).toContain("HUMAN-CONFIRMED DISPATCH LIFECYCLE");
    expect(workspaceSource).toContain("Open dispatch confirmation");
    expect(workspaceSource).toContain("I confirm I am recording a human decision to task this group");
    expect(workspaceSource).toContain("Record reported unit acknowledgement");
    expect(workspaceSource).toContain("Immutable lifecycle timeline");
    expect(workspaceSource).toContain("Notification receipt is separate from a responder’s reported dispatch acknowledgement");
    expect(workspaceSource).toContain("getDispatchLifecycle");
    expect(workspaceSource).toContain("transitionDispatchLifecycle");
    expect(workspaceSource).toContain("FleetResponderSafetyView");
    expect(workspaceSource).toContain("DISPATCH LIFECYCLE · SELECTED UNIT");
    expect(workspaceSource).toContain("Open Triage confirmation");
    expect(workspaceSource).toContain("Record reported acknowledgement");
    expect(workspaceSource).toContain("notification receipt was not used as acknowledgement");
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
    expect(stylesSource).toContain(".command-map-filter-rail");
    expect(stylesSource).toContain(".command-map-triage-drawer");
    expect(stylesSource).toContain(".map-control-dock");
    expect(stylesSource).toContain("--map-control-panel-width");
    expect(stylesSource).toContain("--map-control-panel-bottom-reserve");
    expect(stylesSource).toContain("calc(var(--map-control-dock-right) + var(--map-control-dock-width) + var(--map-control-panel-gap))");
    expect(stylesSource).toContain(".command-map-topbar");
    expect(stylesSource).toContain(".mass-notification-modal");
    expect(stylesSource).toContain('html[data-appearance="dark"]');
    expect(stylesSource).toContain(".command-map-shell.appearance-light");
    expect(stylesSource).toContain(".workspace-navigation-shell");
    expect(stylesSource).toContain(".command-map-sidebar");
    expect(stylesSource).toContain(".sidebar.is-collapsed");
    expect(stylesSource).toContain(".nav-collapse-toggle");
    expect(stylesSource).toContain("--command-map-header-clearance: 94px");
    expect(stylesSource).toContain("--command-map-dock-width: 68px");
    expect(stylesSource).toContain("--command-map-mobile-radar-reserve: 132px");
    expect(stylesSource).toContain(".command-map-topbar { position: fixed; z-index: 40; top: var(--command-map-header-top); left: calc(var(--command-map-dock-width) + var(--command-map-dock-gutter))");
    expect(stylesSource).toContain(".command-map-sidebar { position: fixed; z-index: 35; top: 0; bottom: 0; left: 0;");
    expect(stylesSource).toContain("padding: calc(var(--command-map-header-clearance) + 10px) 9px 18px");
    expect(stylesSource).toContain(".command-map-sidebar .nav-collapse-toggle { position: sticky; top: 0; z-index: 1; border-color:");
    expect(stylesSource).toContain(".command-map-topbar { left: 18px; }");
    expect(stylesSource).toContain(".command-map-sidebar { z-index: 45; top: var(--command-map-header-clearance); right: 64px; bottom: auto; left: 9px;");
    expect(stylesSource).toContain('html[data-appearance="light"] .command-map-sidebar.sidebar');
    expect(stylesSource).toContain(".functional-view-selector");
    expect(stylesSource).toContain(".google-operational-map");
    expect(stylesSource).toContain(".command-map-basemap-controls");
    expect(stylesSource).toContain(".layer-switch-group");
    expect(stylesSource).toContain(".layer-switch.pending");
    expect(stylesSource).toContain(".map-pin-sheet");
    expect(stylesSource).toContain(".official-facility-layer");
    expect(stylesSource).toContain(".official-facility-panel");
    expect(stylesSource).toContain(".gis-marker.selected");
    expect(stylesSource).toContain(".nav-item:focus-visible");
    expect(stylesSource).toContain("Appearance compliance: shared legacy surfaces");
    expect(stylesSource).toContain('html[data-appearance="dark"] .sidebar');
    expect(stylesSource).toContain('html[data-appearance="dark"] .panel');
    expect(stylesSource).toContain('html[data-appearance="light"] .panel');
  });

  it("keeps Command Map visibility controls compact, mutually exclusive, and protected from radar overlap", () => {
    expect(workspaceSource).toContain("overlayOnExpand");
    expect(workspaceSource).toContain("command-map-navigation-backdrop");
    expect(workspaceSource).toContain("is-overlay-open");
    expect(workspaceSource).toContain("command-map-tools-trigger");
    expect(workspaceSource).toContain("command-map-tools-menu");
    expect(workspaceSource).toContain("selectMapTool");
    expect(workspaceSource).toContain('renderTrigger={false}');
    expect(workspaceSource).toContain("renderFacilityTrigger={false}");
    expect(workspaceSource).toContain("radar-removed");
    expect(workspaceSource).not.toContain("responder-radar-toggle");
    expect(workspaceSource).not.toContain("active field units");
    expect(workspaceSource).toContain("critical-sos-map-label");
    expect(workspaceSource).toContain("addCriticalSosLabel");
    expect(workspaceSource).toContain("MarkerClusterer");
    expect(workspaceSource).toContain("sosClustererRef");
    expect(workspaceSource).toContain("nearby SOS incidents. Select to zoom in.");
    expect(workspaceSource).toContain("targetMap.fitBounds(cluster.bounds, 72)");
    expect(workspaceSource).toContain("hoveredSosId");
    expect(workspaceSource).toContain('state: "active" | "hovered"');
    expect(workspaceSource).toContain("is-active");
    expect(workspaceSource).toContain("is-hovered");
    expect(workspaceSource).toContain('incident.severity === "critical"');
    expect(workspaceSource).toContain("Reported SOS ·");
    expect(stylesSource).toContain("--responder-radar-reserve");
    expect(stylesSource).toContain(".command-map-workspace.radar-removed");
    expect(stylesSource).toContain(".command-map-hero .gis-legend");
    expect(stylesSource).toContain(".map-control-dock-zoom { grid-template-columns: 1fr");
    expect(stylesSource).toContain(".critical-sos-map-label");
    expect(stylesSource).toContain(".critical-sos-map-label.is-active");
    expect(stylesSource).toContain(".critical-sos-map-label.is-hovered");
    expect(stylesSource).toContain("pointer-events: none");
  });

  it("contains wheel and touch gestures within the operational map", () => {
    expect(workspaceSource).toContain("const mapShellRef = useRef<HTMLDivElement | null>(null)");
    expect(workspaceSource).toContain('mapShell.addEventListener("wheel", containWheel, { passive: false })');
    expect(workspaceSource).toContain('mapShell.addEventListener("touchmove", containTouchMove, { passive: false })');
    expect(workspaceSource).toContain("ref={mapShellRef}");
    expect(stylesSource).toContain("overscroll-behavior: contain");
    expect(stylesSource).toContain("touch-action: none");
  });

  it("keeps narrow Command Map controls contained with safe space for the responder radar", () => {
    expect(stylesSource).toContain(".command-map-shell { min-height: 100dvh; overflow: hidden;");
    expect(stylesSource).toContain(".responder-radar { position: fixed");
    expect(stylesSource).toContain(".command-map-layer-drawer, .command-map-triage-drawer { width: min(258px, calc(100vw - 72px)); max-height: calc(100dvh - var(--command-map-mobile-layer-top) - var(--command-map-mobile-radar-reserve) - var(--command-map-mobile-overlay-gutter));");
    expect(stylesSource).toContain(".map-pin-sheet { top: auto; bottom: var(--command-map-mobile-radar-reserve);");
    expect(stylesSource).toContain(".broadcast-fab { right: auto; bottom: calc(var(--command-map-mobile-radar-reserve) + 8px); left: 17px;");
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(stylesSource).toContain(".gis-tool-rail { position: absolute");
    expect(stylesSource).toContain(".command-map-layer-rail { position: relative");
    expect(stylesSource).toContain(".command-map-layer-rail.is-open .command-map-layer-trigger");
    expect(stylesSource).toContain(".command-map-filter-rail.is-open .command-map-filter-trigger");
    expect(stylesSource).toContain(".map-pin-sheet { position: absolute; z-index: 13; top: 116px; left: calc(var(--command-map-dock-width) + var(--command-map-dock-gutter))");
    expect(stylesSource).toContain(".command-map-sidebar.sidebar:not(.is-collapsed) + .command-map-shell .map-pin-sheet { left: 264px;");
    expect(stylesSource).toContain(".command-map-shell:has(.map-pin-sheet) .broadcast-fab");
    expect(stylesSource).toContain(".command-map-shell:has(.official-facility-layer.is-open) .broadcast-fab");
    expect(stylesSource).toContain("@media (max-width: 760px) and (max-height: 520px)");
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
