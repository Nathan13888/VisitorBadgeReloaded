#!/usr/bin/env bun

/**
 * Quick Benchmark Script
 * A fast, lightweight benchmark for quick performance checks
 * Takes ~30 seconds to run
 */

const BASE_URL = "https://vbr.nathanchung.dev";

async function quickBenchmark() {
  console.log("⚡ Quick Benchmark - Visitor Badge Reloaded");
  console.log(`📍 ${BASE_URL}\n`);

  const testId = `quick-bench-${Date.now()}`;
  const tests = [
    { name: "Health Check", url: `${BASE_URL}/healthz`, requests: 10 },
    {
      name: "Simple Badge",
      url: `${BASE_URL}/badge?page_id=${testId}&hit=false`,
      requests: 10,
    },
    {
      name: "Styled Badge",
      url: `${BASE_URL}/badge?page_id=${testId}&color=ff6b6b&style=for-the-badge&logo=github&hit=false`,
      requests: 10,
    },
    {
      name: "Concurrent (10)",
      url: `${BASE_URL}/badge?page_id=${testId}-concurrent&hit=false`,
      requests: 10,
      concurrent: true,
    },
  ];

  for (const test of tests) {
    const times: number[] = [];
    const start = Date.now();

    if (test.concurrent) {
      const promises = Array(test.requests)
        .fill(null)
        .map(async () => {
          const reqStart = performance.now();
          await fetch(test.url);
          return performance.now() - reqStart;
        });
      times.push(...(await Promise.all(promises)));
    } else {
      for (let i = 0; i < test.requests; i++) {
        const reqStart = performance.now();
        await fetch(test.url);
        times.push(performance.now() - reqStart);
      }
    }

    const duration = Date.now() - start;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];

    console.log(`${test.name}`);
    console.log(
      `  Avg: ${avg.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | RPS: ${(test.requests / (duration / 1000)).toFixed(2)}`,
    );
  }

  console.log("\n✅ Quick benchmark complete!\n");
}

quickBenchmark().catch(console.error);
