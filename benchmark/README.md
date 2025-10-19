# Visitor Badge Reloaded - Benchmark Suite

Comprehensive blackbox testing suite for the publicly hosted VBR service at https://vbr.nathanchung.dev

## 📋 Overview

This benchmark suite tests the service as a blackbox, measuring real-world performance metrics without requiring access to internal implementation details. All tests hit the public API endpoints.

## 🎯 Metrics Tested

### Core Performance Metrics
- **Response Time**: Min, Avg, P50, P95, P99, Max
- **Throughput**: Requests per second
- **Reliability**: Success rate and error rate
- **Scalability**: Concurrent request handling

### Specialized Tests
- **Cache Behavior**: Cache hit rates and speedup
- **Geographic Latency**: Network performance and stability
- **Real-World Usage**: Simulation of actual GitHub README traffic patterns
- **Cold Start**: Detection and measurement of serverless cold starts

## 🚀 Quick Start

### Prerequisites

```bash
# Ensure you have Bun installed
bun --version
```

### Running Benchmarks

```bash
# Run the full benchmark suite
bun run benchmark/benchmark.ts

# Test cache behavior specifically
bun run benchmark/cache-benchmark.ts

# Simulate real-world usage patterns
bun run benchmark/usage-simulation.ts

# Test geographic latency and connection stability
bun run benchmark/latency-test.ts

# Compare multiple benchmark runs
bun run benchmark/compare.ts
```

### Quick Scripts (add to package.json)

```json
{
  "scripts": {
    "bench": "bun run benchmark/benchmark.ts",
    "bench:cache": "bun run benchmark/cache-benchmark.ts",
    "bench:usage": "bun run benchmark/usage-simulation.ts",
    "bench:latency": "bun run benchmark/latency-test.ts",
    "bench:compare": "bun run benchmark/compare.ts",
    "bench:all": "bun run benchmark/benchmark.ts && bun run benchmark/cache-benchmark.ts && bun run benchmark/latency-test.ts"
  }
}
```

## 📊 Benchmark Tests

### 1. Main Benchmark Suite (`benchmark.ts`)

Comprehensive performance testing with 10 different scenarios:

| Test | Description | Metrics |
|------|-------------|---------|
| Health Check | Basic service availability | Response time, uptime |
| Sequential Requests | Single-threaded performance | Sequential throughput |
| With Hit Counting | Database write performance | Write latency |
| Read-Only | Optimized read performance | Read latency |
| Low Concurrency | Moderate concurrent load (10 req) | Concurrent performance |
| High Concurrency | Heavy concurrent load (50 req) | Scale testing |
| Customized Styling | Full feature performance | Feature overhead |
| Analytics API | Analytics endpoint performance | API latency |
| Landing Page | Frontend load time | Page performance |
| Stress Test | Burst traffic handling (100 concurrent) | Resilience |

**Sample Output:**
```
📊 Results for: Badge - High Concurrency
   Total Requests:      200
   Successful:          200 (100.00%)
   Failed:              0 (0.00%)
   Total Duration:      4523.45ms
   Throughput:          44.21 req/s

   Response Times (ms):
   Min:                 45.23ms
   Avg:                 89.67ms
   P50 (median):        85.34ms
   P95:                 156.78ms
   P99:                 234.56ms
   Max:                 289.45ms
```

### 2. Cache Benchmark (`cache-benchmark.ts`)

Tests caching behavior and effectiveness:

- **Repeated Requests**: Measures cache hit performance
- **Cache Misses**: Tests uncached request performance
- **Write Operations**: Measures impact of hit counting
- **Styling Variations**: Tests cache key generation

**Key Insights:**
- Cache speedup factor
- Write operation overhead
- Cache effectiveness percentage

### 3. Usage Simulation (`usage-simulation.ts`)

Simulates realistic GitHub README traffic patterns:

| Pattern | RPM | Duration | Description |
|---------|-----|----------|-------------|
| Low Traffic | 2 | 2 min | Small project visitors |
| Medium Traffic | 10 | 2 min | Popular project |
| High Traffic | 30 | 2 min | Very popular project |
| Viral Spike | 100 | 1 min | Trending on social media |

**Use Cases:**
- Capacity planning
- Traffic pattern analysis
- SLA validation

### 4. Latency Test (`latency-test.ts`)

Measures network performance and connection stability:

- **Endpoint Latency**: Tests all major endpoints
- **Connection Stability**: Measures consistency (coefficient of variation)
- **Cold Start Detection**: Identifies serverless cold starts
- **Time Series Analysis**: Tracks latency over time

**Metrics:**
- DNS lookup time (proxy)
- First byte time (TTFB)
- Total request time
- Standard deviation (stability)

### 5. Comparison Tool (`compare.ts`)

Analyzes multiple benchmark runs to track performance trends:

- Performance regression detection
- Improvement tracking
- Trend visualization data
- Historical comparisons

**Features:**
- Automatic file discovery
- Percentage change calculations
- Best/worst performer identification
- JSON export for external visualization

## 📁 Results Storage

All benchmark results are stored in `benchmark/results/`:

```
benchmark/results/
├── benchmark-2025-10-19T12-30-45-123Z.json
├── cache-benchmark-2025-10-19T12-35-22-456Z.json
├── usage-simulation-2025-10-19T12-40-15-789Z.json
├── latency-test-2025-10-19T12-50-30-012Z.json
└── trend-analysis-2025-10-19T13-00-00-345Z.json
```

### Result Format

```json
{
  "timestamp": "2025-10-19T12:30:45.123Z",
  "baseUrl": "https://vbr.nathanchung.dev",
  "results": [
    {
      "name": "Badge - High Concurrency",
      "totalRequests": 200,
      "successfulRequests": 200,
      "avgResponseTime": 89.67,
      "p95ResponseTime": 156.78,
      "requestsPerSecond": 44.21,
      "errorRate": 0
    }
  ]
}
```

## 🎨 Customization

### Adjust Test Parameters

Edit the test configurations in each file:

```typescript
// benchmark.ts
const config: TestConfig = {
  name: "Custom Test",
  url: `${BASE_URL}/badge?page_id=test`,
  requests: 500,        // Increase request count
  concurrency: 100,     // Increase concurrency
};
```

### Add New Tests

```typescript
// Add to benchmark.ts
results.push(await runBenchmark({
  name: "My Custom Test",
  url: `${BASE_URL}/endpoint`,
  requests: 100,
  concurrency: 10,
  description: "Tests my specific use case",
}));
```

### Change Target URL

```typescript
// At the top of any benchmark file
const BASE_URL = "https://your-own-instance.com";
```

## 📈 Interpreting Results

### Good Performance Indicators

- ✅ P95 < 200ms for badge requests
- ✅ P95 < 50ms for health checks
- ✅ Error rate < 1%
- ✅ Throughput > 50 req/s
- ✅ Cache speedup > 2x
- ✅ Cold start penalty < 500ms

### Warning Signs

- ⚠️ P95 > 500ms
- ⚠️ Error rate > 5%
- ⚠️ High standard deviation (> 50% of avg)
- ⚠️ Throughput degradation over time
- ⚠️ Frequent cold starts

### Performance Optimization Priorities

1. **P95 latency** - Affects user experience more than average
2. **Error rate** - Reliability is critical for badges
3. **Cache effectiveness** - Reduces load and improves speed
4. **Throughput** - Ensures service can handle traffic spikes

## 🔧 Troubleshooting

### High Error Rates

```bash
# Check service status
curl https://vbr.nathanchung.dev/healthz

# Test specific endpoint
curl -v "https://vbr.nathanchung.dev/badge?page_id=test"
```

### Slow Performance

- Check internet connection
- Test at different times of day
- Compare with previous benchmark runs
- Verify Cloudflare status

### Rate Limiting

If you hit rate limits, adjust the test parameters:

```typescript
// Reduce concurrency
concurrency: 5  // Instead of 50

// Add delays between batches
await new Promise(resolve => setTimeout(resolve, 100));
```

## 📊 Continuous Monitoring

### Scheduled Benchmarks

Use cron or GitHub Actions to run benchmarks regularly:

```yaml
# .github/workflows/benchmark.yml
name: Nightly Benchmark
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run bench
      - uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: benchmark/results/
```

### Alerting

Set up alerts for performance degradation:

```typescript
// In compare.ts
if (comparison.p95Change > 20) {
  console.error(`⚠️ ALERT: ${comparison.testName} P95 increased by ${comparison.p95Change.toFixed(2)}%`);
  // Send notification (email, Slack, etc.)
}
```

## 🤝 Contributing

When adding new benchmarks:

1. Follow the existing naming conventions
2. Include detailed descriptions
3. Export results to JSON
4. Update this README
5. Add to package.json scripts

## 📝 License

Same as the main Visitor Badge Reloaded project (MIT).

## 🔗 Related

- [Main README](../README.md)
- [Cloudflare Workers Performance](https://developers.cloudflare.com/workers/platform/pricing/)
- [Shields.io Documentation](https://shields.io/)
