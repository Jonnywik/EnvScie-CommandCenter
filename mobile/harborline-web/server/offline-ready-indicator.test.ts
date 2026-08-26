import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("offline-ready status indicator", () => {
  const appSource = readFileSync(resolve("client/src/App.tsx"), "utf8");
  const styles = readFileSync(resolve("client/src/index.css"), "utf8");

  it("reveals a localized readiness status after the app-load fade and watches browser connectivity", () => {
    expect(appSource).toContain("function OfflineReadyIndicator()");
    expect(appSource).toContain("setTimeout(() => setVisible(true), 380)");
    expect(appSource).toContain('window.addEventListener("online", markOnline)');
    expect(appSource).toContain('window.addEventListener("offline", markOffline)');
    expect(appSource).toContain('role="status" aria-live="polite"');
    expect(appSource).toContain("onlineTitle: \"Offline-ready\"");
  });

  it("uses motion-safe entry styling and disables the cue for reduced-motion preferences", () => {
    expect(styles).toContain(".drrm-offline-ready { animation: drrm-offline-ready 240ms");
    expect(styles).toContain(".drrm-app-load, .drrm-offline-ready, .drrm-enter, .circle-sos-alert, .circle-sos-alert-icon { animation: none !important; }");
  });
});
