import { afterEach, describe, expect, it, vi } from "vitest";
import { getHybridWeather } from "./weather";

afterEach(() => vi.unstubAllGlobals());
describe("hybrid weather adapter", () => {
  it("uses Open-Meteo forecast context while retaining PAGASA advisory provenance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: { temperature_2m: 29, precipitation: 1.2, weather_code: 61, time: "2026-08-23T12:00" } }) }));
    const weather = await getHybridWeather();
    expect(weather.advisory.authority).toBe("PAGASA");
    expect(weather.forecast).toMatchObject({ provider: "Open-Meteo", freshness: "live", temperatureC: 29, precipitationMm: 1.2 });
  });
  it("retains a safe fallback when the free forecast provider is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const weather = await getHybridWeather();
    expect(["cached", "fallback"]).toContain(weather.forecast.freshness);
    expect(weather.advisory.authority).toBe("PAGASA");
  });
});
