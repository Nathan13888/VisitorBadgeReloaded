import { describe, expect, mock, test } from "bun:test";

/**
 * `hashPageId` hashes with MD5, which workerd offers and WebCrypto does not, so
 * the real one cannot run here. Which key a page ID maps to is `util`'s
 * business and is fixed by v1 regardless; what these tests are about is how the
 * three outcomes of the lookup are told apart.
 */
mock.module("../util", () => ({
  hashPageId: async (pageId: string) => `md5:${pageId}`,
}));

const { migrateFromKV } = await import("./migrate-kv");

const NOW = Date.UTC(2026, 0, 15, 12, 30, 0);
const TODAY = "2026-01-15";

/**
 * Stand-in for the v1 namespace, keyed the way the real one is: by the one-way
 * hash of the page ID, which is the only handle v1 ever stored.
 */
function fakeKv(entries: Record<string, string>): KVNamespace {
  return {
    get: async (key: string) => entries[key] ?? null,
  } as unknown as KVNamespace;
}

/** A namespace that is unreachable, as it is during a KV outage. */
function brokenKv(error: Error): KVNamespace {
  return {
    get: async () => {
      throw error;
    },
  } as unknown as KVNamespace;
}

function withCount(pageId: string, value: string): KVNamespace {
  return fakeKv({ [`md5:${pageId}`]: value });
}

describe("migrateFromKV", () => {
  test("carries a v1 count over, attributed to today", async () => {
    const kv = withCount("alpha", "1234");

    const result = await migrateFromKV(kv, "alpha", NOW);

    expect(result.status).toBe("migrated");
    if (result.status !== "migrated") return;

    expect(result.record.totalHits).toBe(1234);
    expect(result.record.dailyHits).toEqual({ [TODAY]: 1234 });
    expect(result.record.pageId).toBe("alpha");
    // At the current version, so a migrated badge never takes the upgrade path.
    expect(result.record.schemaVersion).toBe(2);
  });

  test("reports a badge that was never on v1 as absent", async () => {
    const result = await migrateFromKV(fakeKv({}), "alpha", NOW);

    expect(result.status).toBe("absent");
  });

  test("reports an unusable stored value as absent, not as a failure", async () => {
    // Nothing to retry: the count is already unrecoverable, and refusing to
    // serve the badge would not bring it back.
    for (const value of ["not a number", "0", "-5", ""]) {
      const kv = withCount("alpha", value);
      expect((await migrateFromKV(kv, "alpha", NOW)).status).toBe("absent");
    }
  });

  test("reports an unreachable namespace as a failure, distinctly", async () => {
    const outage = new Error("KV unavailable");

    const result = await migrateFromKV(brokenKv(outage), "alpha", NOW);

    // The distinction is the point. Collapsing this into `absent` is what let a
    // momentary outage shadow a legacy count for good: the caller would treat
    // the badge as new and give it storage of its own, after which this is
    // never consulted again.
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.error).toBe(outage);
  });
});
