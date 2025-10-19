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

async function measureRequest(url: string): Promise<number> {
  const start = performance.now();
  const response = await fetch(url);
  await response.text(); // Ensure full download
  return performance.now() - start;
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
  console.log(`  First request: ${firstRequest.toFixed(2)}ms`);

  const subsequentRequests: number[] = [];
  for (let i = 0; i < 20; i++) {
    const time = await measureRequest(badgeUrl);
    subsequentRequests.push(time);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgSubsequent =
    subsequentRequests.reduce((a, b) => a + b, 0) / subsequentRequests.length;
  console.log(`  Average subsequent: ${avgSubsequent.toFixed(2)}ms`);
  console.log(`  Speedup: ${(firstRequest / avgSubsequent).toFixed(2)}x`);

  results.push({
    testName: "Same Badge Repeated Requests",
    firstRequestTime: firstRequest,
    subsequentRequestTimes: subsequentRequests,
    avgSubsequentTime: avgSubsequent,
    cacheSpeedup: firstRequest / avgSubsequent,
    cacheHitRate: 100, // Assumed
  });

  // Test 2: Different badges (cache misses)
  console.log("\nTest 2: Different badges (cache misses)...");
  const differentBadgeTimes: number[] = [];
  for (let i = 0; i < 20; i++) {
    const url = `${BASE_URL}/badge?page_id=${testId}-${i}&hit=false`;
    const time = await measureRequest(url);
    differentBadgeTimes.push(time);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgDifferent =
    differentBadgeTimes.reduce((a, b) => a + b, 0) / differentBadgeTimes.length;
  console.log(`  Average time: ${avgDifferent.toFixed(2)}ms`);

  // Test 3: Badge with hit=true (write operations)
  console.log("\nTest 3: Badges with hit counting enabled...");
  const hitBadgeUrl = `${BASE_URL}/badge?page_id=${testId}-hits`;
  const firstHitRequest = await measureRequest(hitBadgeUrl);
  console.log(`  First request: ${firstHitRequest.toFixed(2)}ms`);

  const subsequentHitRequests: number[] = [];
  for (let i = 0; i < 20; i++) {
    const time = await measureRequest(hitBadgeUrl);
    subsequentHitRequests.push(time);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const avgHitSubsequent =
    subsequentHitRequests.reduce((a, b) => a + b, 0) /
    subsequentHitRequests.length;
  console.log(`  Average subsequent: ${avgHitSubsequent.toFixed(2)}ms`);

  results.push({
    testName: "Hit Counting Enabled",
    firstRequestTime: firstHitRequest,
    subsequentRequestTimes: subsequentHitRequests,
    avgSubsequentTime: avgHitSubsequent,
    cacheSpeedup: firstHitRequest / avgHitSubsequent,
    cacheHitRate: 0, // No cache with hit counting
  });

  // Test 4: Different styling of same badge
  console.log("\nTest 4: Same badge, different styling...");
  const styles = ["flat", "flat-square", "plastic", "for-the-badge"];
  const styleTimes: number[] = [];

  for (const style of styles) {
    const url = `${BASE_URL}/badge?page_id=${testId}-style&style=${style}&hit=false`;
    const time = await measureRequest(url);
    styleTimes.push(time);
    console.log(`  Style '${style}': ${time.toFixed(2)}ms`);
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
