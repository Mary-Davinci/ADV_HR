import { describe, expect, it } from "vitest";

import { isScheduledTimeInItaly, readAdvCoreSyncConfig } from "./config";

const base = {
  DATABASE_URL: "postgres://localhost/adv_hr",
  ADV_CORE_API_URL: "https://gestionale.example.it",
  ADV_CORE_API_KEY: "k".repeat(40),
};

describe("isScheduledTimeInItaly", () => {
  const times = ["13:20", "18:20"];

  it("riconosce l'orario con l'ora legale (UTC+2) e con la solare (UTC+1)", () => {
    expect(isScheduledTimeInItaly(new Date("2026-07-15T11:20:00Z"), times)).toBe(true);
    expect(isScheduledTimeInItaly(new Date("2026-12-15T12:20:00Z"), times)).toBe(true);
    expect(isScheduledTimeInItaly(new Date("2026-12-15T17:21:00Z"), times)).toBe(true);
  });

  it("salta il cron dell'altra stagione e i ritardi oltre la tolleranza", () => {
    expect(isScheduledTimeInItaly(new Date("2026-07-15T12:20:00Z"), times)).toBe(false);
    expect(isScheduledTimeInItaly(new Date("2026-12-15T11:20:00Z"), times)).toBe(false);
    expect(isScheduledTimeInItaly(new Date("2026-07-15T11:40:00Z"), times)).toBe(false);
  });
});

describe("readAdvCoreSyncConfig", () => {
  it("legge gli orari pianificati, vuoti per default", () => {
    expect(readAdvCoreSyncConfig(base).scheduledTimes).toEqual([]);
    expect(readAdvCoreSyncConfig({ ...base, ADV_CORE_SYNC_TIMES: "13:20,18:20" }).scheduledTimes).toEqual([
      "13:20",
      "18:20",
    ]);
  });

  it("rifiuta orari scritti male", () => {
    expect(() => readAdvCoreSyncConfig({ ...base, ADV_CORE_SYNC_TIMES: "13.20" })).toThrow(/HH:MM/);
  });
});
