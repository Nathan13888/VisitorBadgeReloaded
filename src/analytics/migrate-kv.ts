/**
 * One-way migration of a badge's count from the v1 KV namespace.
 *
 * v1 stored a single integer per badge under a one-way hash of its page ID.
 * There is no way to enumerate those keys and no way to enumerate Durable
 * Objects by name, so there is nothing to sweep: a badge migrates the first
 * time its object is touched and never again, because from then on the object
 * has storage of its own and this is not consulted.
 */

import { emptyAnalytics } from "../schema";
import type { StoredAnalytics } from "../schema";
import { getDateBucket } from "./buckets";

/**
 * Build a v2 record from a badge's v1 KV count, or null when there is nothing
 * to migrate.
 *
 * Returns null rather than throwing on failure. A badge whose migration fails
 * starts empty, which loses a historical count; taking the whole request down
 * instead would lose the badge.
 */
export async function migrateFromKV(
  kv: KVNamespace,
  pageId: string,
  now: number,
): Promise<StoredAnalytics | null> {
  try {
    // Imported here rather than at module scope so the md5 helper is only
    // loaded by the one badge in a million that is still on v1.
    const { hashPageId } = await import("../util");
    const kvCount = await kv.get(await hashPageId(pageId));

    if (!kvCount) {
      return null;
    }

    const count = Number.parseInt(kvCount, 10);
    if (Number.isNaN(count) || count <= 0) {
      return null;
    }

    console.log(`Migrating badge ${pageId} from KV: ${count} hits`);

    // Written at the current schema version, so a migrated badge never takes
    // the upgrade path. The historical count has no per-day detail behind it,
    // so all of it is attributed to today.
    return {
      ...emptyAnalytics(pageId, now),
      totalHits: count,
      dailyHits: { [getDateBucket(now)]: count },
    };
  } catch (error) {
    console.error("Error during KV migration:", error);
    return null;
  }
}
