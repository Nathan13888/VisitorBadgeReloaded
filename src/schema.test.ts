import { describe, expect, test } from "bun:test";
import { createSketch } from "./hll";
import {
  SCHEMA_VERSION,
  StoredAnalyticsSchema,
  emptyAnalytics,
  upgradeStoredAnalytics,
} from "./schema";

const PAGE = "example-page";
const DAY = "2026-08-05";

/** A well-formed version 1 record: everything present, no `schemaVersion`. */
function legacyRecord(overrides: Record<string, unknown> = {}) {
  return {
    pageId: PAGE,
    totalHits: 512,
    lastUpdated: 1_754_000_000_000,
    hourlyHits: { "2026-08-05-11": 4 },
    dailyHits: { [DAY]: 12 },
    dailyUniqueVisitors: { "2026-08-04": 7 },
    referrers: { "github.com": 9 },
    countries: { CA: 9 },
    userAgents: { "GitHub Camo": 9 },
    platforms: { Other: 9 },
    ...overrides,
  };
}

describe("emptyAnalytics", () => {
  test("is already at the current version, so it never needs upgrading", () => {
    const record = emptyAnalytics(PAGE, 1_754_000_000_000);

    expect(StoredAnalyticsSchema.safeParse(record).success).toBe(true);
    expect(record.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("StoredAnalyticsSchema", () => {
  test("rejects a record with no version, routing it to the upgrade path", () => {
    expect(StoredAnalyticsSchema.safeParse(legacyRecord()).success).toBe(false);
  });

  test("accepts a record already at the current version", () => {
    const upgraded = upgradeStoredAnalytics(legacyRecord(), PAGE).record;

    expect(StoredAnalyticsSchema.safeParse(upgraded).success).toBe(true);
  });
});

describe("upgradeStoredAnalytics", () => {
  test("stamps the version without touching the data", () => {
    const { record, repaired } = upgradeStoredAnalytics(legacyRecord(), PAGE);

    expect(repaired).toBe(false);
    expect(record.schemaVersion).toBe(SCHEMA_VERSION);
    expect(record.totalHits).toBe(512);
    expect(record.dailyHits).toEqual({ [DAY]: 12 });
    expect(record.referrers).toEqual({ "github.com": 9 });
  });

  test("drops the pre-08/05/26 raw address set", () => {
    const withAddresses = legacyRecord({
      uniqueVisitors: ["203.0.113.7", "198.51.100.4"],
    });

    const { record, repaired } = upgradeStoredAnalytics(withAddresses, PAGE);

    expect(repaired).toBe(false);
    expect(record).not.toHaveProperty("uniqueVisitors");
  });

  test("defaults fields that version 1 added late, without calling it a repair", () => {
    const early = legacyRecord();
    // @ts-expect-error: modelling a record written before these fields existed
    early.dailyUniqueVisitors = undefined;
    // @ts-expect-error: same
    early.userAgents = undefined;
    // @ts-expect-error: same
    early.platforms = undefined;

    const { record, repaired } = upgradeStoredAnalytics(early, PAGE);

    expect(repaired).toBe(false);
    expect(record.dailyUniqueVisitors).toEqual({});
    expect(record.userAgents).toEqual({});
    expect(record.platforms).toEqual({});
    expect(record.totalHits).toBe(512);
  });

  test("keeps the visible count when a breakdown is corrupt", () => {
    const damaged = legacyRecord({ countries: "not-a-map" });

    const { record, repaired } = upgradeStoredAnalytics(damaged, PAGE);

    expect(repaired).toBe(true);
    expect(record.totalHits).toBe(512);
    expect(record.countries).toEqual({});
    // Everything that was still intact survives the repair.
    expect(record.dailyHits).toEqual({ [DAY]: 12 });
  });

  test("falls back to zero only when the count itself is unusable", () => {
    const { record, repaired } = upgradeStoredAnalytics(
      legacyRecord({ totalHits: "512" }),
      PAGE,
    );

    expect(repaired).toBe(true);
    expect(record.totalHits).toBe(0);
  });

  test("discards a sketch whose registers are not decodable", () => {
    const damaged = legacyRecord({
      todaySketch: { date: DAY, registers: "not base64!!" },
    });

    const { record, repaired } = upgradeStoredAnalytics(damaged, PAGE);

    expect(repaired).toBe(true);
    expect(record.todaySketch).toBeUndefined();
    expect(record.totalHits).toBe(512);
  });

  test("carries an intact sketch through untouched", () => {
    const sketch = createSketch(DAY);

    const { record, repaired } = upgradeStoredAnalytics(
      legacyRecord({ todaySketch: sketch }),
      PAGE,
    );

    expect(repaired).toBe(false);
    expect(record.todaySketch).toEqual(sketch);
  });

  test("names the record from the object when the field is missing", () => {
    const { record } = upgradeStoredAnalytics(
      legacyRecord({ pageId: undefined }),
      PAGE,
    );

    expect(record.pageId).toBe(PAGE);
  });

  test("survives a record that is not an object at all", () => {
    const { record, repaired } = upgradeStoredAnalytics("garbage", PAGE);

    expect(repaired).toBe(true);
    expect(record.pageId).toBe(PAGE);
    expect(record.totalHits).toBe(0);
    expect(StoredAnalyticsSchema.safeParse(record).success).toBe(true);
  });

  test("always produces a record the strict schema accepts", () => {
    const inputs: unknown[] = [
      legacyRecord(),
      legacyRecord({ totalHits: -1 }),
      legacyRecord({ hourlyHits: null }),
      {},
      null,
      42,
    ];

    for (const input of inputs) {
      const { record } = upgradeStoredAnalytics(input, PAGE);
      expect(StoredAnalyticsSchema.safeParse(record).success).toBe(true);
    }
  });
});
