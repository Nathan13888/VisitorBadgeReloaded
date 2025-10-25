/**
 * Rate limiting functionality using Durable Objects
 */

export interface RateLimitConfig {
  // Maximum requests allowed in the window
  maxRequests: number;
  // Time window in milliseconds
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Badge generation: 60 requests per minute per badge ID
  badge: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
  // Analytics API: 30 requests per minute per badge ID
  analytics: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
} as const;

/**
 * Check rate limit for a badge ID using Durable Object
 */
export async function checkRateLimit(
  namespace: DurableObjectNamespace,
  pageId: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // Create a separate Durable Object ID for rate limiting
  // This ensures rate limit state is isolated from analytics state
  const rateLimitId = `ratelimit:${pageId}`;
  const id = namespace.idFromName(rateLimitId);
  const stub = namespace.get(id);

  const response = await stub.fetch("http://do/ratelimit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  return await response.json<RateLimitResult>();
}

/**
 * Rate limit state stored in Durable Object
 */
interface RateLimitState {
  // Array of timestamps for requests in current window
  requests: number[];
  // Last cleanup time
  lastCleanup: number;
}

/**
 * Handle rate limit check in Durable Object
 * This can be integrated into the existing BadgeDO or used as a separate method
 */
export async function handleRateLimitCheck(
  storage: DurableObjectStorage,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get current state
  let state = await storage.get<RateLimitState>("ratelimit");

  if (!state) {
    state = {
      requests: [],
      lastCleanup: now,
    };
  }

  // Clean up old requests outside the window
  state.requests = state.requests.filter(
    (timestamp) => timestamp > windowStart,
  );

  // Check if we're within limits
  const currentCount = state.requests.length;
  const allowed = currentCount < config.maxRequests;

  // If allowed, add this request
  if (allowed) {
    state.requests.push(now);
  }

  // Update state
  state.lastCleanup = now;
  await storage.put("ratelimit", state);

  // Calculate reset time (when the oldest request will expire)
  const oldestRequest = state.requests[0] || now;
  const resetAt = oldestRequest + config.windowMs;

  return {
    allowed,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - state.requests.length),
    resetAt,
  };
}
