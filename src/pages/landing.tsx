export default function LandingPage() {
  const badgeUrl = "https://vbr.nathanchung.dev/badge?page_id=visitor-badge-reloaded-visitors&color=55acb7&style=for-the-badge&logo=Github";
  
  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header class="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span class="text-xl font-bold text-slate-900 dark:text-white">Visitor Badge Reloaded</span>
            </div>
            <div class="flex items-center space-x-4">
              <a href="https://github.com/Nathan13888/VisitorBadgeReloaded" target="_blank" rel="noopener noreferrer" 
                 class="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div class="text-center">
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white mb-6">
            Track Visitors with Style ✨
          </h1>
          <p class="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
            A high-performance, fully customizable visitor badge service built on Cloudflare Workers. 
            Add beautiful visitor counters to your GitHub profile or website in seconds.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a href="#quickstart" class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
              Get Started
            </a>
            <a href="https://github.com/Nathan13888/VisitorBadgeReloaded" target="_blank" rel="noopener noreferrer"
               class="px-8 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold rounded-lg shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 transition-all">
              View on GitHub
            </a>
          </div>
          <div class="flex justify-center">
            <img src={badgeUrl} alt="Visitor Badge Example" class="rounded shadow-md" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-white dark:bg-slate-800/50 rounded-2xl mb-16 shadow-xl">
        <h2 class="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Why Choose VBR?</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">Lightning Fast</h3>
            <p class="text-slate-600 dark:text-slate-300">Built on Cloudflare Workers for edge performance worldwide</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">Fully Customizable</h3>
            <p class="text-slate-600 dark:text-slate-300">Colors, styles, logos, and text - make it yours</p>
          </div>
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">Open Source</h3>
            <p class="text-slate-600 dark:text-slate-300">Free, transparent, and self-hostable</p>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section id="quickstart" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 class="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Quick Start Guide</h2>
        
        <div class="space-y-8">
          {/* Step 1 */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-3">Create Your Badge URL</h3>
                <p class="text-slate-600 dark:text-slate-300 mb-4">
                  Start with the base URL and add your unique page ID:
                </p>
                <div class="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <code class="text-slate-800 dark:text-slate-200">
                    https://vbr.nathanchung.dev/badge?page_id=YOUR_UNIQUE_ID
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-3">Customize Your Badge</h3>
                <p class="text-slate-600 dark:text-slate-300 mb-4">
                  Add optional parameters to customize appearance:
                </p>
                <div class="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto mb-4">
                  <code class="text-slate-800 dark:text-slate-200">
                    ?page_id=YOUR_ID&color=55acb7&style=for-the-badge&logo=Github&text=Visitors
                  </code>
                </div>
                <div class="grid sm:grid-cols-2 gap-3 text-sm">
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">color</span>
                    <span class="text-slate-600 dark:text-slate-400">- Badge color (hex)</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">lcolor</span>
                    <span class="text-slate-600 dark:text-slate-400">- Label color (hex)</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">style</span>
                    <span class="text-slate-600 dark:text-slate-400">- Badge style</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">logo</span>
                    <span class="text-slate-600 dark:text-slate-400">- Icon name</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">text</span>
                    <span class="text-slate-600 dark:text-slate-400">- Custom label</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 dark:text-blue-400 font-mono">hit</span>
                    <span class="text-slate-600 dark:text-slate-400">- Track visits (on/off)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div class="flex-1">
                <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-3">Add to Your README</h3>
                <p class="text-slate-600 dark:text-slate-300 mb-4">
                  Use Markdown to embed your badge:
                </p>
                <div class="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <code class="text-slate-800 dark:text-slate-200">
                    ![Visitors](https://vbr.nathanchung.dev/badge?page_id=YOUR_ID)
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 class="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">Badge Examples</h2>
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <div class="space-y-6">
            <div class="border-b border-slate-200 dark:border-slate-700 pb-6">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white mb-3">Different Styles</h4>
              <div class="flex flex-wrap gap-3">
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&style=flat&hit=false" alt="Flat style" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&style=flat-square&hit=false" alt="Flat square style" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&style=for-the-badge&hit=false" alt="For the badge style" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&style=plastic&hit=false" alt="Plastic style" />
              </div>
            </div>
            <div class="border-b border-slate-200 dark:border-slate-700 pb-6">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white mb-3">Different Colors</h4>
              <div class="flex flex-wrap gap-3">
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&color=55acb7&style=for-the-badge&hit=false" alt="Blue badge" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&color=ff4d6d&style=for-the-badge&hit=false" alt="Red badge" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&color=06d6a0&style=for-the-badge&hit=false" alt="Green badge" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&color=ffd166&style=for-the-badge&hit=false" alt="Yellow badge" />
              </div>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white mb-3">With Logos</h4>
              <div class="flex flex-wrap gap-3">
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&logo=Github&style=for-the-badge&hit=false" alt="GitHub logo" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&logo=GitLab&color=FCA121&style=for-the-badge&hit=false" alt="GitLab logo" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&logo=Twitter&color=1DA1F2&style=for-the-badge&hit=false" alt="Twitter logo" />
                <img src="https://vbr.nathanchung.dev/badge?page_id=demo&logo=YouTube&color=FF0000&style=for-the-badge&hit=false" alt="YouTube logo" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Links */}
      <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 sm:p-12 text-center">
          <h2 class="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p class="text-blue-100 mb-8 max-w-2xl mx-auto">
            Check out our documentation for advanced configuration options and self-hosting instructions.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://github.com/Nathan13888/VisitorBadgeReloaded#readme" target="_blank" rel="noopener noreferrer"
               class="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
              Read Documentation
            </a>
            <a href="https://github.com/Nathan13888/VisitorBadgeReloaded/issues" target="_blank" rel="noopener noreferrer"
               class="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
              Report an Issue
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm mt-16">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="flex flex-col sm:flex-row items-center justify-between">
            <p class="text-slate-600 dark:text-slate-400 text-sm mb-4 sm:mb-0">
              Built with ❤️ by <a href="https://github.com/Nathan13888" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Nathan Chung</a>
            </p>
            <div class="flex items-center space-x-6">
              <a href="https://github.com/Nathan13888/VisitorBadgeReloaded" target="_blank" rel="noopener noreferrer"
                 class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm transition-colors">
                GitHub
              </a>
              <a href="https://github.com/Nathan13888/VisitorBadgeReloaded#readme" target="_blank" rel="noopener noreferrer"
                 class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm transition-colors">
                Documentation
              </a>
              <a href="https://shields.io/" target="_blank" rel="noopener noreferrer"
                 class="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm transition-colors">
                Shields.io
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
