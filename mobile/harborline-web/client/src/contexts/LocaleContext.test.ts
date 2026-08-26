import { describe, expect, it } from "vitest";
import { localizeInterfaceText, translations } from "./LocaleContext";

describe("Harborline language catalog", () => {
  it("provides English, Filipino, and Waray labels for the shared mobile navigation", () => {
    expect(Object.keys(translations)).toEqual(["en", "fil", "war"]);
    expect(translations.en.nav.settings).toBe("Settings");
    expect(translations.fil.nav.settings).toBe("Mga setting");
    expect(translations.war.nav.settings).toBe("Mga setting");
  });

  it("provides localized home copy for every supported language", () => {
    for (const translation of Object.values(translations)) {
      expect(translation.home.title.length).toBeGreaterThan(10);
      expect(translation.home.primary.length).toBeGreaterThan(4);
      expect(translation.settings.appearance.length).toBeGreaterThan(4);
    }
  });

  it("translates recurring citizen-route labels outside the home screen", () => {
    expect(localizeInterfaceText("Emergency communications", "fil")).toBe("Mga komunikasyong pang-emergency");
    expect(localizeInterfaceText("Orient before you move.", "war")).toBe("Magplano antes lumakat.");
    expect(localizeInterfaceText("Search", "en")).toBe("Search");
  });
});
