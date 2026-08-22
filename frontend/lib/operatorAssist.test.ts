import { describe, expect, it } from "vitest";
import { buildShiftHandoff, canUseCoordinatorIntake, resolveOperatorShortcut } from "./operatorAssist";

describe("operator continuity helpers", () => {
  it("creates a handoff that includes only incidents needing triage and retains the dispatch guardrail", () => {
    const handoff = buildShiftHandoff({
      now: new Date("2026-08-12T02:30:00.000Z"),
      incidents: [
        { id: "SOS-OPEN", severity: "critical", status: "received", emergency_type: "Flood rescue", channel: "manual", barangay: "Barangay 3", location: { latitude: 11.1, longitude: 125.3 }, received_at: "2026-08-12T02:00:00Z", summary: "Family needs rescue." },
        { id: "SOS-CLOSED", severity: "advisory", status: "resolved", emergency_type: "Supply request", channel: "internet", barangay: "Barangay 1", location: { latitude: 11.0, longitude: 125.2 }, received_at: "2026-08-12T01:00:00Z", summary: "Resolved." },
      ],
      alerts: [{ id: "ALERT-1", source_name: "PAGASA", source_event_id: "1", title: "Heavy rainfall", body: "Stay alert.", severity: "warning", issued_at: "2026-08-12T01:00:00Z" }],
      notifications: { generated_at: "2026-08-12T02:30:00Z", source: "demo-seed", pending_count: 2, failed_count: 1, notifications: [] },
    });
    expect(handoff).toContain("Open SOS requiring attention: 1.");
    expect(handoff).toContain("Family needs rescue.");
    expect(handoff).not.toContain("Supply request");
    expect(handoff).not.toContain("Resolved.");
    expect(handoff).toContain("Priority verified alerts: 1.");
    expect(handoff).toContain("recheck the route against active hazards before dispatch");
  });

  it("does not intercept shortcuts while a coordinator is writing and limits manual intake to authorized roles", () => {
    expect(resolveOperatorShortcut({ key: "n", editable: true, canRecordEmergency: true, tabCount: 8 })).toBeNull();
    expect(resolveOperatorShortcut({ key: "n", editable: false, canRecordEmergency: true, tabCount: 8 })).toEqual({ action: "record-emergency" });
    expect(resolveOperatorShortcut({ key: "8", editable: false, canRecordEmergency: false, tabCount: 8 })).toEqual({ action: "switch-tab", tabIndex: 7 });
    expect(canUseCoordinatorIntake({ id: "1", display_name: "Officer", role: "dispatcher", is_active: true })).toBe(true);
    expect(canUseCoordinatorIntake({ id: "2", display_name: "Resident", role: "resident", is_active: true })).toBe(false);
  });
});
