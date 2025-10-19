/**
 * Geographic Latency Test
 * Tests service response times from different geographic regions
 * Note: Requires external services or VPN to truly test from different regions
 * This version uses DNS resolution and connection timing as a proxy
 */

const BASE_URL = "https://vbr.nathanchung.dev";

interface LatencyResult {
  endpoint: string;
  dnsLookupTime: number;
  tcpConnectionTime: number;
  tlsHandshakeTime: number;
  firstByteTime: number;
  totalTime: number;
  contentSize: number;
}

async function measureDetailedTiming(url: string): Promise<LatencyResult> {
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      // Disable cache to get fresh measurements
      cache: "no-store",
    });

    const firstByteTime = performance.now() - startTime;
    const content = await response.text();
    const totalTime = performance.now() - startTime;

    return {
      endpoint: url,
      dnsLookupTime: 0, // Browser doesn't expose this
      tcpConnectionTime: 0, // Browser doesn't expose this
      tlsHandshakeTime: 0, // Browser doesn't expose this
      firstByteTime,
      totalTime,
      contentSize: content.length,
    };
  } catch (error) {
    throw new Error(`Failed to measure timing for ${url}: ${error}`);
  }
}

async function testEndpointLatency(
  endpoint: string,
  samples: number = 10,
): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < samples; i++) {
    const result = await measureDetailedTiming(endpoint);
    times.push(result.totalTime);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return times;
}

function calculateStats(times: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
} {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance =
    times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) /
    times.length;
  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev,
  };
}

async function runLatencyTests(): Promise<void> {
  console.log("🌐 Geographic Latency Test");
  console.log(`📍 Testing: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const testId = `latency-test-${Date.now()}`;
  const endpoints = [
    {
      name: "Health Check",
      url: `${BASE_URL}/healthz`,
    },
    {
      name: "Simple Badge",
      url: `${BASE_URL}/badge?page_id=${testId}&hit=false`,
    },
    {
      name: "Styled Badge",
      url: `${BASE_URL}/badge?page_id=${testId}&color=ff6b6b&style=for-the-badge&logo=github&hit=false`,
    },
    {
      name: "Analytics API",
      url: `${BASE_URL}/api/analytics/${testId}`,
    },
    {
      name: "Landing Page",
      url: `${BASE_URL}/`,
    },
  ];

  const results: Array<{
    endpoint: string;
    stats: ReturnType<typeof calculateStats>;
  }> = [];

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.name}...`);
    const times = await testEndpointLatency(endpoint.url, 10);
    const stats = calculateStats(times);
    results.push({ endpoint: endpoint.name, stats });

    console.log(`  Min:    ${stats.min.toFixed(2)}ms`);
    console.log(`  Avg:    ${stats.avg.toFixed(2)}ms`);
    console.log(`  Median: ${stats.median.toFixed(2)}ms`);
    console.log(`  Max:    ${stats.max.toFixed(2)}ms`);
    console.log(`  StdDev: ${stats.stdDev.toFixed(2)}ms\n`);
  }

  // Connection stability test
  console.log("Testing connection stability (30 rapid requests)...");
  const stabilityUrl = `${BASE_URL}/healthz`;
  const stabilityTimes = await testEndpointLatency(stabilityUrl, 30);
  const stabilityStats = calculateStats(stabilityTimes);

  console.log(`  Average:   ${stabilityStats.avg.toFixed(2)}ms`);
  console.log(`  Std Dev:   ${stabilityStats.stdDev.toFixed(2)}ms`);
  console.log(
    `  CV:        ${((stabilityStats.stdDev / stabilityStats.avg) * 100).toFixed(2)}% (lower is more stable)\n`,
  );

  // Time of day analysis (if running over longer period)
  console.log("Checking cold start penalty...");

  // Wait 2 minutes to simulate cold start
  console.log("  Waiting 2 minutes for potential cold start...");
  await new Promise((resolve) => setTimeout(resolve, 120000));

  const coldStartTime = await measureDetailedTiming(
    `${BASE_URL}/badge?page_id=${testId}-cold&hit=false`,
  );
  const warmTimes = await testEndpointLatency(
    `${BASE_URL}/badge?page_id=${testId}-warm&hit=false`,
    5,
  );
  const warmStats = calculateStats(warmTimes);

  console.log(`  Cold start time:   ${coldStartTime.totalTime.toFixed(2)}ms`);
  console.log(`  Warm avg time:     ${warmStats.avg.toFixed(2)}ms`);
  console.log(
    `  Cold start penalty: ${(coldStartTime.totalTime - warmStats.avg).toFixed(2)}ms\n`,
  );

  // Summary
  console.log("=".repeat(60));
  console.log("📊 LATENCY TEST SUMMARY");
  console.log("=".repeat(60));

  console.log("\nEndpoint Performance (sorted by avg latency):");
  const sortedResults = [...results].sort((a, b) => a.stats.avg - b.stats.avg);
  sortedResults.forEach((result, index) => {
    console.log(
      `  ${index + 1}. ${result.endpoint.padEnd(20)} ${result.stats.avg.toFixed(2)}ms`,
    );
  });

  console.log(
    `\nConnection Stability: ${stabilityStats.stdDev.toFixed(2)}ms std dev`,
  );
  console.log(
    `Cold Start Penalty: ${(coldStartTime.totalTime - warmStats.avg).toFixed(2)}ms`,
  );

  // Export results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(
    `benchmark/results/latency-test-${timestamp}.json`,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        endpointResults: results,
        stabilityTest: {
          samples: stabilityTimes.length,
          stats: stabilityStats,
        },
        coldStartTest: {
          coldStartTime: coldStartTime.totalTime,
          warmAvgTime: warmStats.avg,
          penalty: coldStartTime.totalTime - warmStats.avg,
        },
      },
      null,
      2,
    ),
  );

  console.log("\n✅ Latency test completed!");
  console.log(`⏰ Finished: ${new Date().toISOString()}\n`);
}

runLatencyTests().catch(console.error);
