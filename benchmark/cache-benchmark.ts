/**
 * Cache Behavior Benchmark
 * Tests how the service handles caching and repeated requests
 */

const BASE_URL = "https://vbr.nathanchung.dev";

interface CacheTestResult {
  testName: string;
  firstRequestTime: number;
  subsequentRequestTimes: number[];
  avgSubsequentTime: number;
  cacheSpeedup: number;
  cacheHitRate: number;
}

interface Measurement {
  ms: number;
  /** `X-VBR-Cache`: HIT, MISS, or BYPASS for a response that is never cached. */
  cache: string;
}

async function measureRequest(url: string): Promise<Measurement> {
  const start = performance.now();
  const response = await fetch(url);
  await response.text(); // Ensure full download
  return {
    ms: performance.now() - start,
    cache: response.headers.get("X-VBR-Cache") ?? "UNKNOWN",
  };
}

/**
 * Share of responses the edge actually served from cache.
 *
 * Measured rather than assumed. Note that `CF-Cache-Status` is not the header
 * to look at here: the Worker caches through the Cache API, which does not
 * report itself that way, so the Worker stamps its own outcome instead. Entries
 * are per Cloudflare location, so a client reaching a different location than
 * the one that filled the cache legitimately sees a miss.
 */
function hitRate(measurements: Measurement[]): number {
  if (measurements.length === 0) {
    return 0;
  }
  const hits = measurements.filter((m) => m.cache === "HIT").length;
  return (hits / measurements.length) * 100;
}

async function testCacheBehavior(): Promise<void> {
  console.log("🔄 Cache Behavior Benchmark");
  console.log(`📍 Testing: ${BASE_URL}\n`);

  const testId = `cache-test-${Date.now()}`;
  const results: CacheTestResult[] = [];

  // Test 1: Same badge repeated requests (should benefit from CDN/edge cache)
  console.log("Test 1: Repeated requests to same badge...");
  const badgeUrl = `${BASE_URL}/badge?page_id=${testId}&hit=false`;
  const firstRequest = await measureRequest(badgeUrl);
  console.log(`  First request: ${firstRequest.ms.toFixed(2)}ms`);

  const subsequentRequests: Measurement[] = [];
  for (let i = 0; i < 20; i++) {
    subsequentRequests.push(await measureRequest(badgeUrl));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgSubsequent =
    subsequentRequests.reduce((a, b) => a + b.ms, 0) /
    subsequentRequests.length;
  const subsequentHitRate = hitRate(subsequentRequests);
  console.log(`  Average subsequent: ${avgSubsequent.toFixed(2)}ms`);
  console.log(`  Speedup: ${(firstRequest.ms / avgSubsequent).toFixed(2)}x`);
  console.log(`  Cache hit rate: ${subsequentHitRate.toFixed(1)}%`);

  results.push({
    testName: "Same Badge Repeated Requests",
    firstRequestTime: firstRequest.ms,
    subsequentRequestTimes: subsequentRequests.map((m) => m.ms),
    avgSubsequentTime: avgSubsequent,
    cacheSpeedup: firstRequest.ms / avgSubsequent,
    cacheHitRate: subsequentHitRate,
  });

  // Test 2: Different badges (cache misses)
  console.log("\nTest 2: Different badges (cache misses)...");
  const differentBadges: Measurement[] = [];
  for (let i = 0; i < 20; i++) {
    const url = `${BASE_URL}/badge?page_id=${testId}-${i}&hit=false`;
    differentBadges.push(await measureRequest(url));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgDifferent =
    differentBadges.reduce((a, b) => a + b.ms, 0) / differentBadges.length;
  console.log(`  Average time: ${avgDifferent.toFixed(2)}ms`);
  console.log(`  Cache hit rate: ${hitRate(differentBadges).toFixed(1)}%`);

  // Test 3: Badge with hit=true (write operations)
  console.log("\nTest 3: Badges with hit counting enabled...");
  const hitBadgeUrl = `${BASE_URL}/badge?page_id=${testId}-hits`;
  const firstHitRequest = await measureRequest(hitBadgeUrl);
  console.log(`  First request: ${firstHitRequest.ms.toFixed(2)}ms`);

  const subsequentHitRequests: Measurement[] = [];
  for (let i = 0; i < 20; i++) {
    subsequentHitRequests.push(await measureRequest(hitBadgeUrl));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgHitSubsequent =
    subsequentHitRequests.reduce((a, b) => a + b.ms, 0) /
    subsequentHitRequests.length;
  console.log(`  Average subsequent: ${avgHitSubsequent.toFixed(2)}ms`);

  // Expected to be zero: a counted view must never be served from a cache, or
  // the cache would swallow the hit. Measured so a regression would show up.
  const hitCountingHitRate = hitRate(subsequentHitRequests);
  console.log(`  Cache hit rate: ${hitCountingHitRate.toFixed(1)}%`);

  results.push({
    testName: "Hit Counting Enabled",
    firstRequestTime: firstHitRequest.ms,
    subsequentRequestTimes: subsequentHitRequests.map((m) => m.ms),
    avgSubsequentTime: avgHitSubsequent,
    cacheSpeedup: firstHitRequest.ms / avgHitSubsequent,
    cacheHitRate: hitCountingHitRate,
  });

  // Test 4: Different styling of same badge. These are distinct renders, so
  // each is its own cache entry, but they share one count read behind the
  // scenes rather than each hitting the Durable Object.
  console.log("\nTest 4: Same badge, different styling...");
  const styles = ["flat", "flat-square", "plastic", "for-the-badge"];
  const styleTimes: number[] = [];

  for (const style of styles) {
    const url = `${BASE_URL}/badge?page_id=${testId}-style&style=${style}&hit=false`;
    const measurement = await measureRequest(url);
    styleTimes.push(measurement.ms);
    console.log(
      `  Style '${style}': ${measurement.ms.toFixed(2)}ms (${measurement.cache})`,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 CACHE BEHAVIOR SUMMARY");
  console.log("=".repeat(60));

  console.log("\nComparison:");
  console.log(`  Read-only cached:     ${avgSubsequent.toFixed(2)}ms`);
  console.log(`  Read-only uncached:   ${avgDifferent.toFixed(2)}ms`);
  console.log(`  With hit counting:    ${avgHitSubsequent.toFixed(2)}ms`);
  console.log(
    `\n  Cache benefit:        ${(((avgDifferent - avgSubsequent) / avgDifferent) * 100).toFixed(2)}% faster`,
  );
  console.log(
    `  Hit counting overhead: ${(((avgHitSubsequent - avgSubsequent) / avgSubsequent) * 100).toFixed(2)}% slower`,
  );

  // Export results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(
    `benchmark/results/cache-benchmark-${timestamp}.json`,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  );

  console.log("\n✅ Cache benchmark completed!\n");
}

testCacheBehavior().catch(console.error);
