// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import SosRequest from "../client/src/pages/SosRequest";
import { CommandCenterResponsePanel } from "../client/src/components/drrm/CommandCenterResponsePanel";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";

const mocks = vi.hoisted(() => ({ create: vi.fn(), feed: vi.fn(), acknowledge: vi.fn(), assign: vi.fn(), resolve: vi.fn(), invalidate: vi.fn(), actionsInvalidate: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    sos: { create: { useMutation: () => ({ mutateAsync: mocks.create, isPending: false }) } },
    commandCenter: {
      feed: { useQuery: () => ({ data: mocks.feed(), isLoading: false }) },
      actions: { useQuery: () => ({ data: [] }) },
      acknowledge: { useMutation: ({ onSuccess }: { onSuccess: () => void }) => ({ mutate: (input: unknown) => { mocks.acknowledge(input); onSuccess(); }, isPending: false }) },
      assign: { useMutation: ({ onSuccess }: { onSuccess: () => void }) => ({ mutate: (input: unknown) => { mocks.assign(input); onSuccess(); }, isPending: false }) },
      resolve: { useMutation: ({ onSuccess }: { onSuccess: () => void }) => ({ mutate: (input: unknown) => { mocks.resolve(input); onSuccess(); }, isPending: false }) },
    },
    useUtils: () => ({ commandCenter: { feed: { invalidate: mocks.invalidate }, actions: { invalidate: mocks.actionsInvalidate } } }),
  },
}));
vi.mock("../client/src/components/drrm/CivilianShell", () => ({ CivilianShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../client/src/components/drrm/DrrmPrimitives", () => ({ AppCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>, StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("../client/src/components/drrm/DrrmDomain", () => ({ DrrmNotice: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>, OfflineSyncStatus: () => <span>sync</span> }));

beforeEach(() => { mocks.create.mockReset().mockResolvedValue({ publicReference: "SOS-ABC12345", status: "submitted" }); mocks.feed.mockReturnValue([{ feedId: "sos-7", sourceType: "sos", sourceId: 7, publicReference: "SOS-ABC12345", priority: "critical", status: "submitted", category: "medical", summary: "Urgent medical help", latitude: 11.108, longitude: 125.388, accuracyMeters: 12, submittedAt: new Date("2026-08-25T07:00:00Z"), acknowledgedAt: null, assignedAt: null }]); mocks.acknowledge.mockReset(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); localStorage.clear(); });
afterEach(() => cleanup());

describe("mobile SOS and command-center intake", () => {
  it("requires deliberate confirmation before the mobile SOS enters the command-center queue", async () => { render(<LocaleProvider><SosRequest /></LocaleProvider>); fireEvent.click(screen.getByRole("button", { name: "Review urgent request" })); expect(screen.getByRole("alertdialog").textContent).toContain("Send urgent help request?"); fireEvent.click(screen.getByRole("button", { name: "Yes, send SOS" })); await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1)); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ category: "medical", locationConsent: "withheld" })); expect(screen.getByText(/SOS-ABC12345/)).toBeTruthy(); });
  it("shows the mobile SOS in the authorized command-center queue and records acknowledgement", () => { render(<CommandCenterResponsePanel authorized requestLogin={vi.fn()}/>); expect(screen.getAllByText("SOS-ABC12345").length).toBeGreaterThan(0); fireEvent.click(screen.getByRole("button", { name: "Acknowledge" })); expect(mocks.acknowledge).toHaveBeenCalledWith({ id: 7 }); });
});
