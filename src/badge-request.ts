import { type BadgeOptions, createBadge } from "./badge";
import { shouldRecordHit } from "./hit-policy";
import { page_id_fetch, page_id_fetch_add_one } from "./page";
import { type Limiter, clientKey, hitKey, withinLimit } from "./rate-limit";

/**
 * How long a count snapshot and a rendered no-hit badge stay fresh.
 *
 * Short enough that a badge still looks live, long enough that a README full of
 * differently styled badges collapses to a single count read. Cache entries do
 * not replicate between Cloudflare locations, so the worst case is roughly one
 * read per page ID per location per TTL.
 */
export const CACHE_TTL_SECONDS = 15;

/**
 * Query parameters that change the rendered badge.
 *
 * The cache key is rebuilt from exactly these, in this order, so that parameter
 * order does not fragment the cache and unrecognised parameters cannot be used
 * to bust it. `hit` is absent deliberately - only one value of it is ever
 * cached, so it is constant across every entry.
 */
const RENDER_PARAMS = [
  "page_id",
  "color",
  "lcolor",
  "style",
  "text",
  "label",
  "logo",
  "logoColor",
  "lColor",
  "custom",
] as const;

/** Everything the badge route needs, injected so it can be tested with fakes. */
export interface BadgeDeps {
  cache: Cache;
  badgeStore: DurableObjectNamespace;
  hitLimiter?: Limiter;
  clientLimiter?: Limiter;
  waitUntil: (work: Promise<unknown>) => void;
}

/**
 * Whether the caller asked for this view to be counted.
 *
 * An absent `hit` counts, matching the documented default. Anything other than
 * `true` or `yes` - including an empty value - does not.
 */
export function parseHit(value: string | null): boolean {
  if (value === null) {
    return true;
  }
  const normalised = value.toLowerCase();
  return normalised === "true" || normalised === "yes";
}

/**
 * Cache key for a fully rendered badge.
 *
 * Built on the request's own origin so the entry belongs to the zone serving
 * it, and under a path the router does not answer, so the entry cannot be read
 * back by asking for it directly.
 */
function svgCacheKey(requestUrl: string): Request {
  const url = new URL(requestUrl);
  const key = new URL("/__vbr/badge", url.origin);
  for (const name of RENDER_PARAMS) {
    const value = url.searchParams.get(name);
    if (value !== null) {
      key.searchParams.set(name, value);
    }
  }
  return new Request(key);
}

/** Cache key for a page's count, shared by every styling of that badge. */
function countCacheKey(requestUrl: string, pageId: string): Request {
  const url = new URL(requestUrl);
  return new Request(
    new URL(`/__vbr/count/${encodeURIComponent(pageId)}`, url.origin),
  );
}

/**
 * Headers for a response that must not be cached anywhere.
 *
 * The backdated `Date` and already-expired `Expires` are load-bearing rather
 * than decorative: GitHub Camo re-fetches an image it considers stale, which is
 * how a hit gets counted at all. They are kept on every uncacheable path so
 * that behaviour is unchanged, and omitted from the cacheable one, where they
 * would contradict the TTL.
 */
function uncacheableHeaders(now: number): Record<string, string> {
  const backdated = new Date(now - 10 * 60 * 1000).toUTCString();
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-cache,max-age=0",
    Date: backdated,
    Expires: backdated,
  };
}

/** Served when a client has exhausted its overall badge budget. */
function rateLimitedBadge(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20">
      <rect width="150" height="20" fill="#e05d44"/>
      <text x="75" y="14" font-family="Verdana" font-size="11" fill="#fff" text-anchor="middle">Rate Limit Exceeded</text>
    </svg>`;

  return new Response(svg, {
    status: 429,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-VBR-Cache": "BYPASS",
    },
  });
}

/** Copy a cached response so a cache status can be stamped onto it. */
function stamp(response: Response, status: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.set("X-VBR-Cache", status);
  return copy;
}

/**
 * Read a badge's count, sharing one Durable Object read across every styling of
 * that badge for the length of the TTL.
 *
 * Safe on every non-recording path, including the ones that are not themselves
 * cacheable: a count is only a number, and serving a slightly stale one can
 * never suppress a hit, because no hit is being recorded on these paths.
 */
async function readCount(
  deps: BadgeDeps,
  requestUrl: string,
  pageId: string,
): Promise<string> {
  const key = countCacheKey(requestUrl, pageId);

  const cached = await deps.cache.match(key);
  if (cached) {
    const { count } = await cached.json<{ count: string }>();
    return count;
  }

  const count = await page_id_fetch(deps.badgeStore, pageId);
  deps.waitUntil(deps.cache.put(key, countSnapshot(count)));
  return count;
}

function countSnapshot(count: string): Response {
  return new Response(JSON.stringify({ count }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
}

/**
 * Render a badge, counting the view unless the caller opted out, the page's hit
 * policy rejects it, or the client is over its hit budget.
 *
 * Only a request that explicitly asked not to be counted is cached. That is
 * narrower than "no hit was recorded" on purpose: the project's own badge only
 * counts hits whose User-Agent is GitHub Camo, so a response withheld for that
 * reason must not be stored under a URL that Camo will later ask for, or the
 * cache would answer Camo and silently suppress a real hit.
 */
export async function handleBadgeRequest(
  request: Request,
  deps: BadgeDeps,
  now: number = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  const pageId = url.searchParams.get("page_id") ?? "";

  const hitParam = url.searchParams.get("hit");
  const hitRequested = parseHit(hitParam);
  const cacheable = hitParam !== null && !hitRequested;

  const svgKey = svgCacheKey(request.url);
  if (cacheable) {
    const hit = await deps.cache.match(svgKey);
    if (hit) {
      return stamp(hit, "HIT");
    }
  }

  // Only consulted once the cache has missed, so a well-behaved badge never
  // spends its client budget.
  if (!(await withinLimit(deps.clientLimiter, clientKey(request)))) {
    console.warn("rate_limit_client_exceeded", {
      pageId,
      country: request.headers.get("CF-IPCountry"),
      userAgent: request.headers.get("User-Agent"),
    });
    return rateLimitedBadge();
  }

  let recordHit = shouldRecordHit(pageId, request, hitRequested);
  if (
    recordHit &&
    !(await withinLimit(deps.hitLimiter, hitKey(request, pageId)))
  ) {
    // Degrade to a read rather than an error. A badge that renders with a
    // slightly stale count is a far better failure than a broken image in
    // somebody's README.
    recordHit = false;
  }

  let text: string;
  if (recordHit) {
    text = await page_id_fetch_add_one(deps.badgeStore, pageId, request);
    // Keep the shared snapshot in step with the count we just wrote, so a
    // styled sibling badge does not immediately render a lower number.
    deps.waitUntil(
      deps.cache.put(countCacheKey(request.url, pageId), countSnapshot(text)),
    );
  } else {
    text = await readCount(deps, request.url, pageId);
  }

  const custom = url.searchParams.get("custom");
  if (custom) {
    text = custom.replace("CNT", text);
  }

  const badgeOptions: BadgeOptions = {
    // `label` appeared in the original public options table. Keep `text` as
    // the authoritative parameter, but accept `label` when `text` is absent so
    // existing URLs based on those docs do not need to be reconfigured.
    label:
      url.searchParams.get("text") ??
      url.searchParams.get("label") ??
      "Visitors",
    text,
    colour: url.searchParams.get("color") ?? "blue",
    labelColour: url.searchParams.get("lcolor") ?? "grey",
    style: url.searchParams.get("style") ?? "flat",
    logo: url.searchParams.get("logo") ?? "",
    logoColour:
      url.searchParams.get("logoColor") ??
      url.searchParams.get("lColor") ??
      "white",
  };

  let svg: string;
  try {
    svg = createBadge(badgeOptions);
  } catch (error) {
    console.error("Failed to create badge", error);
    return Response.json({ error: "Failed to create badge" }, { status: 500 });
  }

  if (!cacheable) {
    return new Response(svg, {
      headers: { ...uncacheableHeaders(now), "X-VBR-Cache": "BYPASS" },
    });
  }

  const response = new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
  deps.waitUntil(deps.cache.put(svgKey, response.clone()));

  return stamp(response, "MISS");
}
