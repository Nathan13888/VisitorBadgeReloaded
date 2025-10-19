/**
 * Real-World Usage Simulation
 * Simulates realistic GitHub README badge usage patterns
 */

const BASE_URL = "https://vbr.nathanchung.dev";

interface UsagePattern {
  name: string;
  description: string;
  requestsPerMinute: number;
  durationMinutes: number;
  hitEnabled: boolean;
}

interface SimulationResult {
  pattern: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  actualRPM: number;
}

const USAGE_PATTERNS: UsagePattern[] = [
  {
    name: "Low Traffic Repository",
    description: "Small project with occasional visitors",
    requestsPerMinute: 2,
    durationMinutes: 2,
    hitEnabled: true,
  },
  {
    name: "Medium Traffic Repository",
    description: "Popular project with steady traffic",
    requestsPerMinute: 10,
    durationMinutes: 2,
    hitEnabled: true,
  },
  {
    name: "High Traffic Repository",
    description: "Very popular project with constant visitors",
    requestsPerMinute: 30,
    durationMinutes: 2,
    hitEnabled: true,
  },
  {
    name: "Viral Spike",
    description: "Project trending on social media",
    requestsPerMinute: 100,
    durationMinutes: 1,
    hitEnabled: true,
  },
];

async function makeRequest(
  url: string,
): Promise<{ success: boolean; time: number }> {
  try {
    const start = performance.now();
    const response = await fetch(url);
    const time = performance.now() - start;
    return { success: response.ok, time };
  } catch {
    return { success: false, time: 0 };
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function simulateUsagePattern(
  pattern: UsagePattern,
): Promise<SimulationResult> {
  console.log(`\n🎭 Simulating: ${pattern.name}`);
  console.log(`   ${pattern.description}`);
  console.log(
    `   Target: ${pattern.requestsPerMinute} req/min for ${pattern.durationMinutes} min`,
  );

  const testId = `usage-sim-${Date.now()}-${pattern.name.replace(/\s+/g, "-").toLowerCase()}`;
  const url = `${BASE_URL}/badge?page_id=${testId}&hit=${pattern.hitEnabled}`;

  const results: Array<{ success: boolean; time: number }> = [];
  const totalRequests = pattern.requestsPerMinute * pattern.durationMinutes;
  const intervalMs = (60 * 1000) / pattern.requestsPerMinute;

  const startTime = Date.now();

  for (let i = 0; i < totalRequests; i++) {
    const result = await makeRequest(url);
    results.push(result);

    // Progress indicator
    if ((i + 1) % Math.max(1, Math.floor(totalRequests / 10)) === 0) {
      const progress = (((i + 1) / totalRequests) * 100).toFixed(0);
      process.stdout.write(`\r   Progress: ${progress}%`);
    }

    // Wait for next request
    if (i < totalRequests - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  const totalDuration = (Date.now() - startTime) / 1000 / 60; // minutes
  console.log(
    `\r   Progress: 100% - Completed in ${totalDuration.toFixed(2)} min`,
  );

  // Analyze results
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = results.length - successfulRequests;
  const responseTimes = results.filter((r) => r.success).map((r) => r.time);
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  return {
    pattern: pattern.name,
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    avgResponseTime,
    p95ResponseTime: percentile(sortedTimes, 95),
    p99ResponseTime: percentile(sortedTimes, 99),
    maxResponseTime: sortedTimes[sortedTimes.length - 1] || 0,
    errorRate: (failedRequests / results.length) * 100,
    actualRPM: results.length / totalDuration,
  };
}

async function runUsageSimulation(): Promise<void> {
  console.log("🌍 Real-World Usage Simulation");
  console.log(`📍 Testing: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  const results: SimulationResult[] = [];

  for (const pattern of USAGE_PATTERNS) {
    const result = await simulateUsagePattern(pattern);
    results.push(result);

    // Print results
    console.log(
      `   ✓ Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`,
    );
    console.log(`   ✓ Avg Response: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`   ✓ P95 Response: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   ✓ P99 Response: ${result.p99ResponseTime.toFixed(2)}ms`);
    console.log(`   ✓ Actual RPM:   ${result.actualRPM.toFixed(2)}`);

    // Small delay between patterns
    if (pattern !== USAGE_PATTERNS[USAGE_PATTERNS.length - 1]) {
      console.log("\n   Waiting 30s before next pattern...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 USAGE SIMULATION SUMMARY");
  console.log("=".repeat(80));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.pattern}`);
    console.log(`   Requests:     ${result.totalRequests}`);
    console.log(
      `   Success:      ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)`,
    );
    console.log(`   Avg Response: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95 Response: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Error Rate:   ${result.errorRate.toFixed(2)}%`);
  });

  // Export results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(
    `benchmark/results/usage-simulation-${timestamp}.json`,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        results,
      },
      null,
      2,
    ),
  );

  console.log("\n✅ Usage simulation completed!");
  console.log(`⏰ Finished: ${new Date().toISOString()}\n`);
}

runUsageSimulation().catch(console.error);
