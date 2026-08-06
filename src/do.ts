/**
 * A badge's Durable Object: the storage behind one page ID.
 *
 * What is left here is only the part that needs the object - its HTTP surface,
 * its stored record, and the lifecycle around that record. What a hit does, what
 * expires, and how a summary is derived are plain functions in `./analytics`,
 * so they can be read and tested without a Durable Object underneath them.
 */

import { DurableObject } from "cloudflare:workers";
import { getDateBucket } from "./analytics/buckets";
import { migrateFromKV } from "./analytics/migrate-kv";
import {
  applyHit,
  freezeStaleSketch,
  pruneExpired,
  summarize,
  withinRetention,
} from "./analytics/state";
import { DO_ROUTES } from "./do-client";
import { deriveDailyKey } from "./hll";
import {
  StoredAnalyticsSchema,
  emptyAnalytics,
  upgradeStoredAnalytics,
} from "./schema";
import type { AnalyticsSummary, HitRequest, StoredAnalytics } from "./schema";

/** How often the retention alarm wakes an object to prune it. */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Durable Object for badge analytics
 */
export class BadgeDO extends DurableObject {
  private analytics: StoredAnalytics | null = null;
  private initialized = false;
  private alarmScheduled = false;
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
    const { pathname } = new URL(request.url);
    const matches = (route: { path: string; method: string }) =>
      pathname === route.path && request.method === route.method;

    try {
      if (matches(DO_ROUTES.count)) {
        return Response.json(await this.getCount());
      }

      if (matches(DO_ROUTES.hit)) {
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

      if (matches(DO_ROUTES.summary)) {
        const result = await this.getSummary();
        if (!result) {
          return Response.json({ error: "No analytics data" }, { status: 404 });
        }
        return Response.json(result);
      }

      if (matches(DO_ROUTES.exists)) {
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
      // No DO storage found - check KV for the badge's v1 count.
      const pageId = this.ctx.id.name || pageIdHint;

      if (pageId) {
        const migrated = await migrateFromKV(
          this.kvNamespace,
          pageId,
          Date.now(),
        );
        if (migrated) {
          this.analytics = migrated;
          await this.persist();
          console.log(
            `Successfully migrated badge ${pageId} with ${migrated.totalHits} hits`,
          );
        }
      } else {
        console.log("No pageId found for migration");
      }
    }

    this.initialized = true;
  }

  /**
   * Record a hit
   */
  async recordHit(request: HitRequest): Promise<{ count: number }> {
    await this.initialize(request.pageId);

    const now = Date.now();

    // Anything loaded from storage has already been brought to the current
    // schema version by `initialize`, so from here on every field is known to
    // exist.
    if (!this.analytics) {
      this.analytics = emptyAnalytics(request.pageId, now);
    }

    const key = await this.dailyKey(request.pageId, getDateBucket(now));
    await applyHit(this.analytics, request, now, key);

    // Persisted without awaiting, deliberately.
    //
    // Awaiting a storage write disables the runtime's write coalescing, so the
    // `await` that used to be here forced one full-object write per hit and
    // made a popular badge queue them one behind another. Unawaited, every hit
    // that arrives while a flush is in flight is combined into a single atomic
    // write, and a burst costs what one hit used to.
    //
    // This does not weaken durability: the output gate still holds this
    // response until the write is confirmed, so no caller can observe a count
    // that was not stored. It is the caller that no longer waits - see
    // `recordHitInBackground` in `badge-request.ts`.
    this.persist();

    // Only a badge that has data schedules an alarm, so a client rotating
    // through invented page IDs cannot leave a trail of objects waking
    // themselves every six hours.
    await this.ensureCleanupAlarm();

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
    const froze = freezeStaleSketch(this.analytics, now);

    pruneExpired(this.analytics, now);

    if (froze) {
      await this.persist();
    }

    return summarize(this.analytics, now);
  }

  /**
   * Persist analytics to storage
   */
  private async persist() {
    if (!this.analytics) return;

    await this.ctx.storage.put("analytics", this.analytics);
  }

  /**
   * Make sure a retention alarm is pending.
   *
   * Checked once per instance rather than per hit: the flag costs nothing and
   * the storage read it avoids is on the write path. `getAlarm` is what makes
   * this idempotent across instances - an object that already has an alarm
   * pending from an earlier lifetime does not get a second one.
   */
  private async ensureCleanupAlarm() {
    if (this.alarmScheduled) return;
    this.alarmScheduled = true;

    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
    }
  }

  /**
   * Alarm handler for periodic cleanup.
   *
   * This is what actually enforces retention. Pruning on the write path only
   * runs every hundredth hit, so without this a badge that is hit a handful of
   * times and then abandoned keeps its buckets - and the visitor detail in
   * them - indefinitely.
   *
   * It stops rescheduling once the record has nothing left inside the retention
   * window, so an abandoned badge stops costing anything; the next hit starts
   * the cycle again through `ensureCleanupAlarm`.
   */
  async alarm() {
    const now = Date.now();

    await this.initialize();

    if (this.analytics) {
      pruneExpired(this.analytics, now);
      await this.persist();
    }

    this.alarmScheduled = false;

    if (this.analytics && withinRetention(this.analytics, now)) {
      await this.ensureCleanupAlarm();
    }
  }
}
