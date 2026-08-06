/**
 * Rate limiting for badge and analytics requests.
 *
 * This sits on the platform rate limiting binding rather than on Durable Object
 * state. The previous implementation keyed a Durable Object on the page ID and
 * wrote to its storage on every request, so an unauthenticated GET for an
 * invented page ID permanently created storage: rotating page IDs, the thing
 * the limiter existed to stop, was also the thing it made expensive. Keying on
 * the page ID meant the limit was shared by everyone viewing a badge, so it
 * throttled popular badges rather than abusive clients. A binding check stores
 * nothing and is keyed on the caller.
 *
 * Limits are enforced per Cloudflare location and are eventually consistent, so
 * nothing here is an exact count. That is acceptable: these bound cost, they
 * are not an accounting system.
 */

/** The part of the binding callers use, so tests can supply a fake. */
export type Limiter = Pick<RateLimit, "limit">;

/**
 * The address a request came from, forming the client half of every key.
 *
 * Requests proxied by GitHub Camo share a small pool of addresses across every
 * badge on GitHub, so on its own this identifies "GitHub" rather than a user.
 * It is only a usable key when paired with something narrower (see `hitKey`) or
 * when the limit is generous enough that real Camo traffic cannot reach it.
 */
export function clientKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

/**
 * Key bounding how fast one client can add hits to one specific badge.
 *
 * Including the page ID is what makes this safe to set tightly: a Camo address
 * is measured per badge, not across all of GitHub at once.
 */
export function hitKey(request: Request, pageId: string): string {
  return `${clientKey(request)}|${pageId}`;
}

/**
 * Check a limit, allowing the request through when the limiter is unavailable.
 *
 * Self-hosted deployments may not have the bindings configured, and the binding
 * can fail on its own. Neither should take badges down, so both fail open.
 * These limiters bound cost; they do not guard anything where failing open
 * would be a security problem.
 */
export async function withinLimit(
  limiter: Limiter | undefined,
  key: string,
): Promise<boolean> {
  if (!limiter) {
    return true;
  }

  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    console.error("Rate limit check failed, allowing request", error);
    return true;
  }
}
