import { type BadgeOptions, createBadge } from "./badge";
import { page_id_fetch, page_id_fetch_add_one } from "./do-client";
import { isGitHubCamo, shouldRecordHit } from "./hit-policy";
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

/**
 * Served when a direct client has exhausted its overall badge budget.
 *
 * Carries the same backdated `Date` and `Expires` as every other uncacheable
 * response. Without them an intermediary that ignores `no-store` - Camo has
 * historically been generous about what it holds on to - could keep this error
 * long after the minute it applies to, turning a momentary limit into a badge
 * that stays broken. Proxied traffic never reaches this; see
 * `handleBadgeRequest`.
 */
function rateLimitedBadge(now: number): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20">
      <rect width="150" height="20" fill="#e05d44"/>
      <text x="75" y="14" font-family="Verdana" font-size="11" fill="#fff" text-anchor="middle">Rate Limit Exceeded</text>
    </svg>`;

  return new Response(svg, {
    status: 429,
    headers: {
      ...uncacheableHeaders(now),
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
 * Safe on every path: a count is only a number, and serving a slightly stale
 * one can never suppress a hit, because recording a hit no longer depends on
 * what was read here.
 *
 * `refreshSnapshot` is false on the recording path, where the hit's own answer
 * writes a fresher snapshot moments later. Writing one here as well would race
 * it, and losing that race would pin the badge to a lower number for a whole
 * TTL - a visitor watching it would see the count go backwards.
 */
async function readCount(
  deps: BadgeDeps,
  requestUrl: string,
  pageId: string,
  refreshSnapshot: boolean,
): Promise<string> {
  const key = countCacheKey(requestUrl, pageId);

  const cached = await deps.cache.match(key);
  if (cached) {
    const { count } = await cached.json<{ count: string }>();
    return count;
  }

  const count = await page_id_fetch(deps.badgeStore, pageId);
  if (refreshSnapshot) {
    deps.waitUntil(deps.cache.put(key, countSnapshot(count)));
  }
  return count;
}

/**
 * Record a hit after the badge has already been sent.
 *
 * A badge's Durable Object lives wherever that badge was first seen, so this
 * call can cross a continent before it even reaches storage. Nothing in the
 * rendered badge depends on its result - the count comes from the shared
 * snapshot - so awaiting it only ever added that round trip to every reader's
 * latency. Its answer is used for one thing: refreshing the snapshot that the
 * next TTL's worth of readers will render.
 *
 * Failures are logged and swallowed. This runs after the response has been
 * returned, so throwing could not be reported to anyone anyway, and the cost of
 * a failure is one uncounted hit rather than a broken image in a README.
 */
async function recordHitInBackground(
  deps: BadgeDeps,
  request: Request,
  pageId: string,
): Promise<void> {
  try {
    const count = await page_id_fetch_add_one(deps.badgeStore, pageId, request);
    await deps.cache.put(
      countCacheKey(request.url, pageId),
      countSnapshot(count),
    );
  } catch (error) {
    console.error("Failed to record hit", { pageId, error });
  }
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
 * Recording a hit does not block the response. The number a badge renders comes
 * from the shared count snapshot on every path, so a view is counted in the
 * background and the reader waits only for a cache lookup and a render. What
 * this gives up is read-after-write: a badge shows the count as of the last
 * snapshot refresh rather than one that includes the view being served. That is
 * the right trade for a visitor counter, where the number is decorative and the
 * latency is not - and where the Durable Object being written to may be on
 * another continent.
 *
 * Only a request that explicitly asked not to be counted is cached. That is
 * narrower than "no hit was recorded" on purpose: the project's own badge only
 * counts hits whose User-Agent is GitHub Camo, so a response withheld for that
 * reason must not be stored under a URL that Camo will later ask for, or the
 * cache would answer Camo and silently suppress a real hit.
 *
 * Every way of running out of budget degrades to a read; only a direct client
 * over the overall budget is refused outright. Nothing that arrives through a
 * shared proxy can be turned into a broken image for somebody else's badge.
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
  const overClientBudget = !(await withinLimit(
    deps.clientLimiter,
    clientKey(request),
  ));

  if (overClientBudget) {
    const proxied = isGitHubCamo(request);

    console.warn("rate_limit_client_exceeded", {
      pageId,
      country: request.headers.get("CF-IPCountry"),
      userAgent: request.headers.get("User-Agent"),
      // Which of the two outcomes below this request got, so the log answers
      // whether the limit is turning real readers away or merely holding
      // proxied traffic to reads.
      degraded: proxied,
    });

    // A proxy is degraded rather than refused. This budget is keyed on the
    // address alone, and GitHub Camo puts every badge on GitHub behind a
    // handful of addresses, so one busy egress reaching the limit would
    // otherwise return a red error image for unrelated badges - the single
    // most visible failure this service can produce, and the one the hit
    // budget below already goes out of its way to avoid.
    //
    // Dropping the hit is what keeps this from reopening the abuse the limit
    // exists for. Recording a hit is the only thing that persists a record, so
    // a client held to reads cannot create storage for an invented page ID no
    // matter how many it rotates through. What it costs is unbounded reads
    // from anything willing to claim Camo's User-Agent, which store nothing
    // and are absorbed by the count snapshot for any page ID asked for twice.
    if (!proxied) {
      return rateLimitedBadge(now);
    }
  }

  let recordHit = overClientBudget
    ? false
    : shouldRecordHit(pageId, request, hitRequested);
  if (
    recordHit &&
    !(await withinLimit(deps.hitLimiter, hitKey(request, pageId)))
  ) {
    // Degrade to a read rather than an error. A badge that renders with a
    // slightly stale count is a far better failure than a broken image in
    // somebody's README.
    recordHit = false;
  }

  // Dispatched before the read so the two run concurrently, and so that on a
  // cold snapshot the count lookup is the only thing left on the critical path.
  if (recordHit) {
    deps.waitUntil(recordHitInBackground(deps, request, pageId));
  }

  let text = await readCount(deps, request.url, pageId, !recordHit);

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
