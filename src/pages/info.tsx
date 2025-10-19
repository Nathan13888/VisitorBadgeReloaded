import type { AnalyticsSummary } from "../do";

export default function InfoPage(props: {
  id?: string;
  analytics?: AnalyticsSummary | null;
}) {
  if (!props.id) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Badge Analytics
          </h1>
          <p class="text-slate-600 dark:text-slate-300">
            No badge ID provided. Please specify a badge ID in the URL.
          </p>
        </div>
      </div>
    );
  }

  if (!props.analytics) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Badge Analytics: {props.id}
          </h1>
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p class="text-yellow-800 dark:text-yellow-200">
              No analytics data available for this badge yet. The badge may not exist or hasn't received any hits.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stats = props.analytics;

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div class="max-w-6xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <a href="/" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block">
            ← Back to Home
          </a>
          <h1 class="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Badge Analytics
          </h1>
          <p class="text-slate-600 dark:text-slate-300">
            This page has analytics for page: <code class="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{props.id}</code>
          </p>
        </div>

        {/* Key Metrics */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Total Hits
            </div>
            <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalHits.toLocaleString()}
            </div>
          </div>
          
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Unique Visitors
            </div>
            <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.uniqueVisitors.toLocaleString()}
            </div>
          </div>
          
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Last 24 Hours
            </div>
            <div class="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.hitsLast24Hours.toLocaleString()}
            </div>
          </div>
          
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Last 7 Days
            </div>
            <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {stats.hitsLast7Days.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Traffic Visualization */}
        {stats.dailyStats.length > 0 && (
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
              Daily Traffic (Last 14 Days)
            </h2>
            <div style={{ height: '300px' }}>
              <canvas id="trafficChart" />
            </div>
            {/* Load Chart.js from CDN */}
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js" />
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Chart.js initialization */}
            <script dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Wait for Chart.js to load
                  if (typeof Chart === 'undefined') {
                    document.currentScript.previousElementSibling.addEventListener('load', initChart);
                  } else {
                    initChart();
                  }
                  
                  function initChart() {
                    const ctx = document.getElementById('trafficChart');
                    if (!ctx || ctx.chart) return; // Prevent double initialization
                    
                    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    
                    new Chart(ctx, {
                      type: 'line',
                      data: {
                        labels: ${JSON.stringify(stats.dailyStats.slice(-14).map(s => s.date.slice(5)))},
                        datasets: [{
                          label: 'Hits',
                          data: ${JSON.stringify(stats.dailyStats.slice(-14).map(s => s.hits))},
                          borderColor: isDark ? '#60a5fa' : '#3b82f6',
                          backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          tension: 0.5,
                          fill: true,
                          pointRadius: 3,
                          pointHoverRadius: 6,
                          pointBackgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2,
                          borderWidth: 2,
                        }]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          intersect: false,
                          mode: 'index'
                        },
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            titleColor: isDark ? '#f1f5f9' : '#0f172a',
                            bodyColor: isDark ? '#f1f5f9' : '#0f172a',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                              label: function(context) {
                                return context.parsed.y.toLocaleString() + ' hits';
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            grid: {
                              display: false
                            },
                            ticks: {
                              color: isDark ? '#94a3b8' : '#64748b'
                            }
                          },
                          y: {
                            beginAtZero: true,
                            grid: {
                              color: isDark ? '#334155' : '#e2e8f0'
                            },
                            ticks: {
                              color: isDark ? '#94a3b8' : '#64748b',
                              callback: function(value) {
                                return value.toLocaleString();
                              }
                            }
                          }
                        }
                      }
                    });
                  }
                })();
              `
            }} />
          </div>
        )}

        {/* Top Referrers and Countries */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Referrers */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Top Referrers
            </h2>
            <div class="space-y-3">
              {stats.topReferrers.length > 0 ? (
                stats.topReferrers.map((ref) => (
                  <div key={ref.referrer} class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="text-sm text-slate-600 dark:text-slate-400 truncate flex-1">
                      {ref.referrer}
                    </span>
                    <span class="text-sm font-semibold text-slate-900 dark:text-white ml-4">
                      {ref.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p class="text-slate-500 dark:text-slate-400 text-sm">No referrer data available</p>
              )}
            </div>
          </div>

          {/* Top Countries */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Top Countries
            </h2>
            <div class="space-y-3">
              {stats.topCountries.length > 0 ? (
                stats.topCountries.map((country) => (
                  <div key={country.country} class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="text-sm text-slate-600 dark:text-slate-400">
                      {country.country}
                    </span>
                    <span class="text-sm font-semibold text-slate-900 dark:text-white">
                      {country.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p class="text-slate-500 dark:text-slate-400 text-sm">No geographic data available</p>
              )}
            </div>
          </div>
        </div>

        {/* User Agents and Platforms */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top User Agents */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Top Browsers / Bots
            </h2>
            <div class="space-y-3">
              {stats.topUserAgents.length > 0 ? (
                stats.topUserAgents.map((ua) => (
                  <div key={ua.agent} class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="text-sm text-slate-600 dark:text-slate-400">
                      {ua.agent}
                    </span>
                    <span class="text-sm font-semibold text-slate-900 dark:text-white">
                      {ua.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p class="text-slate-500 dark:text-slate-400 text-sm">No user agent data available</p>
              )}
            </div>
          </div>

          {/* Top Platforms */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Top Platforms
            </h2>
            <div class="space-y-3">
              {stats.topPlatforms.length > 0 ? (
                stats.topPlatforms.map((platform) => (
                  <div key={platform.platform} class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span class="text-sm text-slate-600 dark:text-slate-400">
                      {platform.platform}
                    </span>
                    <span class="text-sm font-semibold text-slate-900 dark:text-white">
                      {platform.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p class="text-slate-500 dark:text-slate-400 text-sm">No platform data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Data is retained for up to ~14 days.
        </div>
      </div>
    </div>
  );
}
