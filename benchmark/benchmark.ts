/**
 * Visitor Badge Reloaded - Blackbox Benchmark Suite
 * Tests the publicly hosted service at https://vbr.nathanchung.dev
 *
 * Metrics tested:
 * - Response time (p50, p95, p99)
 * - Throughput (requests per second)
 * - Error rate
 * - Cache behavior
 * - Concurrent request handling
 * - Geographic latency (optional with multiple test locations)
 */

const BASE_URL = "https://vbr.nathanchung.dev";
const BENCHMARK_PAGE_ID_PREFIX = "benchmark-test";

interface BenchmarkResult {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  responseTimes: number[];
}

interface TestConfig {
  name: string;
  url: string;
  requests: number;
  concurrency?: number;
  description?: string;
}

/**
 * Measures the time taken to execute an async function
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return [result, duration];
}

/**
 * Calculates percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Executes a single HTTP request and measures response time
 */
async function makeRequest(
  url: string,
): Promise<{ success: boolean; time: number; status?: number }> {
  try {
    const [response, time] = await measureTime(() => fetch(url));
    return {
      success: response.ok,
      time,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      time: 0,
    };
  }
}

/**
 * Runs concurrent requests in batches
 */
async function runConcurrentRequests(
  url: string,
  totalRequests: number,
  concurrency: number,
): Promise<Array<{ success: boolean; time: number; status?: number }>> {
  const results: Array<{ success: boolean; time: number; status?: number }> =
    [];

  for (let i = 0; i < totalRequests; i += concurrency) {
    const batch = Math.min(concurrency, totalRequests - i);
    const promises = Array(batch)
      .fill(null)
      .map(() => makeRequest(url));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Small delay between batches to avoid overwhelming the service
    if (i + concurrency < totalRequests) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return results;
}

/**
 * Analyzes results and calculates statistics
 */
function analyzeResults(
  name: string,
  results: Array<{ success: boolean; time: number; status?: number }>,
  totalDuration: number,
): BenchmarkResult {
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = results.length - successfulRequests;
  const responseTimes = results.filter((r) => r.success).map((r) => r.time);
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  return {
    name,
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    totalDuration,
    avgResponseTime,
    minResponseTime: sortedTimes[0] || 0,
    maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
    p50ResponseTime: percentile(sortedTimes, 50),
    p95ResponseTime: percentile(sortedTimes, 95),
    p99ResponseTime: percentile(sortedTimes, 99),
    requestsPerSecond: (results.length / totalDuration) * 1000,
    errorRate: (failedRequests / results.length) * 100,
    responseTimes,
  };
}

/**
 * Runs a benchmark test
 */
async function runBenchmark(config: TestConfig): Promise<BenchmarkResult> {
  console.log(`\n🏃 Running: ${config.name}`);
  if (config.description) {
    console.log(`   ${config.description}`);
  }
  console.log(`   URL: ${config.url}`);
  console.log(
    `   Requests: ${config.requests}, Concurrency: ${config.concurrency || 1}`,
  );

  const startTime = performance.now();
  const results = await runConcurrentRequests(
    config.url,
    config.requests,
    config.concurrency || 1,
  );
  const totalDuration = performance.now() - startTime;

  return analyzeResults(config.name, results, totalDuration);
}

/**
 * Prints benchmark results in a readable format
 */
function printResults(result: BenchmarkResult): void {
  console.log(`\n📊 Results for: ${result.name}`);
  console.log(`   Total Requests:      ${result.totalRequests}`);
  console.log(
    `   Successful:          ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)`,
  );
  console.log(
    `   Failed:              ${result.failedRequests} (${result.errorRate.toFixed(2)}%)`,
  );
  console.log(`   Total Duration:      ${result.totalDuration.toFixed(2)}ms`);
  console.log(
    `   Throughput:          ${result.requestsPerSecond.toFixed(2)} req/s`,
  );
  console.log(`\n   Response Times (ms):`);
  console.log(`   Min:                 ${result.minResponseTime.toFixed(2)}ms`);
  console.log(`   Avg:                 ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`   P50 (median):        ${result.p50ResponseTime.toFixed(2)}ms`);
  console.log(`   P95:                 ${result.p95ResponseTime.toFixed(2)}ms`);
  console.log(`   P99:                 ${result.p99ResponseTime.toFixed(2)}ms`);
  console.log(`   Max:                 ${result.maxResponseTime.toFixed(2)}ms`);
}

/**
 * Exports results to JSON file
 */
async function exportResults(
  results: BenchmarkResult[],
  filename: string,
): Promise<void> {
  const data = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    results: results.map((r) => ({
      ...r,
      responseTimes: undefined, // Exclude raw data to keep file size manageable
    })),
    rawData: results.map((r) => ({
      name: r.name,
      responseTimes: r.responseTimes,
    })),
  };

  await Bun.write(filename, JSON.stringify(data, null, 2));
  console.log(`\n💾 Results exported to: ${filename}`);
}

/**
 * Main benchmark suite
 */
async function runBenchmarkSuite(): Promise<void> {
  console.log("🚀 Visitor Badge Reloaded - Benchmark Suite");
  console.log(`📍 Testing: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const testId = `${BENCHMARK_PAGE_ID_PREFIX}-${Date.now()}`;
  const results: BenchmarkResult[] = [];

  // Test 1: Health Check
  results.push(
    await runBenchmark({
      name: "Health Check",
      url: `${BASE_URL}/healthz`,
      requests: 100,
      concurrency: 10,
      description: "Tests basic service availability and response time",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 2: Single Badge Request (Sequential)
  results.push(
    await runBenchmark({
      name: "Badge - Sequential Requests",
      url: `${BASE_URL}/badge?page_id=${testId}-sequential&hit=false`,
      requests: 50,
      concurrency: 1,
      description: "Tests single-threaded badge generation performance",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 3: Badge with Hit Counting
  results.push(
    await runBenchmark({
      name: "Badge - With Hit Counting",
      url: `${BASE_URL}/badge?page_id=${testId}-with-hits`,
      requests: 100,
      concurrency: 5,
      description: "Tests badge generation with database write operations",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 4: Badge without Hit Counting (Read-only)
  results.push(
    await runBenchmark({
      name: "Badge - Read-Only (No Hits)",
      url: `${BASE_URL}/badge?page_id=${testId}-no-hits&hit=false`,
      requests: 100,
      concurrency: 5,
      description: "Tests badge generation without database writes",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 5: Concurrent Badge Requests (Low Concurrency)
  results.push(
    await runBenchmark({
      name: "Badge - Low Concurrency",
      url: `${BASE_URL}/badge?page_id=${testId}-concurrent-low&hit=false`,
      requests: 100,
      concurrency: 10,
      description: "Tests service under moderate concurrent load",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 6: Concurrent Badge Requests (High Concurrency)
  results.push(
    await runBenchmark({
      name: "Badge - High Concurrency",
      url: `${BASE_URL}/badge?page_id=${testId}-concurrent-high&hit=false`,
      requests: 200,
      concurrency: 50,
      description: "Tests service under heavy concurrent load",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 7: Badge with Various Customization Options
  results.push(
    await runBenchmark({
      name: "Badge - Customized Styling",
      url: `${BASE_URL}/badge?page_id=${testId}-styled&color=ff6b6b&lcolor=4ecdc4&style=for-the-badge&logo=github&logoColor=white&text=Visitors&hit=false`,
      requests: 100,
      concurrency: 10,
      description: "Tests badge generation with full customization",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 8: Analytics API
  results.push(
    await runBenchmark({
      name: "Analytics API",
      url: `${BASE_URL}/api/analytics/${testId}-with-hits`,
      requests: 50,
      concurrency: 10,
      description: "Tests analytics endpoint performance",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 9: Landing Page
  results.push(
    await runBenchmark({
      name: "Landing Page",
      url: `${BASE_URL}/`,
      requests: 50,
      concurrency: 10,
      description: "Tests main landing page load time",
    }),
  );
  printResults(results[results.length - 1]);

  // Test 10: Stress Test - Burst Traffic
  console.log("\n⚠️  Warning: Starting stress test with burst traffic...");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  results.push(
    await runBenchmark({
      name: "Stress Test - Burst Traffic",
      url: `${BASE_URL}/badge?page_id=${testId}-stress&hit=false`,
      requests: 500,
      concurrency: 100,
      description: "Simulates sudden traffic spike to test service resilience",
    }),
  );
  printResults(results[results.length - 1]);

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 BENCHMARK SUMMARY");
  console.log("=".repeat(80));

  const avgThroughput =
    results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;
  const avgP95 =
    results.reduce((sum, r) => sum + r.p95ResponseTime, 0) / results.length;
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.failedRequests, 0);
  const overallErrorRate = (totalErrors / totalRequests) * 100;

  console.log(`Total Tests:              ${results.length}`);
  console.log(`Total Requests:           ${totalRequests}`);
  console.log(
    `Total Errors:             ${totalErrors} (${overallErrorRate.toFixed(2)}%)`,
  );
  console.log(`Avg Throughput:           ${avgThroughput.toFixed(2)} req/s`);
  console.log(`Avg P95 Response Time:    ${avgP95.toFixed(2)}ms`);

  console.log("\nBest Performing Tests:");
  const sortedByP95 = [...results].sort(
    (a, b) => a.p95ResponseTime - b.p95ResponseTime,
  );
  sortedByP95.slice(0, 3).forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.name}: ${r.p95ResponseTime.toFixed(2)}ms (P95)`,
    );
  });

  console.log("\nSlowest Tests:");
  sortedByP95
    .slice(-3)
    .reverse()
    .forEach((r, i) => {
      console.log(
        `  ${i + 1}. ${r.name}: ${r.p95ResponseTime.toFixed(2)}ms (P95)`,
      );
    });

  // Export results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await exportResults(results, `benchmark/results/benchmark-${timestamp}.json`);

  console.log("\n✅ Benchmark suite completed!");
  console.log(`⏰ Finished: ${new Date().toISOString()}\n`);
}

// Run the benchmark suite
runBenchmarkSuite().catch(console.error);
