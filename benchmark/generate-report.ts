/**
 * HTML Report Generator
 * Creates a visual HTML report from benchmark results
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
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

interface BenchmarkFile {
  timestamp: string;
  baseUrl: string;
  results: BenchmarkResult[];
}

async function loadLatestBenchmark(): Promise<BenchmarkFile | null> {
  try {
    const files = await readdir("benchmark/results");
    const benchmarkFiles = files
      .filter((f) => f.startsWith("benchmark-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (benchmarkFiles.length === 0) return null;

    const content = await readFile(
      join("benchmark/results", benchmarkFiles[0]),
      "utf-8",
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function generateHTML(data: BenchmarkFile): string {
  const chartData = data.results.map((r) => ({
    name: r.name,
    avg: r.avgResponseTime,
    p95: r.p95ResponseTime,
    p99: r.p99ResponseTime,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VBR Benchmark Report - ${new Date(data.timestamp).toLocaleString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        
        .meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 2rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .meta-item {
            text-align: center;
        }
        
        .meta-label {
            font-size: 0.85rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
        }
        
        .meta-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: #495057;
        }
        
        .charts {
            padding: 2rem;
        }
        
        .chart-container {
            margin-bottom: 3rem;
        }
        
        .chart-container h2 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        .chart-wrapper {
            position: relative;
            height: 400px;
            background: white;
            border-radius: 10px;
            padding: 1rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .results-table {
            padding: 2rem;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        th {
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        td {
            padding: 1rem;
            border-bottom: 1px solid #e9ecef;
        }
        
        tbody tr:hover {
            background: #f8f9fa;
        }
        
        .success {
            color: #28a745;
            font-weight: 600;
        }
        
        .warning {
            color: #ffc107;
            font-weight: 600;
        }
        
        .danger {
            color: #dc3545;
            font-weight: 600;
        }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .badge-success {
            background: #d4edda;
            color: #155724;
        }
        
        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .badge-danger {
            background: #f8d7da;
            color: #721c24;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Visitor Badge Reloaded</h1>
            <p>Benchmark Report</p>
        </div>
        
        <div class="meta">
            <div class="meta-item">
                <div class="meta-label">Base URL</div>
                <div class="meta-value" style="font-size: 1rem;">${data.baseUrl}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Timestamp</div>
                <div class="meta-value" style="font-size: 1rem;">${new Date(data.timestamp).toLocaleString()}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Total Tests</div>
                <div class="meta-value">${data.results.length}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Total Requests</div>
                <div class="meta-value">${data.results.reduce((sum, r) => sum + r.totalRequests, 0)}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Success Rate</div>
                <div class="meta-value">${((data.results.reduce((sum, r) => sum + r.successfulRequests, 0) / data.results.reduce((sum, r) => sum + r.totalRequests, 0)) * 100).toFixed(2)}%</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Avg P95</div>
                <div class="meta-value">${(data.results.reduce((sum, r) => sum + r.p95ResponseTime, 0) / data.results.length).toFixed(2)}ms</div>
            </div>
        </div>
        
        <div class="charts">
            <div class="chart-container">
                <h2>📊 Response Time Distribution</h2>
                <div class="chart-wrapper">
                    <canvas id="responseTimeChart"></canvas>
                </div>
            </div>
            
            <div class="chart-container">
                <h2>⚡ Throughput Comparison</h2>
                <div class="chart-wrapper">
                    <canvas id="throughputChart"></canvas>
                </div>
            </div>
            
            <div class="chart-container">
                <h2>❌ Error Rates</h2>
                <div class="chart-wrapper">
                    <canvas id="errorChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="results-table">
            <h2 style="margin-bottom: 1rem; color: #495057;">📈 Detailed Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test Name</th>
                        <th>Requests</th>
                        <th>Success Rate</th>
                        <th>Avg Response</th>
                        <th>P95</th>
                        <th>P99</th>
                        <th>Throughput</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.results
                      .map((r) => {
                        const successRate =
                          (r.successfulRequests / r.totalRequests) * 100;
                        const statusBadge =
                          r.p95ResponseTime < 200
                            ? "badge-success"
                            : r.p95ResponseTime < 500
                              ? "badge-warning"
                              : "badge-danger";
                        const statusText =
                          r.p95ResponseTime < 200
                            ? "Excellent"
                            : r.p95ResponseTime < 500
                              ? "Good"
                              : "Slow";

                        return `
                        <tr>
                            <td><strong>${r.name}</strong></td>
                            <td>${r.totalRequests}</td>
                            <td class="${successRate === 100 ? "success" : successRate > 95 ? "warning" : "danger"}">${successRate.toFixed(2)}%</td>
                            <td>${r.avgResponseTime.toFixed(2)}ms</td>
                            <td>${r.p95ResponseTime.toFixed(2)}ms</td>
                            <td>${r.p99ResponseTime.toFixed(2)}ms</td>
                            <td>${r.requestsPerSecond.toFixed(2)} req/s</td>
                            <td><span class="badge ${statusBadge}">${statusText}</span></td>
                        </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Generated by VBR Benchmark Suite • ${new Date().toLocaleString()}</p>
        </div>
    </div>
    
    <script>
        const chartData = ${JSON.stringify(chartData)};
        
        // Response Time Chart
        new Chart(document.getElementById('responseTimeChart'), {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.name),
                datasets: [
                    {
                        label: 'Average',
                        data: chartData.map(d => d.avg),
                        backgroundColor: 'rgba(102, 126, 234, 0.5)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'P95',
                        data: chartData.map(d => d.p95),
                        backgroundColor: 'rgba(118, 75, 162, 0.5)',
                        borderColor: 'rgba(118, 75, 162, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'P99',
                        data: chartData.map(d => d.p99),
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
        
        // Throughput Chart
        new Chart(document.getElementById('throughputChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(data.results.map((r) => r.name))},
                datasets: [{
                    label: 'Requests per Second',
                    data: ${JSON.stringify(data.results.map((r) => r.requestsPerSecond))},
                    backgroundColor: 'rgba(40, 167, 69, 0.5)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Requests per Second'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
        
        // Error Rate Chart
        new Chart(document.getElementById('errorChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(data.results.map((r) => r.name))},
                datasets: [{
                    label: 'Error Rate (%)',
                    data: ${JSON.stringify(data.results.map((r) => r.errorRate))},
                    backgroundColor: 'rgba(220, 53, 69, 0.5)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Error Rate (%)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}

async function generateReport(): Promise<void> {
  console.log("📄 Generating HTML Report...\n");

  const data = await loadLatestBenchmark();

  if (!data) {
    console.log("❌ No benchmark results found.");
    console.log("Run 'bun run bench' first to generate results.");
    return;
  }

  console.log(`Found benchmark from: ${data.timestamp}`);
  console.log(`Tests: ${data.results.length}`);

  const html = generateHTML(data);
  const filename = `benchmark/results/report-${new Date(data.timestamp).toISOString().replace(/[:.]/g, "-")}.html`;

  await Bun.write(filename, html);

  console.log(`\n✅ Report generated: ${filename}`);
  console.log(`\n🌐 Open it in your browser to view the results!`);
}

generateReport().catch(console.error);
