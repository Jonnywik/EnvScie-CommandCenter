import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");
const workspaceSource = [
  dashboardSource,
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
    expect(workspaceSource).toContain("Situational awareness");
    expect(workspaceSource).toContain("Responder radar");
    expect(workspaceSource).toContain("Mass Area Notification");
    expect(workspaceSource).toContain("Live Weather Radar");
    expect(workspaceSource).toContain("Flood Risk Zones");
    expect(stylesSource).toContain(".command-map-shell");
    expect(stylesSource).toContain(".command-map-topbar");
    expect(stylesSource).toContain(".mass-notification-modal");
  });

  it("contains wheel and touch gestures within the operational map", () => {
    expect(workspaceSource).toContain("const mapShellRef = useRef<HTMLDivElement | null>(null)");
    expect(workspaceSource).toContain('mapShell.addEventListener("wheel", containWheel, { passive: false })');
    expect(workspaceSource).toContain('mapShell.addEventListener("touchmove", containTouchMove, { passive: false })');
    expect(workspaceSource).toContain("ref={mapShellRef}");
    expect(stylesSource).toContain("overscroll-behavior: contain");
    expect(stylesSource).toContain("touch-action: none");
  });

  it("keeps narrow Command Map panels contained and separates the broadcast action from the responder radar", () => {
    expect(stylesSource).toContain(".situational-panel { position: fixed");
    expect(stylesSource).toContain("overflow-x: hidden");
    expect(stylesSource).toContain(".responder-radar { position: fixed");
    expect(stylesSource).toContain(".broadcast-fab { right: auto; bottom: 190px; left: 17px;");
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr) auto");
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
