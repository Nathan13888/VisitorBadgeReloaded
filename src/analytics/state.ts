/**
 * Every transition an analytics record can make, as plain functions over the
 * record.
 *
 * These were methods on the Durable Object, which meant the rules about what a
 * hit does to a record, what falls out of the retention window, and how a
 * summary is derived could only be exercised by standing up a Durable Object
 * with storage behind it - so in practice they were not exercised at all. They
 * take the record and the current time as arguments instead, so `now` is an
 * input rather than a call to the clock, and every case is reachable from a
 * test.
 *
 * The mutating functions mutate in place. The caller owns the record and
 * decides when it is written back; nothing here touches storage.
 */

import { addToSketch, createSketch, estimateSketch } from "../hll";
import { RETENTION_DAYS } from "../schema";
import type { AnalyticsSummary, HitRequest, StoredAnalytics } from "../schema";
import {
  getDateBucket,
  getHourBucket,
  parseDateBucket,
  parseHourBucket,
} from "./buckets";
import { detectPlatform, referrerHost, simplifyUserAgent } from "./classify";

/** How long any bucketed history is kept, in milliseconds. */
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * How often the write path prunes.
 *
 * Pruning walks every bucket, so it is not free, and a hit is the wrong place
 * to pay for it every time. The retention alarm is what guarantees expiry for a
 * badge that goes quiet; this only keeps a busy badge's record from growing
 * between alarms.
 */
const CLEANUP_EVERY_HITS = 100;

/** How many entries each `top…` list in the summary carries. */
const TOP_LIMIT = 10;

/** Named windows the summary reports over, in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const FOURTEEN_DAYS_MS = 14 * ONE_DAY_MS;

/** How much recent hourly detail the summary carries. */
const HOURLY_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Drop bucket keys whose period has fallen outside the retention window. */
function retainRecent(
  buckets: Record<string, number>,
  parseBucket: (key: string) => number,
  now: number,
): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const [key, value] of Object.entries(buckets)) {
    if (now - parseBucket(key) < RETENTION_MS) {
      kept[key] = value;
    }
  }
  return kept;
}

/** The busiest entries of a tally, as the summary publishes them. */
function topBy<K extends string>(
  counts: Record<string, number>,
  label: K,
): Array<{ [P in K]: string } & { count: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_LIMIT)
    .map(([name, count]) => ({ [label]: name, count })) as Array<
    { [P in K]: string } & { count: number }
  >;
}

/**
 * Freeze a finished day's sketch into `dailyUniqueVisitors` and discard it, so
 * only the current day's registers are ever retained.
 *
 * Returns whether anything changed, so the caller knows to persist.
 */
export function freezeStaleSketch(
  analytics: StoredAnalytics,
  now: number,
): boolean {
  const current = analytics.todaySketch;
  if (!current || current.date === getDateBucket(now)) {
    return false;
  }

  analytics.dailyUniqueVisitors[current.date] = estimateSketch(current);
  analytics.todaySketch = undefined;
  return true;
}

/**
 * Drop every bucket outside the retention window.
 *
 * The three maps expire on the same rule and differ only in how their keys
 * decode to a time, which is the whole of what `retainRecent` abstracts.
 */
export function pruneExpired(analytics: StoredAnalytics, now: number): void {
  analytics.hourlyHits = retainRecent(
    analytics.hourlyHits,
    parseHourBucket,
    now,
  );
  analytics.dailyHits = retainRecent(analytics.dailyHits, parseDateBucket, now);
  analytics.dailyUniqueVisitors = retainRecent(
    analytics.dailyUniqueVisitors,
    parseDateBucket,
    now,
  );
}

/**
 * Whether a record still holds anything the retention window covers.
 *
 * Used to decide if the cleanup alarm is still worth running: once a badge has
 * been quiet for longer than retention, a prune has nothing left to remove and
 * waking the object again would be pure cost. The next hit restarts it.
 */
export function withinRetention(
  analytics: StoredAnalytics,
  now: number,
): boolean {
  return now - analytics.lastUpdated < RETENTION_MS;
}

/**
 * Fold one hit into a record.
 *
 * `dailyKey` is the day's visitor hashing key, or undefined when the service
 * has no secret configured. Deriving it needs a secret and this module has no
 * business reading one, so it is passed in - and when it is absent the unique
 * visitor estimate is skipped rather than silently downgraded to something
 * weaker. The address is only ever hashed into the sketch's registers; neither
 * it nor the key is stored.
 */
export async function applyHit(
  analytics: StoredAnalytics,
  request: HitRequest,
  now: number,
  dailyKey?: Uint8Array,
): Promise<void> {
  const hourBucket = getHourBucket(now);
  const dateBucket = getDateBucket(now);

  analytics.totalHits += 1;
  analytics.lastUpdated = now;

  analytics.hourlyHits[hourBucket] =
    (analytics.hourlyHits[hourBucket] || 0) + 1;
  analytics.dailyHits[dateBucket] = (analytics.dailyHits[dateBucket] || 0) + 1;

  freezeStaleSketch(analytics, now);
  if (dailyKey) {
    if (!analytics.todaySketch) {
      analytics.todaySketch = createSketch(dateBucket);
    }
    await addToSketch(analytics.todaySketch, request.ip, dailyKey);
  }

  const host = referrerHost(request.referrer);
  analytics.referrers[host] = (analytics.referrers[host] || 0) + 1;

  analytics.countries[request.country] =
    (analytics.countries[request.country] || 0) + 1;

  const simplifiedUA = simplifyUserAgent(request.userAgent);
  analytics.userAgents[simplifiedUA] =
    (analytics.userAgents[simplifiedUA] || 0) + 1;

  const platform = detectPlatform(request.userAgent);
  analytics.platforms[platform] = (analytics.platforms[platform] || 0) + 1;

  if (analytics.totalHits % CLEANUP_EVERY_HITS === 0) {
    pruneExpired(analytics, now);
  }
}

/**
 * Derive the published summary from a record.
 *
 * Read-only: pruning and freezing are the caller's to do first, because both
 * change the record and only the caller can persist it.
 *
 * The reported windows are named constants rather than fractions of the
 * retention constant, deliberately. These are published field names, so
 * widening retention must not silently redefine what `hitsLast14Days` counts.
 */
export function summarize(
  analytics: StoredAnalytics,
  now: number,
): AnalyticsSummary {
  let hitsLast24Hours = 0;
  let hitsLast7Days = 0;
  let hitsLast14Days = 0;

  for (const [hourKey, count] of Object.entries(analytics.hourlyHits)) {
    const age = now - parseHourBucket(hourKey);

    if (age < ONE_DAY_MS) {
      hitsLast24Hours += count;
    }
    if (age < SEVEN_DAYS_MS) {
      hitsLast7Days += count;
    }
    if (age < FOURTEEN_DAYS_MS) {
      hitsLast14Days += count;
    }
  }

  // Today's estimate comes from the live sketch; every earlier day reads the
  // integer that was frozen when that day ended. A day that predates the
  // measurement has neither, and reports null rather than zero.
  const today = getDateBucket(now);
  const uniqueVisitorsToday = analytics.todaySketch
    ? estimateSketch(analytics.todaySketch)
    : null;
  const frozenUniques = analytics.dailyUniqueVisitors;

  const dailyStats = Object.entries(analytics.dailyHits)
    .map(([date, hits]) => ({
      date,
      hits,
      uniqueVisitors:
        date === today ? uniqueVisitorsToday : (frozenUniques[date] ?? null),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourlyStats = Object.entries(analytics.hourlyHits)
    .map(([hour, hits]) => ({ hour, hits }))
    .filter(({ hour }) => now - parseHourBucket(hour) < HOURLY_WINDOW_MS)
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return {
    totalHits: analytics.totalHits,
    uniqueVisitorsToday,
    hitsLast24Hours,
    hitsLast7Days,
    hitsLast14Days,
    topReferrers: topBy(analytics.referrers, "referrer"),
    topCountries: topBy(analytics.countries, "country"),
    topUserAgents: topBy(analytics.userAgents, "agent"),
    topPlatforms: topBy(analytics.platforms, "platform"),
    dailyStats,
    hourlyStats,
  };
}
