/**
 * Benchmark Comparison Tool
 * Compares results from multiple benchmark runs to track performance over time
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

interface BenchmarkResult {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

interface BenchmarkFile {
  timestamp: string;
  baseUrl: string;
  results: BenchmarkResult[];
}

interface Comparison {
  testName: string;
  runs: Array<{
    timestamp: string;
    avgResponseTime: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  }>;
  avgChange: number;
  p95Change: number;
  throughputChange: number;
}

async function loadBenchmarkFiles(directory: string): Promise<BenchmarkFile[]> {
  try {
    const files = await readdir(directory);
    const benchmarkFiles = files.filter(
      (f) => f.startsWith("benchmark-") && f.endsWith(".json"),
    );

    const loaded: BenchmarkFile[] = [];
    for (const file of benchmarkFiles) {
      const content = await readFile(join(directory, file), "utf-8");
      const data = JSON.parse(content);
      loaded.push(data);
    }

    return loaded.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  } catch (error) {
    console.error(`Error loading benchmark files: ${error}`);
    return [];
  }
}

function compareRuns(files: BenchmarkFile[]): Comparison[] {
  if (files.length < 2) {
    console.log("Need at least 2 benchmark runs to compare");
    return [];
  }

  const comparisons: Comparison[] = [];

  // Get unique test names from the latest run
  const latestRun = files[files.length - 1];
  const testNames = latestRun.results.map((r) => r.name);

  for (const testName of testNames) {
    const runs = files
      .map((file) => {
        const result = file.results.find((r) => r.name === testName);
        if (!result) return null;
        return {
          timestamp: file.timestamp,
          avgResponseTime: result.avgResponseTime,
          p95ResponseTime: result.p95ResponseTime,
          requestsPerSecond: result.requestsPerSecond,
          errorRate: result.errorRate,
        };
      })
      .filter((r) => r !== null) as Comparison["runs"];

    if (runs.length < 2) continue;

    const oldest = runs[0];
    const latest = runs[runs.length - 1];

    const avgChange =
      ((latest.avgResponseTime - oldest.avgResponseTime) /
        oldest.avgResponseTime) *
      100;
    const p95Change =
      ((latest.p95ResponseTime - oldest.p95ResponseTime) /
        oldest.p95ResponseTime) *
      100;
    const throughputChange =
      ((latest.requestsPerSecond - oldest.requestsPerSecond) /
        oldest.requestsPerSecond) *
      100;

    comparisons.push({
      testName,
      runs,
      avgChange,
      p95Change,
      throughputChange,
    });
  }

  return comparisons;
}

function generateReport(comparisons: Comparison[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("📊 BENCHMARK COMPARISON REPORT");
  console.log("=".repeat(80));

  console.log(`\nComparing ${comparisons[0]?.runs.length || 0} benchmark runs`);
  console.log(`Oldest: ${comparisons[0]?.runs[0]?.timestamp || "N/A"}`);
  console.log(
    `Latest: ${comparisons[0]?.runs[comparisons[0]?.runs.length - 1]?.timestamp || "N/A"}`,
  );

  console.log("\n" + "-".repeat(80));
  console.log("Performance Changes (older → newer)");
  console.log("-".repeat(80));

  for (const comparison of comparisons) {
    const oldest = comparison.runs[0];
    const latest = comparison.runs[comparison.runs.length - 1];

    console.log(`\n${comparison.testName}`);
    console.log(
      `  Avg Response Time: ${oldest.avgResponseTime.toFixed(2)}ms → ${latest.avgResponseTime.toFixed(2)}ms (${comparison.avgChange > 0 ? "+" : ""}${comparison.avgChange.toFixed(2)}%)`,
    );
    console.log(
      `  P95 Response Time: ${oldest.p95ResponseTime.toFixed(2)}ms → ${latest.p95ResponseTime.toFixed(2)}ms (${comparison.p95Change > 0 ? "+" : ""}${comparison.p95Change.toFixed(2)}%)`,
    );
    console.log(
      `  Throughput:        ${oldest.requestsPerSecond.toFixed(2)} → ${latest.requestsPerSecond.toFixed(2)} req/s (${comparison.throughputChange > 0 ? "+" : ""}${comparison.throughputChange.toFixed(2)}%)`,
    );
    console.log(
      `  Error Rate:        ${oldest.errorRate.toFixed(2)}% → ${latest.errorRate.toFixed(2)}%`,
    );
  }

  // Identify biggest improvements and regressions
  const sortedByP95 = [...comparisons].sort(
    (a, b) => a.p95Change - b.p95Change,
  );

  console.log("\n" + "-".repeat(80));
  console.log("🎉 Biggest Improvements (P95 latency)");
  console.log("-".repeat(80));
  sortedByP95.slice(0, 3).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.testName}: ${c.p95Change.toFixed(2)}% faster`);
  });

  console.log("\n" + "-".repeat(80));
  console.log("⚠️  Biggest Regressions (P95 latency)");
  console.log("-".repeat(80));
  sortedByP95
    .slice(-3)
    .reverse()
    .forEach((c, i) => {
      console.log(
        `  ${i + 1}. ${c.testName}: ${c.p95Change.toFixed(2)}% slower`,
      );
    });

  // Throughput analysis
  const sortedByThroughput = [...comparisons].sort(
    (a, b) => b.throughputChange - a.throughputChange,
  );

  console.log("\n" + "-".repeat(80));
  console.log("🚀 Best Throughput Improvements");
  console.log("-".repeat(80));
  sortedByThroughput.slice(0, 3).forEach((c, i) => {
    console.log(
      `  ${i + 1}. ${c.testName}: ${c.throughputChange > 0 ? "+" : ""}${c.throughputChange.toFixed(2)}%`,
    );
  });
}

async function generateTrendData(comparisons: Comparison[]): Promise<void> {
  const trendData = comparisons.map((comparison) => ({
    testName: comparison.testName,
    timeline: comparison.runs.map((run) => ({
      timestamp: run.timestamp,
      avgResponseTime: run.avgResponseTime,
      p95ResponseTime: run.p95ResponseTime,
      requestsPerSecond: run.requestsPerSecond,
    })),
  }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Bun.write(
    `benchmark/results/trend-analysis-${timestamp}.json`,
    JSON.stringify(
      { timestamp: new Date().toISOString(), trends: trendData },
      null,
      2,
    ),
  );

  console.log(
    `\n💾 Trend data exported to: benchmark/results/trend-analysis-${timestamp}.json`,
  );
}

async function main(): Promise<void> {
  console.log("🔍 Benchmark Comparison Tool\n");

  const resultsDir = "benchmark/results";
  const files = await loadBenchmarkFiles(resultsDir);

  if (files.length === 0) {
    console.log("No benchmark files found in benchmark/results/");
    console.log("Run benchmark.ts first to generate results.");
    return;
  }

  console.log(`Found ${files.length} benchmark run(s):`);
  files.forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.timestamp} (${file.results.length} tests)`);
  });

  if (files.length < 2) {
    console.log(
      "\n⚠️  Only one benchmark run found. Run more benchmarks to see comparisons.",
    );
    return;
  }

  const comparisons = compareRuns(files);
  generateReport(comparisons);
  await generateTrendData(comparisons);

  console.log("\n✅ Comparison complete!\n");
}

main().catch(console.error);
