import { describe, expect, test } from "bun:test";
import { estimateSketch } from "../hll";
import { AnalyticsSummarySchema, emptyAnalytics } from "../schema";
import type { HitRequest, StoredAnalytics } from "../schema";
import { getDateBucket, getHourBucket } from "./buckets";
import {
  applyHit,
  freezeStaleSketch,
  pruneExpired,
  summarize,
  withinRetention,
} from "./state";

/** A fixed clock, so every bucket key in here is predictable. */
const NOW = Date.UTC(2026, 0, 15, 12, 30, 0);
const TODAY = "2026-01-15";
const THIS_HOUR = "2026-01-15-12";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A key of the shape `deriveDailyKey` produces, without needing the secret. */
const DAILY_KEY = new Uint8Array(32).fill(7);

function hit(overrides: Partial<HitRequest> = {}): HitRequest {
  return {
    pageId: "demo",
    ip: "203.0.113.7",
    referrer: "https://github.com/Nathan13888/VisitorBadgeReloaded",
    country: "CA",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0",
    ...overrides,
  };
}

function record(overrides: Partial<StoredAnalytics> = {}): StoredAnalytics {
  return { ...emptyAnalytics("demo", NOW), ...overrides };
}

/** The day's estimate, insisting there is a sketch to read it from. */
function estimateToday(analytics: StoredAnalytics): number {
  const sketch = analytics.todaySketch;
  if (!sketch) {
    throw new Error("expected a sketch for the current day");
  }
  return estimateSketch(sketch);
}

describe("applyHit", () => {
  test("counts the hit into the total and both buckets", async () => {
    const analytics = record();

    await applyHit(analytics, hit(), NOW);
    await applyHit(analytics, hit(), NOW);

    expect(analytics.totalHits).toBe(2);
    expect(analytics.hourlyHits[THIS_HOUR]).toBe(2);
    expect(analytics.dailyHits[TODAY]).toBe(2);
    expect(analytics.lastUpdated).toBe(NOW);
  });

  test("classifies the request into the published breakdowns", async () => {
    const analytics = record();

    await applyHit(analytics, hit(), NOW);

    expect(analytics.referrers["github.com"]).toBe(1);
    expect(analytics.countries.CA).toBe(1);
    expect(analytics.userAgents.Chrome).toBe(1);
    expect(analytics.platforms.macOS).toBe(1);
  });

  test("a malformed referrer is an unknown source, not a failed hit", async () => {
    const analytics = record();

    await applyHit(analytics, hit({ referrer: "}{not a url" }), NOW);

    expect(analytics.totalHits).toBe(1);
    expect(analytics.referrers.Unknown).toBe(1);
  });

  test("skips the visitor estimate entirely when no key is available", async () => {
    const analytics = record();

    await applyHit(analytics, hit(), NOW);

    expect(analytics.todaySketch).toBeUndefined();
  });

  test("folds distinct addresses into the day's sketch", async () => {
    const analytics = record();

    await applyHit(analytics, hit({ ip: "203.0.113.7" }), NOW, DAILY_KEY);
    await applyHit(analytics, hit({ ip: "203.0.113.7" }), NOW, DAILY_KEY);

    expect(analytics.todaySketch?.date).toBe(TODAY);
    // Two hits, one address.
    expect(estimateToday(analytics)).toBe(1);

    await applyHit(analytics, hit({ ip: "198.51.100.4" }), NOW, DAILY_KEY);

    expect(estimateToday(analytics)).toBe(2);
    expect(analytics.totalHits).toBe(3);
  });

  test("starts a fresh sketch when the day turns over", async () => {
    const analytics = record();

    await applyHit(analytics, hit(), NOW - DAY_MS, DAILY_KEY);
    await applyHit(analytics, hit(), NOW, DAILY_KEY);

    expect(analytics.todaySketch?.date).toBe(TODAY);
    expect(analytics.dailyUniqueVisitors["2026-01-14"]).toBe(1);
  });

  test("prunes every hundredth hit, and not in between", async () => {
    const stale = { "2025-12-01-00": 5 };
    const analytics = record({ totalHits: 98, hourlyHits: { ...stale } });

    await applyHit(analytics, hit(), NOW);
    expect(analytics.hourlyHits["2025-12-01-00"]).toBe(5);

    await applyHit(analytics, hit(), NOW);
    expect(analytics.totalHits).toBe(100);
    expect(analytics.hourlyHits["2025-12-01-00"]).toBeUndefined();
    expect(analytics.hourlyHits[THIS_HOUR]).toBe(2);
  });
});

describe("freezeStaleSketch", () => {
  test("freezes a finished day to an integer and discards its registers", async () => {
    const analytics = record();
    await applyHit(analytics, hit(), NOW - DAY_MS, DAILY_KEY);

    expect(freezeStaleSketch(analytics, NOW)).toBe(true);
    expect(analytics.todaySketch).toBeUndefined();
    expect(analytics.dailyUniqueVisitors["2026-01-14"]).toBe(1);
  });

  test("leaves the current day's sketch alone", async () => {
    const analytics = record();
    await applyHit(analytics, hit(), NOW, DAILY_KEY);

    expect(freezeStaleSketch(analytics, NOW)).toBe(false);
    expect(analytics.todaySketch?.date).toBe(TODAY);
    expect(analytics.dailyUniqueVisitors).toEqual({});
  });

  test("is a no-op when there is no sketch", () => {
    const analytics = record();

    expect(freezeStaleSketch(analytics, NOW)).toBe(false);
  });

  test("leaves a sketch dated ahead of the clock alone", async () => {
    const analytics = record();
    await applyHit(analytics, hit(), NOW + DAY_MS, DAILY_KEY);

    // Reachable when a hit is suspended across midnight and resumes behind a
    // newer one. Freezing here would publish an estimate for a day still in
    // progress.
    expect(freezeStaleSketch(analytics, NOW)).toBe(false);
    expect(analytics.todaySketch?.date).toBe("2026-01-16");
    expect(analytics.dailyUniqueVisitors).toEqual({});
  });
});

/**
 * `now` is captured by the Durable Object before `applyHit`'s awaits, and the
 * input gate does not hold two hits apart across them, so a hit timestamped
 * just before UTC midnight can be folded in after one from the following day.
 */
describe("hits that arrive out of order across midnight", () => {
  const LAST_NIGHT = Date.UTC(2026, 0, 14, 23, 59, 59, 900);
  const YESTERDAY = "2026-01-14";

  /** A record mid-way through the 14th, with three visitors in its sketch. */
  async function eveningOfThe14th(): Promise<StoredAnalytics> {
    const analytics = record();
    for (const ip of ["203.0.113.7", "198.51.100.4", "192.0.2.9"]) {
      await applyHit(analytics, hit({ ip }), LAST_NIGHT, DAILY_KEY);
    }
    expect(estimateToday(analytics)).toBe(3);
    return analytics;
  }

  test("the finished day keeps the estimate it was frozen with", async () => {
    const analytics = await eveningOfThe14th();

    // The first hit of the 15th rolls the day over.
    await applyHit(analytics, hit({ ip: "203.0.113.100" }), NOW, DAILY_KEY);
    expect(analytics.dailyUniqueVisitors[YESTERDAY]).toBe(3);

    // The straggler from the 14th resumes only now. It must not reopen the day
    // it belongs to, because that day's estimate has already been published.
    await applyHit(
      analytics,
      hit({ ip: "203.0.113.200" }),
      LAST_NIGHT,
      DAILY_KEY,
    );
    await applyHit(analytics, hit({ ip: "203.0.113.101" }), NOW, DAILY_KEY);

    expect(analytics.dailyUniqueVisitors[YESTERDAY]).toBe(3);
    expect(analytics.todaySketch?.date).toBe(TODAY);
    expect(estimateToday(analytics)).toBe(2);
  });

  test("the straggler is still counted everywhere order does not matter", async () => {
    const analytics = await eveningOfThe14th();

    await applyHit(analytics, hit(), NOW, DAILY_KEY);
    await applyHit(analytics, hit(), LAST_NIGHT, DAILY_KEY);

    // Only the visitor estimate gives the address up; the hit itself lands in
    // its own day's buckets as it always would.
    expect(analytics.totalHits).toBe(5);
    expect(analytics.dailyHits[YESTERDAY]).toBe(4);
    expect(analytics.dailyHits[TODAY]).toBe(1);
    expect(analytics.hourlyHits["2026-01-14-23"]).toBe(4);
  });

  test("lastUpdated does not move backwards", async () => {
    const analytics = await eveningOfThe14th();

    await applyHit(analytics, hit(), NOW, DAILY_KEY);
    await applyHit(analytics, hit(), LAST_NIGHT, DAILY_KEY);

    // Rewinding this would make a live badge look abandoned to the retention
    // alarm, which stops rescheduling once the record falls out of the window.
    expect(analytics.lastUpdated).toBe(NOW);
    expect(withinRetention(analytics, NOW)).toBe(true);
  });
});

describe("pruneExpired", () => {
  test("drops every bucket past the retention window", () => {
    const analytics = record({
      hourlyHits: {
        [getHourBucket(NOW - HOUR_MS)]: 1,
        [getHourBucket(NOW - 13 * DAY_MS)]: 2,
        [getHourBucket(NOW - 15 * DAY_MS)]: 3,
      },
      dailyHits: {
        [getDateBucket(NOW)]: 4,
        [getDateBucket(NOW - 20 * DAY_MS)]: 5,
      },
      dailyUniqueVisitors: {
        [getDateBucket(NOW - DAY_MS)]: 6,
        [getDateBucket(NOW - 30 * DAY_MS)]: 7,
      },
    });

    pruneExpired(analytics, NOW);

    expect(Object.keys(analytics.hourlyHits)).toEqual([
      getHourBucket(NOW - HOUR_MS),
      getHourBucket(NOW - 13 * DAY_MS),
    ]);
    expect(analytics.dailyHits).toEqual({ [getDateBucket(NOW)]: 4 });
    expect(analytics.dailyUniqueVisitors).toEqual({
      [getDateBucket(NOW - DAY_MS)]: 6,
    });
  });

  test("leaves the current day's sketch in place", async () => {
    const analytics = record();
    await applyHit(analytics, hit(), NOW, DAILY_KEY);

    pruneExpired(analytics, NOW);

    expect(analytics.todaySketch?.date).toBe(TODAY);
  });
});

describe("withinRetention", () => {
  test("is true while a record still has anything to expire", () => {
    expect(withinRetention(record({ lastUpdated: NOW }), NOW)).toBe(true);
    expect(
      withinRetention(record({ lastUpdated: NOW - 13 * DAY_MS }), NOW),
    ).toBe(true);
  });

  test("is false once a badge has been quiet longer than retention", () => {
    expect(
      withinRetention(record({ lastUpdated: NOW - 15 * DAY_MS }), NOW),
    ).toBe(false);
  });
});

describe("summarize", () => {
  test("reports each window independently of what is retained", () => {
    const analytics = record({
      totalHits: 30,
      hourlyHits: {
        [getHourBucket(NOW - HOUR_MS)]: 1,
        [getHourBucket(NOW - 3 * DAY_MS)]: 2,
        [getHourBucket(NOW - 10 * DAY_MS)]: 4,
        [getHourBucket(NOW - 20 * DAY_MS)]: 8,
      },
    });

    const summary = summarize(analytics, NOW);

    expect(summary.totalHits).toBe(30);
    expect(summary.hitsLast24Hours).toBe(1);
    expect(summary.hitsLast7Days).toBe(3);
    expect(summary.hitsLast14Days).toBe(7);
  });

  test("ranks breakdowns by count and publishes at most ten", () => {
    const referrers: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      referrers[`host-${i}.example`] = i + 1;
    }

    const summary = summarize(record({ referrers }), NOW);

    expect(summary.topReferrers).toHaveLength(10);
    expect(summary.topReferrers[0]).toEqual({
      referrer: "host-11.example",
      count: 12,
    });
    expect(summary.topReferrers.at(-1)).toEqual({
      referrer: "host-2.example",
      count: 3,
    });
  });

  test("labels each breakdown with the field its schema publishes", () => {
    const summary = summarize(
      record({
        countries: { CA: 2 },
        userAgents: { Chrome: 2 },
        platforms: { macOS: 2 },
      }),
      NOW,
    );

    expect(summary.topCountries).toEqual([{ country: "CA", count: 2 }]);
    expect(summary.topUserAgents).toEqual([{ agent: "Chrome", count: 2 }]);
    expect(summary.topPlatforms).toEqual([{ platform: "macOS", count: 2 }]);
  });

  test("takes today's estimate from the live sketch and earlier days from the frozen ones", async () => {
    const analytics = record({
      dailyHits: {
        [TODAY]: 3,
        "2026-01-14": 2,
        "2026-01-13": 1,
      },
      dailyUniqueVisitors: { "2026-01-14": 9 },
    });
    await applyHit(analytics, hit(), NOW, DAILY_KEY);

    const summary = summarize(analytics, NOW);

    expect(summary.uniqueVisitorsToday).toBe(1);
    expect(summary.dailyStats).toEqual([
      // A day predating the measurement reports null, not zero.
      { date: "2026-01-13", hits: 1, uniqueVisitors: null },
      { date: "2026-01-14", hits: 2, uniqueVisitors: 9 },
      { date: TODAY, hits: 4, uniqueVisitors: 1 },
    ]);
  });

  test("reports no estimate for today when the sketch was never started", () => {
    const summary = summarize(record({ dailyHits: { [TODAY]: 3 } }), NOW);

    expect(summary.uniqueVisitorsToday).toBeNull();
    expect(summary.dailyStats).toEqual([
      { date: TODAY, hits: 3, uniqueVisitors: null },
    ]);
  });

  test("carries only the last 48 hours of hourly detail, in order", () => {
    const analytics = record({
      hourlyHits: {
        [getHourBucket(NOW - 60 * HOUR_MS)]: 9,
        [getHourBucket(NOW - 5 * HOUR_MS)]: 2,
        [getHourBucket(NOW - 47 * HOUR_MS)]: 1,
      },
    });

    const summary = summarize(analytics, NOW);

    expect(summary.hourlyStats).toEqual([
      { hour: getHourBucket(NOW - 47 * HOUR_MS), hits: 1 },
      { hour: getHourBucket(NOW - 5 * HOUR_MS), hits: 2 },
    ]);
  });

  test("produces exactly the shape the API publishes", async () => {
    const analytics = record();
    await applyHit(analytics, hit(), NOW, DAILY_KEY);

    expect(() =>
      AnalyticsSummarySchema.parse(summarize(analytics, NOW)),
    ).not.toThrow();
  });
});
