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
 * The three outcomes of looking a badge up in the v1 namespace.
 *
 * `absent` and `failed` are kept apart deliberately, and that distinction is
 * the whole reason this is not just `StoredAnalytics | null`. Collapsing them
 * makes a KV outage indistinguishable from a badge that was never on v1, and
 * the caller's answer to those two differs completely: one may start a fresh
 * record, the other must not, because doing so gives the object storage of its
 * own and this is never consulted again. A momentary outage would shadow a
 * legacy count for good.
 *
 * A value that is present but unusable - not a number, or not positive - is
 * `absent` rather than `failed`. There is nothing to retry: the count is
 * already unrecoverable, and refusing to serve the badge would not bring it
 * back.
 */
export type KvMigration =
  | { status: "migrated"; record: StoredAnalytics }
  | { status: "absent" }
  | { status: "failed"; error: unknown };

/**
 * Look a badge up in the v1 namespace and build a v2 record from its count.
 *
 * Only the lookup itself is allowed to fail: the import and the KV read are
 * inside the `try` and nothing else is, so `failed` always means the namespace
 * could not be asked, never that something went wrong interpreting an answer
 * it gave.
 */
export async function migrateFromKV(
  kv: KVNamespace,
  pageId: string,
  now: number,
): Promise<KvMigration> {
  let kvCount: string | null;

  try {
    // Imported here rather than at module scope so the md5 helper is only
    // loaded by the one badge in a million that is still on v1.
    const { hashPageId } = await import("../util");
    kvCount = await kv.get(await hashPageId(pageId));
  } catch (error) {
    return { status: "failed", error };
  }

  if (!kvCount) {
    return { status: "absent" };
  }

  const count = Number.parseInt(kvCount, 10);
  if (Number.isNaN(count) || count <= 0) {
    return { status: "absent" };
  }

  console.log(`Migrating badge ${pageId} from KV: ${count} hits`);

  // Written at the current schema version, so a migrated badge never takes
  // the upgrade path. The historical count has no per-day detail behind it,
  // so all of it is attributed to today.
  return {
    status: "migrated",
    record: {
      ...emptyAnalytics(pageId, now),
      totalHits: count,
      dailyHits: { [getDateBucket(now)]: count },
    },
  };
}
