import { describe, expect, test } from "bun:test";
import {
  getDateBucket,
  getHourBucket,
  parseDateBucket,
  parseHourBucket,
} from "./buckets";

const NOON = Date.UTC(2026, 0, 15, 12, 30, 45);

describe("bucket keys", () => {
  test("are UTC and zero padded", () => {
    const early = Date.UTC(2026, 8, 3, 4, 5, 6);

    expect(getHourBucket(early)).toBe("2026-09-03-04");
    expect(getDateBucket(early)).toBe("2026-09-03");
  });

  test("sort chronologically as plain strings", () => {
    const keys = [
      getHourBucket(Date.UTC(2026, 0, 15, 9)),
      getHourBucket(Date.UTC(2025, 11, 31, 23)),
      getHourBucket(Date.UTC(2026, 0, 15, 10)),
    ];

    expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual([
      "2025-12-31-23",
      "2026-01-15-09",
      "2026-01-15-10",
    ]);
  });
});

describe("parsing a bucket back", () => {
  test("returns the start of the hour", () => {
    expect(parseHourBucket(getHourBucket(NOON))).toBe(
      Date.UTC(2026, 0, 15, 12),
    );
  });

  test("returns the start of the day", () => {
    expect(parseDateBucket(getDateBucket(NOON))).toBe(Date.UTC(2026, 0, 15));
  });

  test("round trips every hour of a day", () => {
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = Date.UTC(2026, 0, 15, hour);
      expect(parseHourBucket(getHourBucket(timestamp))).toBe(timestamp);
    }
  });
});
