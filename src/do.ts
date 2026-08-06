import { DurableObject } from "cloudflare:workers";
import { DO_ROUTES } from "./do-client";
import {
  addToSketch,
  createSketch,
  deriveDailyKey,
  estimateSketch,
} from "./hll";
import {
  RETENTION_DAYS,
  StoredAnalyticsSchema,
  emptyAnalytics,
  upgradeStoredAnalytics,
} from "./schema";
import type { AnalyticsSummary, HitRequest, StoredAnalytics } from "./schema";

/** How long any bucketed history is kept, in milliseconds. */
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Get current hour bucket key (format: YYYY-MM-DD-HH)
 */
function getHourBucket(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Get current date key (format: YYYY-MM-DD)
 */
function getDateBucket(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse hour bucket to timestamp
 */
function parseHourBucket(bucket: string): number {
  const parts = bucket.split("-");
  return new Date(
    `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:00:00Z`,
  ).getTime();
}

/**
 * Parse date bucket to timestamp
 */
function parseDateBucket(bucket: string): number {
  return new Date(`${bucket}T00:00:00Z`).getTime();
}

/**
 * Extract platform from user agent string
 */
function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // Bots and crawlers
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "Bot";
  }

  // Mobile platforms
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod"))
    return "iOS";

  // Desktop platforms
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("cros")) return "Chrome OS";

  return "Other";
}

/**
 * Bucket a request's referrer by host.
 *
 * `Referer` is attacker-controlled and need not be a URL at all. Parsing it
 * unguarded threw, which failed the whole hit, which returned a 500 that the
 * worker then read a count out of - a malformed header on one request was
 * enough to break the badge. An unparseable value is just an unknown source.
 */
function referrerHost(referrer: string): string {
  if (referrer === "direct") {
    return "Direct";
  }

  try {
    return new URL(referrer).hostname;
  } catch {
    return "Unknown";
  }
}

/**
 * Simplify user agent for tracking
 */
function simplifyUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // Check for common bots first
  if (ua.includes("googlebot")) return "Googlebot";
  if (ua.includes("bingbot")) return "Bingbot";
  if (ua.includes("slackbot")) return "Slackbot";
  if (ua.includes("twitterbot")) return "Twitterbot";
  if (ua.includes("facebookexternalhit")) return "Facebook Bot";
  if (ua.includes("linkedinbot")) return "LinkedIn Bot";
  if (ua.includes("discordbot")) return "Discord Bot";
  if (ua.includes("whatsapp")) return "WhatsApp";

  // Browsers
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome")) return "Safari";

  // GitHub's image proxy
  if (ua.includes("github-camo")) return "GitHub Camo";

  return "Other";
}

/**
 * Durable Object for badge analytics
 */
export class BadgeDO extends DurableObject {
  private analytics: StoredAnalytics | null = null;
  private initialized = false;
  private kvNamespace: KVNamespace;
  private hashSecret: string | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.kvNamespace = env.vbr_badge_counts;
    this.hashSecret = env.VISITOR_HASH_KEY;
  }

  /**
   * Derive today's hashing key, or undefined when the secret is not configured.
   *
   * Recomputed per hit rather than stored, so a storage dump cannot be probed
   * for whether a guessed address visited.
   */
  private async dailyKey(
    pageId: string,
    date: string,
  ): Promise<Uint8Array | undefined> {
    if (!this.hashSecret) {
      return undefined;
    }
    return await deriveDailyKey(this.hashSecret, pageId, date);
  }

  /**
   * Fetch handler for Durable Object HTTP requests.
   *
   * Routes are matched against the same table `src/do-client.ts` calls through,
   * so the two halves of the boundary cannot disagree about a path or a method.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === DO_ROUTES.count.path && method === DO_ROUTES.count.method) {
        return Response.json(await this.getCount());
      }

      if (path === DO_ROUTES.hit.path && method === DO_ROUTES.hit.method) {
        // Validated rather than cast: a payload that does not match is a
        // client bug, and answering 400 says so instead of failing somewhere
        // deeper with a message about the wrong thing.
        const payload = DO_ROUTES.hit.request.safeParse(await request.json());
        if (!payload.success) {
          return Response.json(
            { error: `Invalid hit payload: ${payload.error.message}` },
            { status: 400 },
          );
        }
        return Response.json(await this.recordHit(payload.data));
      }

      if (
        path === DO_ROUTES.summary.path &&
        method === DO_ROUTES.summary.method
      ) {
        const result = await this.getSummary();
        if (!result) {
          return Response.json({ error: "No analytics data" }, { status: 404 });
        }
        return Response.json(result);
      }

      if (
        path === DO_ROUTES.exists.path &&
        method === DO_ROUTES.exists.method
      ) {
        await this.initialize();
        return Response.json({ exists: this.analytics !== null });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      console.error("Error in BadgeDO:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  /**
   * Load analytics from storage, upgrading the record if it predates the
   * current schema version.
   *
   * A record already at the current version is the fast path and writes
   * nothing. Anything else goes through `upgradeStoredAnalytics` exactly once
   * and is written straight back, so every subsequent load takes the fast path.
   * That is what keeps compatibility handling out of the read path: past this
   * point the record is known to match the schema and no field needs defending.
   */
  async initialize(pageIdHint?: string) {
    if (this.initialized) return;

    const stored = await this.ctx.storage.get<unknown>("analytics");

    if (stored !== undefined) {
      const current = StoredAnalyticsSchema.safeParse(stored);

      if (current.success) {
        this.analytics = current.data;
      } else {
        const { record, repaired } = upgradeStoredAnalytics(
          stored,
          this.ctx.id.name || pageIdHint || "",
        );

        if (repaired) {
          // Not reachable from an orderly older record, so this means the
          // stored value was actually damaged. The count is preserved when it
          // was salvageable and the breakdowns around it reset.
          console.error("analytics_record_repaired", {
            pageId: record.pageId,
            totalHits: record.totalHits,
          });
        }

        this.analytics = record;
        await this.persist();
      }
    } else {
      // No DO storage found - check KV for migration
      await this.migrateFromKV(pageIdHint);
    }

    this.initialized = true;
  }

  /**
   * Migrate data from KV namespace (v1) to Durable Object (v2)
   */
  private async migrateFromKV(pageIdHint?: string) {
    try {
      // Get the pageId from the Durable Object name
      // Note: The pageId is stored in the ctx.id.name since we use idFromName
      const pageId = this.ctx.id.name || pageIdHint;

      if (!pageId) {
        console.log("No pageId found for migration");
        return;
      }

      // Calculate MD5 hash of pageId (same as v1)
      const { hashPageId } = await import("./util");
      const hashedKey = await hashPageId(pageId);

      // Try to get the count from KV
      const kvCount = await this.kvNamespace.get(hashedKey);

      if (kvCount) {
        const count = Number.parseInt(kvCount, 10);
        if (!Number.isNaN(count) && count > 0) {
          const now = Date.now();
          const dateBucket = getDateBucket(now);

          console.log(`Migrating badge ${pageId} from KV: ${count} hits`);

          // Initialize analytics with migrated count. Written at the current
          // schema version, so a migrated badge never takes the upgrade path.
          this.analytics = {
            ...emptyAnalytics(pageId, now),
            totalHits: count,
            // Attribute all historical hits to today
            dailyHits: { [dateBucket]: count },
          };

          // Persist the migrated data
          await this.persist();

          console.log(
            `Successfully migrated badge ${pageId} with ${count} hits`,
          );
        }
      }
    } catch (error) {
      console.error("Error during KV migration:", error);
      // Don't throw - continue with empty analytics if migration fails
    }
  }

  /**
   * Freeze a finished day's sketch into `dailyUniqueVisitors` and discard it,
   * so only the current day's registers are ever retained.
   *
   * Returns whether anything changed, so the caller knows to persist.
   */
  private freezeStaleSketch(analytics: StoredAnalytics, now: number): boolean {
    const current = analytics.todaySketch;
    if (!current || current.date === getDateBucket(now)) {
      return false;
    }

    analytics.dailyUniqueVisitors[current.date] = estimateSketch(current);
    analytics.todaySketch = undefined;
    return true;
  }

  /**
   * Clean up old data outside the retention window
   */
  private cleanupOldData() {
    if (!this.analytics) return;

    const now = Date.now();

    // Clean hourly data
    const hourlyHits: Record<string, number> = {};
    for (const [key, value] of Object.entries(this.analytics.hourlyHits)) {
      const timestamp = parseHourBucket(key);
      if (now - timestamp < RETENTION_MS) {
        hourlyHits[key] = value;
      }
    }
    this.analytics.hourlyHits = hourlyHits;

    // Clean daily data
    const dailyHits: Record<string, number> = {};
    for (const [key, value] of Object.entries(this.analytics.dailyHits)) {
      const timestamp = parseDateBucket(key);
      if (now - timestamp < RETENTION_MS) {
        dailyHits[key] = value;
      }
    }
    this.analytics.dailyHits = dailyHits;

    // Clean frozen daily unique visitor estimates
    const dailyUniqueVisitors: Record<string, number> = {};
    for (const [key, value] of Object.entries(
      this.analytics.dailyUniqueVisitors,
    )) {
      const timestamp = parseDateBucket(key);
      if (now - timestamp < RETENTION_MS) {
        dailyUniqueVisitors[key] = value;
      }
    }
    this.analytics.dailyUniqueVisitors = dailyUniqueVisitors;
  }

  /**
   * Record a hit
   */
  async recordHit(request: HitRequest): Promise<{ count: number }> {
    await this.initialize(request.pageId);

    const now = Date.now();
    const hourBucket = getHourBucket(now);
    const dateBucket = getDateBucket(now);

    // Initialize analytics if needed. Anything loaded from storage has already
    // been brought to the current schema version by `initialize`, so from here
    // on every field is known to exist.
    if (!this.analytics) {
      this.analytics = emptyAnalytics(request.pageId, now);
    }

    // Increment total hits
    this.analytics.totalHits += 1;
    this.analytics.lastUpdated = now;

    // Update hourly bucket
    this.analytics.hourlyHits[hourBucket] =
      (this.analytics.hourlyHits[hourBucket] || 0) + 1;

    // Update daily bucket
    this.analytics.dailyHits[dateBucket] =
      (this.analytics.dailyHits[dateBucket] || 0) + 1;

    // Fold the address into today's sketch. It is hashed in memory with a key
    // derived from a Worker secret, and neither the address nor that key is
    // ever stored. Without the secret the metric is skipped rather than
    // silently downgraded to something weaker.
    this.freezeStaleSketch(this.analytics, now);
    const key = await this.dailyKey(request.pageId, dateBucket);
    if (key) {
      if (!this.analytics.todaySketch) {
        this.analytics.todaySketch = createSketch(dateBucket);
      }
      await addToSketch(this.analytics.todaySketch, request.ip, key);
    }

    // Track referrer
    const host = referrerHost(request.referrer);
    this.analytics.referrers[host] = (this.analytics.referrers[host] || 0) + 1;

    // Track country
    this.analytics.countries[request.country] =
      (this.analytics.countries[request.country] || 0) + 1;

    // Track user agent
    const simplifiedUA = simplifyUserAgent(request.userAgent);
    this.analytics.userAgents[simplifiedUA] =
      (this.analytics.userAgents[simplifiedUA] || 0) + 1;

    // Track platform
    const platform = detectPlatform(request.userAgent);
    this.analytics.platforms[platform] =
      (this.analytics.platforms[platform] || 0) + 1;

    // Cleanup old data periodically (every 100 hits)
    if (this.analytics.totalHits % 100 === 0) {
      this.cleanupOldData();
    }

    // Persist to storage
    await this.persist();

    return { count: this.analytics.totalHits };
  }

  /**
   * Get current count without incrementing
   */
  async getCount(): Promise<{ count: number }> {
    await this.initialize();
    return { count: this.analytics?.totalHits || 0 };
  }

  /**
   * Get analytics summary
   */
  async getSummary(): Promise<AnalyticsSummary | null> {
    await this.initialize();

    if (!this.analytics) {
      return null;
    }

    const now = Date.now();

    // Freeze a stale day before it is pruned. Today's sketch is left untouched,
    // and viewing a summary never starts one - only a hit does.
    const froze = this.freezeStaleSketch(this.analytics, now);

    // Clean up old data before generating summary
    this.cleanupOldData();

    if (froze) {
      await this.persist();
    }

    // Named windows rather than derived from the retention constant: these are
    // published field names, so widening retention must not silently redefine
    // what `hitsLast14Days` counts.
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    // Calculate time-based hits
    let hitsLast24Hours = 0;
    let hitsLast7Days = 0;
    let hitsLast14Days = 0;

    for (const [hourKey, count] of Object.entries(this.analytics.hourlyHits)) {
      const timestamp = parseHourBucket(hourKey);

      if (now - timestamp < oneDayMs) {
        hitsLast24Hours += count;
      }
      if (now - timestamp < sevenDaysMs) {
        hitsLast7Days += count;
      }
      if (now - timestamp < fourteenDaysMs) {
        hitsLast14Days += count;
      }
    }

    // Get top referrers
    const topReferrers = Object.entries(this.analytics.referrers)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top countries
    const topCountries = Object.entries(this.analytics.countries)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top user agents
    const topUserAgents = Object.entries(this.analytics.userAgents)
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top platforms
    const topPlatforms = Object.entries(this.analytics.platforms)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get daily stats (sorted by date)
    const today = getDateBucket(now);
    const todaySketch = this.analytics.todaySketch;
    const uniqueVisitorsToday = todaySketch
      ? estimateSketch(todaySketch)
      : null;
    const frozenUniques = this.analytics.dailyUniqueVisitors;
    const dailyStats = Object.entries(this.analytics.dailyHits)
      .map(([date, hits]) => ({
        date,
        hits,
        uniqueVisitors:
          date === today ? uniqueVisitorsToday : (frozenUniques[date] ?? null),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent hourly stats (last 48 hours)
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    const hourlyStats = Object.entries(this.analytics.hourlyHits)
      .map(([hour, hits]) => ({ hour, hits }))
      .filter(({ hour }) => {
        const timestamp = parseHourBucket(hour);
        return now - timestamp < fortyEightHoursMs;
      })
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      totalHits: this.analytics.totalHits,
      uniqueVisitorsToday,
      hitsLast24Hours,
      hitsLast7Days,
      hitsLast14Days,
      topReferrers,
      topCountries,
      topUserAgents,
      topPlatforms,
      dailyStats,
      hourlyStats,
    };
  }

  /**
   * Persist analytics to storage
   */
  private async persist() {
    if (!this.analytics) return;

    await this.ctx.storage.put("analytics", this.analytics);
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm() {
    await this.initialize();
    if (this.analytics) {
      this.cleanupOldData();
      await this.persist();
    }

    // Schedule next cleanup in 6 hours
    await this.ctx.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);
  }
}
