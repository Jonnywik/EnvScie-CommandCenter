// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import ReportIncident from "../client/src/pages/ReportIncident";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";

const { mutateAsync, queueOfflineReport } = vi.hoisted(() => ({ mutateAsync: vi.fn(), queueOfflineReport: vi.fn() }));

vi.mock("../client/src/lib/trpc", () => ({ trpc: { reports: { submit: { useMutation: () => ({ mutateAsync, isPending: false }) } } } }));
vi.mock("../client/src/lib/offlineReportQueue", () => ({ queueOfflineReport, readOfflineReports: vi.fn().mockResolvedValue([]), removeOfflineReport: vi.fn() }));
vi.mock("../client/src/components/drrm/CivilianShell", () => ({ CivilianShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../client/src/components/drrm/DrrmPrimitives", () => ({ AppCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("../client/src/components/drrm/DrrmDomain", () => ({ DrrmFormSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, DrrmNotice: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>, FormLabel: ({ label, children }: { label: string; children: React.ReactNode }) => <label>{label}{children}</label>, OfflineSyncStatus: () => <span>sync status</span> }));
vi.mock("wouter", () => ({ useLocation: () => ["/report", vi.fn()] }));

function attachPhoto() { const input = document.querySelector('input[type="file"]') as HTMLInputElement; const photo = new File(["evidence"], "flood.jpg", { type: "image/jpeg" }); fireEvent.change(input, { target: { files: [photo] } }); }

beforeEach(() => { mutateAsync.mockReset().mockResolvedValue({ id: 1 }); queueOfflineReport.mockReset().mockResolvedValue(undefined); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });
afterEach(() => cleanup());

describe("incident report confirmation", () => {
  it("requires an explicit review confirmation and lets the resident return to editing without submitting", async () => {
    render(<LocaleProvider><ReportIncident /></LocaleProvider>);
    attachPhoto();
    fireEvent.click(screen.getByRole("button", { name: "Review & submit report" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("Are you sure you want to submit?");
    fireEvent.click(screen.getByRole("button", { name: "Go back and edit" }));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review & submit report" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, secure & submit" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(queueOfflineReport).not.toHaveBeenCalled();
  });

  it("accurately describes local queueing when the device is offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<LocaleProvider><ReportIncident /></LocaleProvider>);
    attachPhoto();
    fireEvent.click(screen.getByRole("button", { name: "Review & submit report" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("stored securely on this device");
  });
});
