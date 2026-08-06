/**
 * Bucketing of request metadata into the handful of labels the summary
 * publishes.
 *
 * Everything here is a total function over attacker-controlled input: a header
 * can be absent, malformed, or hostile, and the answer for all of those is an
 * "Unknown"/"Other" label rather than a throw. A hit is recorded on the write
 * path, so a classification that fails takes the whole hit - and the badge -
 * down with it.
 */

/**
 * Extract platform from user agent string
 */
export function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // Bots and crawlers
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "Bot";
  }

  // Mobile platforms
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod"))
    return "iOS";

  // Desktop platforms
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("cros")) return "Chrome OS";

  return "Other";
}

/**
 * Bucket a request's referrer by host.
 *
 * `Referer` is attacker-controlled and need not be a URL at all. Parsing it
 * unguarded threw, which failed the whole hit, which returned a 500 that the
 * worker then read a count out of - a malformed header on one request was
 * enough to break the badge. An unparseable value is just an unknown source.
 */
export function referrerHost(referrer: string): string {
  if (referrer === "direct") {
    return "Direct";
  }

  try {
    return new URL(referrer).hostname;
  } catch {
    return "Unknown";
  }
}

/**
 * Simplify user agent for tracking
 */
export function simplifyUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // Check for common bots first
  if (ua.includes("googlebot")) return "Googlebot";
  if (ua.includes("bingbot")) return "Bingbot";
  if (ua.includes("slackbot")) return "Slackbot";
  if (ua.includes("twitterbot")) return "Twitterbot";
  if (ua.includes("facebookexternalhit")) return "Facebook Bot";
  if (ua.includes("linkedinbot")) return "LinkedIn Bot";
  if (ua.includes("discordbot")) return "Discord Bot";
  if (ua.includes("whatsapp")) return "WhatsApp";

  // Browsers
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome")) return "Safari";

  // GitHub's image proxy
  if (ua.includes("github-camo")) return "GitHub Camo";

  return "Other";
}
