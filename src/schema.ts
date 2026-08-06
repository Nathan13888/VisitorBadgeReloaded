/**
 * The single source of truth for every analytics shape in the service.
 *
 * Three consumers used to describe the same data independently: the Durable
 * Object declared TypeScript interfaces, the worker restated them as an inline
 * Zod object for OpenAPI, and the client between them asserted a type onto
 * unvalidated JSON. Nothing tied the three together, so they drifted silently
 * and the only symptom was a wrong entry in the published API docs.
 *
 * Everything here is a Zod schema, and every TypeScript type is inferred from
 * one. The OpenAPI route resolves the same object the client validates against,
 * so a field can no longer exist in one description and not another.
 */

import { z } from "zod";

/**
 * Version stamped onto every persisted analytics record.
 *
 * Version 1 is implicit: it is any record written before this field existed.
 * Bump this only when the stored shape changes in a way `StoredAnalyticsSchema`
 * would otherwise reject, and extend `upgradeStoredAnalytics` in the same
 * commit.
 */
export const SCHEMA_VERSION = 2;

/** Number of days of hourly, daily, and unique-visitor history retained. */
export const RETENTION_DAYS = 14;

/**
 * Whether a string decodes to at least one byte of base64.
 *
 * Registers reach `atob` on the read path, where a malformed string throws and
 * takes the whole summary with it. The non-empty requirement matters just as
 * much: an empty register array divides by zero in the estimator and yields
 * `NaN`, which would then have to survive all the way out to the API. Checking
 * both here means a corrupt sketch is discarded by the repair path instead.
 */
function isBase64(value: string): boolean {
  try {
    return atob(value).length > 0;
  } catch {
    return false;
  }
}

/** A single day's HyperLogLog sketch, as persisted. See `./hll`. */
export const HllSketchSchema = z.object({
  /** UTC date this sketch covers, formatted YYYY-MM-DD. */
  date: z.string(),
  /** base64 of the sketch's registers, one byte each. */
  registers: z.string().refine(isBase64, "registers must be base64"),
});

/** Non-negative whole number, the shape every tally in here takes. */
const Count = z.number().int().nonnegative();

/**
 * A bucket-keyed tally: hour or date key to a count.
 *
 * Held to the same `Count` the summary publishes, deliberately. The summary is
 * derived from these maps and is validated on the way out, so a value that is
 * storable but not publishable would be a record that loads cleanly and then
 * fails every read. Rejecting it here routes it to the repair path instead.
 */
const CounterMap = z.record(z.string(), Count);

/**
 * The analytics record exactly as it is persisted, at the current version.
 *
 * Deliberately strict about `schemaVersion`: a record without it is a legacy
 * record and must go through `upgradeStoredAnalytics` rather than being read
 * as-is. That is what keeps the compatibility handling in one function instead
 * of spread across every field access.
 */
export const StoredAnalyticsSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  pageId: z.string(),
  totalHits: Count,
  lastUpdated: z.number(),
  /** Hourly buckets, keyed YYYY-MM-DD-HH. */
  hourlyHits: CounterMap,
  /** Daily aggregates, keyed YYYY-MM-DD. */
  dailyHits: CounterMap,
  /** Frozen unique visitor estimates for past days only. */
  dailyUniqueVisitors: CounterMap,
  /** In-progress sketch for the current UTC day. */
  todaySketch: HllSketchSchema.optional(),
  referrers: CounterMap,
  countries: CounterMap,
  userAgents: CounterMap,
  platforms: CounterMap,
});

export type StoredAnalytics = z.infer<typeof StoredAnalyticsSchema>;

/**
 * The same record, parsed so that it always succeeds.
 *
 * Every field falls back rather than failing, so a record that is corrupt in
 * one place still yields a usable badge. `totalHits` is the one number a
 * visitor actually sees, so losing it would be the one visible regression;
 * it survives whenever it is a valid count, and the breakdowns around it are
 * allowed to reset. Reaching this path is logged - it is a repair, not a
 * routine parse.
 */
export const RepairAnalyticsSchema = z.object({
  pageId: z.string().catch(""),
  totalHits: Count.catch(0),
  lastUpdated: z.number().catch(0),
  hourlyHits: CounterMap.catch({}),
  dailyHits: CounterMap.catch({}),
  dailyUniqueVisitors: CounterMap.catch({}),
  todaySketch: HllSketchSchema.optional().catch(undefined),
  referrers: CounterMap.catch({}),
  countries: CounterMap.catch({}),
  userAgents: CounterMap.catch({}),
  platforms: CounterMap.catch({}),
});

/**
 * A version 1 record: the shape written before `schemaVersion` existed.
 *
 * Fields that version 1 added over its own lifetime default rather than fail,
 * because a badge last written before they appeared is an ordinary old record,
 * not a damaged one. This is what the Durable Object used to patch up inline at
 * four separate call sites.
 */
const LegacyAnalyticsSchema = StoredAnalyticsSchema.omit({
  schemaVersion: true,
}).extend({
  dailyUniqueVisitors: CounterMap.default({}),
  userAgents: CounterMap.default({}),
  platforms: CounterMap.default({}),
});

/**
 * Bring a stored record to the current version.
 *
 * This is the only place that knows anything about older shapes, and it runs
 * once per badge: the upgraded record is written back immediately, so the next
 * read matches `StoredAnalyticsSchema` and skips this entirely. Cloudflare
 * offers no way to enumerate Durable Objects by name and the v1 KV keys are
 * one-way hashes of the page ID, so upgrading on first touch is the only
 * mechanism available - there is nothing to sweep.
 *
 * When the legacy window closes, deleting this function, `LegacyAnalyticsSchema`
 * and `RepairAnalyticsSchema` removes all of it; the strict parse at the call
 * site is what remains.
 *
 * `repaired` distinguishes the two reasons a record can arrive here. An orderly
 * version 1 record is not a repair. A record that failed even the lenient
 * legacy parse is, and the caller logs it.
 */
export function upgradeStoredAnalytics(
  raw: unknown,
  fallbackPageId: string,
): { record: StoredAnalytics; repaired: boolean } {
  // Versions before 08/05/26 persisted a set of raw client addresses under
  // `uniqueVisitors`. Dropping the field here is what deletes them: the
  // upgraded record is persisted before anything else reads it.
  const { uniqueVisitors: _dropped, ...rest } = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const legacy = LegacyAnalyticsSchema.safeParse(rest);
  const base = legacy.success ? legacy.data : RepairAnalyticsSchema.parse(rest);

  return {
    record: {
      ...base,
      schemaVersion: SCHEMA_VERSION,
      pageId: base.pageId || fallbackPageId,
    },
    repaired: !legacy.success,
  };
}

/**
 * An empty record for a badge that has not been seen before.
 */
export function emptyAnalytics(pageId: string, now: number): StoredAnalytics {
  return {
    schemaVersion: SCHEMA_VERSION,
    pageId,
    totalHits: 0,
    lastUpdated: now,
    hourlyHits: {},
    dailyHits: {},
    dailyUniqueVisitors: {},
    referrers: {},
    countries: {},
    userAgents: {},
    platforms: {},
  };
}

/**
 * The analytics summary, as returned by the Durable Object, validated by the
 * client, rendered by the info page, and published in the OpenAPI document.
 *
 * The `.describe` calls are not decoration: they are what the generated docs
 * and `/llms.txt` show, so the caveats on the estimated metrics live next to
 * the fields they qualify rather than in a separate description of the API.
 */
export const AnalyticsSummarySchema = z.object({
  totalHits: Count,
  uniqueVisitorsToday: Count.nullable().describe(
    "Estimated distinct visitors so far today (UTC), from a HyperLogLog sketch with ~6.5% margin of error. Not a person-level count. Null when the metric is unavailable.",
  ),
  hitsLast24Hours: Count,
  hitsLast7Days: Count,
  hitsLast14Days: Count,
  topReferrers: z.array(z.object({ referrer: z.string(), count: Count })),
  topCountries: z.array(z.object({ country: z.string(), count: Count })),
  topUserAgents: z.array(z.object({ agent: z.string(), count: Count })),
  topPlatforms: z.array(z.object({ platform: z.string(), count: Count })),
  dailyStats: z.array(
    z.object({
      date: z.string(),
      hits: Count,
      uniqueVisitors: Count.nullable().describe(
        "Estimated distinct visitors that day (~6.5% margin of error), or null for days predating this measurement.",
      ),
    }),
  ),
  hourlyStats: z.array(z.object({ hour: z.string(), hits: Count })),
});

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

/** Metadata the worker forwards with a recorded hit. */
export const HitRequestSchema = z.object({
  pageId: z.string(),
  ip: z.string(),
  referrer: z.string(),
  country: z.string(),
  userAgent: z.string(),
});

export type HitRequest = z.infer<typeof HitRequestSchema>;

/** Reply to `/count` and `/hit`. */
export const CountResponseSchema = z.object({ count: Count });

/** Reply to `/exists`. */
export const ExistsResponseSchema = z.object({ exists: z.boolean() });

/** The shape every error reply takes, internal and public alike. */
export const ErrorResponseSchema = z.object({ error: z.string() });
