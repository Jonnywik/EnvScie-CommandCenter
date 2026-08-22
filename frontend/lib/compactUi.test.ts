import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "components/Dashboard.tsx"), "utf8");
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
    expect(dashboardSource).toContain('title="Operational checks"');
    expect(stylesSource).toContain(".overview-command-grid");
    expect(stylesSource).toContain(".overview-queues-grid");
    expect(stylesSource).toContain(".quick-actions-grid");
  });

  it("renders the map-first Command Map dashboard with protected operational controls", () => {
    expect(dashboardSource).toContain("CommandMapView");
    expect(dashboardSource).toContain('variant="command"');
    expect(dashboardSource).toContain("EnvScie CommandCenter");
    expect(dashboardSource).toContain("Situational awareness");
    expect(dashboardSource).toContain("Responder radar");
    expect(dashboardSource).toContain("Mass Area Notification");
    expect(dashboardSource).toContain("Live Weather Radar");
    expect(dashboardSource).toContain("Flood Risk Zones");
    expect(stylesSource).toContain(".command-map-shell");
    expect(stylesSource).toContain(".command-map-topbar");
    expect(stylesSource).toContain(".mass-notification-modal");
  });

  it("contains wheel and touch gestures within the operational map", () => {
    expect(dashboardSource).toContain("const mapShellRef = useRef<HTMLDivElement | null>(null)");
    expect(dashboardSource).toContain('mapShell.addEventListener("wheel", containWheel, { passive: false })');
    expect(dashboardSource).toContain('mapShell.addEventListener("touchmove", containTouchMove, { passive: false })');
    expect(dashboardSource).toContain("ref={mapShellRef}");
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
    expect(dashboardSource).toContain("function IncidentTriageView");
    expect(dashboardSource).toContain("Incoming Alerts");
    expect(dashboardSource).toContain("Sort by Severity");
    expect(dashboardSource).toContain("Codec decoder");
    expect(dashboardSource).toContain("LGU verification checklist");
    expect(dashboardSource).toContain("WMCDA DISPATCH RECOMMENDATIONS");
    expect(dashboardSource).toContain("getDispatchRecommendations");
    expect(dashboardSource).toContain("assignResponseGroup");
    expect(dashboardSource).toContain("!verificationComplete");
    expect(dashboardSource).toContain("lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]");
  });

  it("provides a responsive Fleet and Responder Safety workspace with advisory safety safeguards", () => {
    expect(dashboardSource).toContain('"Fleet & Responder Safety"');
    expect(dashboardSource).toContain("function FleetResponderSafetyView");
    expect(dashboardSource).toContain("TOTAL FLEET READINESS");
    expect(dashboardSource).toContain("SAFETY BREACHES");
    expect(dashboardSource).toContain("DEPLOYMENT MATRIX");
    expect(dashboardSource).toContain("HAZARD PROXIMITY MONITOR");
    expect(dashboardSource).toContain("DYNAMIC ROUTING CONSOLE");
    expect(dashboardSource).toContain("lg:grid-cols-[minmax(0,60%)_minmax(360px,40%)]");
    expect(dashboardSource).toContain("setSelectedId(unit.group.id)");
    expect(dashboardSource).toContain("optimizeGisRoute");
    expect(dashboardSource).toContain("No mobile delivery endpoint is configured");
    expect(dashboardSource).toContain("OPERATOR CONFIRMATION");
    expect(dashboardSource).toContain("does not force a field reroute");
  });

  it("provides DRRMO Intelligence with bounded immutable audit review and deliberate exports", () => {
    expect(dashboardSource).toContain('"DRRMO Intelligence"');
    expect(dashboardSource).toContain("function IntelligenceDashboardView");
    expect(dashboardSource).toContain('aria-label="System health and analytics grid"');
    expect(dashboardSource).toContain("IMMUTABLE ACTION LEDGER");
    expect(dashboardSource).toContain("AUTOMATED LGU REPORTING");
    expect(dashboardSource).toContain("getAuditEvents(200)");
    expect(dashboardSource).toContain("filteredEvents.slice(0, 150)");
    expect(dashboardSource).toContain("Filters change this view only; they never alter the ledger.");
    expect(dashboardSource).toContain("intelligence.audit_ledger_export_compiled");
    expect(dashboardSource).toContain("not signed official forms and require local approval");
    expect(dashboardSource).toContain("No socket-health metric reported");
  });
});
