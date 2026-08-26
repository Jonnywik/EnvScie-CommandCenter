import { describe, expect, it } from "vitest";
import { centerAvailability, centerCapacityWarning, centerTrustDetails, evacuationAccessDetails, fallbackEvacuationDestination, filterDirectionsDestinations, handoffDestination, rankAlternativeCenters, responseDirections, summarizeDirectionLegs, type DirectionDestination } from "../client/src/lib/directions";

describe("dedicated directions tab helpers", () => {
  it("provides separate evacuation and response-office destinations with safe map-handoff targets", () => {
    expect(fallbackEvacuationDestination.kind).toBe("evacuation");
    expect(responseDirections.every((destination) => destination.kind === "response")).toBe(true);
    expect(handoffDestination(fallbackEvacuationDestination)).toBe("11.1086,125.3877");
    expect(handoffDestination(responseDirections[0]!)).toContain("Balangiga%20Municipal%20Hall");
  });
  it("aggregates directions distance and time across all route legs", () => {
    expect(summarizeDirectionLegs([{ distance: { value: 900 }, duration: { value: 180 } }, { distance: { value: 1600 }, duration: { value: 360 } }])).toEqual({ meters: 2500, seconds: 540, kilometers: 2.5, minutes: 9 });
  });
  it("searches by center name, barangay, and landmark terms while preserving live availability labels", () => {
    const centers: DirectionDestination[] = [{ id: "center-1", name: "Balangiga Elementary School", kind: "evacuation", detail: "Poblacion · 24 slots available", operationalStatus: "open", availableSlots: 24, searchTerms: ["Poblacion", "Town plaza"] }, { id: "center-2", name: "Maybunga hall", kind: "evacuation", detail: "Maybunga · 0 slots available", operationalStatus: "full", availableSlots: 0, searchTerms: ["Maybunga", "Coastal road"] }];
    expect(filterDirectionsDestinations(centers, "poblacion").map((center) => center.id)).toEqual(["center-1"]);
    expect(filterDirectionsDestinations(centers, "coastal").map((center) => center.id)).toEqual(["center-2"]);
    expect(centerAvailability(centers[0]!)).toMatchObject({ marker: "24", label: "24 slots open", tone: "open" });
    expect(centerAvailability(centers[1]!)).toMatchObject({ marker: "FULL", label: "Full", tone: "full" });
  });
  it("formats popup-ready center details and identifies unavailable navigation destinations", () => {
    const destination: DirectionDestination = { ...fallbackEvacuationDestination, phone: "0917 117 0807", accessibility: { wheelchair: true, medicalSupport: "Health station on call", accessibleToilet: true }, operationalStatus: "full", availableSlots: 0 };
    expect(evacuationAccessDetails(destination)).toMatchObject({ contact: "Call 0917 117 0807", wheelchair: "Wheelchair access available", medicalSupport: "Health station on call", accessibleToilet: "Accessible toilet available" });
    expect(centerCapacityWarning(destination)).toBe(true);
    expect(centerCapacityWarning({ ...destination, operationalStatus: "open", availableSlots: 4 })).toBe(false);
  });
  it("labels verified, stale, and reference evacuation records without presenting fallback data as live", () => {
    expect(centerTrustDetails({ ...fallbackEvacuationDestination, verificationStatus: "verified", sourceName: "Balangiga MDRRMO", isCurrent: true })).toMatchObject({ label: "LGU verified", tone: "verified" });
    expect(centerTrustDetails({ ...fallbackEvacuationDestination, verificationStatus: "stale", sourceName: "Balangiga MDRRMO" })).toMatchObject({ label: "Update may be stale", tone: "stale" });
    expect(centerTrustDetails(fallbackEvacuationDestination)).toMatchObject({ label: "Reference only", tone: "reference" });
  });
  it("ranks usable verified alternatives for household mobility and medical needs while excluding full centers", () => {
    const alternatives = rankAlternativeCenters([
      { ...fallbackEvacuationDestination, id: "full", operationalStatus: "full", availableSlots: 80 },
      { ...fallbackEvacuationDestination, id: "reference", availableSlots: 90, operationalStatus: "open", verificationStatus: "reference", accessibility: { wheelchair: false, medicalSupport: false } },
      { ...fallbackEvacuationDestination, id: "verified-accessible", availableSlots: 12, operationalStatus: "open", verificationStatus: "verified", isCurrent: true, accessibility: { wheelchair: true, medicalSupport: true } },
    ], "full", { wheelchair: true, medicalSupport: true });
    expect(alternatives.map((center) => center.id)).toEqual(["verified-accessible", "reference"]);
  });
});
