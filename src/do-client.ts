/**
 * The one way to talk to a badge's Durable Object.
 *
 * Every call used to be written out by hand: its own URL string, its own
 * `response.json<T>()` cast, and no status check. A Durable Object that
 * returned an error - which it does for a malformed request, and did for a
 * malformed `Referer` header - produced an error body that was then asserted to
 * be a count, so the first thing the worker did with it was call `.toString()`
 * on `undefined`. The visible failure was a broken image with a TypeError
 * behind it, several frames from the actual fault.
 *
 * Here the paths live in one table shared with the Durable Object's own
 * dispatcher, and one function performs every call: it checks the status,
 * parses the body, and validates it against the same schema the Durable Object
 * is expected to produce. Anything that does not match raises `DoCallError`, so
 * a failure surfaces where it happened and says which route and status caused
 * it.
 */

import {
  AnalyticsSummarySchema,
  CountResponseSchema,
  ExistsResponseSchema,
  HitRequestSchema,
} from "./schema";
import type { AnalyticsSummary, HitRequest } from "./schema";

/**
 * Every route the Durable Object serves.
 *
 * `src/do.ts` dispatches off this same table, so a path cannot be renamed on
 * one side of the boundary alone.
 */
export const DO_ROUTES = {
  count: {
    path: "/count",
    method: "GET",
    response: CountResponseSchema,
  },
  hit: {
    path: "/hit",
    method: "POST",
    request: HitRequestSchema,
    response: CountResponseSchema,
  },
  summary: {
    path: "/summary",
    method: "GET",
    response: AnalyticsSummarySchema,
  },
  exists: {
    path: "/exists",
    method: "GET",
    response: ExistsResponseSchema,
  },
} as const;

type RouteName = keyof typeof DO_ROUTES;

/**
 * A Durable Object call that did not produce the response its schema promises.
 *
 * Carries the status so a caller can treat an expected absence differently from
 * a genuine fault - `/summary` answering 404 for a badge with no data is not an
 * error, and everything else is.
 */
export class DoCallError extends Error {
  constructor(
    readonly route: RouteName,
    readonly status: number,
    readonly reason: string,
  ) {
    super(`Durable Object ${route} failed (${status}): ${reason}`);
    this.name = "DoCallError";
  }
}

/** Resolve the stub for a page. The page ID is the object's name. */
function getStub(
  namespace: DurableObjectNamespace,
  pageId: string,
): DurableObjectStub {
  return namespace.get(namespace.idFromName(pageId));
}

/**
 * Perform one call and return its validated body.
 *
 * The request body is validated too. It costs nothing on a path that is already
 * building the object, and it means a bad payload fails here rather than inside
 * the Durable Object where the only report available is a 500.
 */
async function call<N extends RouteName>(
  namespace: DurableObjectNamespace,
  pageId: string,
  name: N,
  body?: unknown,
): Promise<ReturnType<(typeof DO_ROUTES)[N]["response"]["parse"]>> {
  const route = DO_ROUTES[name];
  const stub = getStub(namespace, pageId);

  const init: RequestInit = { method: route.method };
  if ("request" in route) {
    const payload = route.request.safeParse(body);
    if (!payload.success) {
      throw new DoCallError(
        name,
        0,
        `invalid request: ${payload.error.message}`,
      );
    }
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(payload.data);
  }

  const response = await stub.fetch(`http://do${route.path}`, init);

  if (!response.ok) {
    throw new DoCallError(
      name,
      response.status,
      response.statusText || "error",
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    throw new DoCallError(name, response.status, `unreadable body: ${error}`);
  }

  const parsed = route.response.safeParse(raw);
  if (!parsed.success) {
    throw new DoCallError(name, response.status, parsed.error.message);
  }

  return parsed.data as ReturnType<(typeof DO_ROUTES)[N]["response"]["parse"]>;
}

/**
 * Read a badge's count without recording anything.
 *
 * Returned as a string because the only consumer renders it into a badge.
 */
export const page_id_fetch = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string,
): Promise<string> => {
  const { count } = await call(analyticsNamespace, pageId, "count");
  return count.toString();
};

/** Record a hit and return the resulting count. */
export const page_id_fetch_add_one = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string,
  request: Request,
): Promise<string> => {
  const payload: HitRequest = {
    pageId,
    ip: request.headers.get("CF-Connecting-IP") || "unknown",
    referrer: request.headers.get("Referer") || "direct",
    country: request.headers.get("CF-IPCountry") || "unknown",
    userAgent: request.headers.get("User-Agent") || "unknown",
  };

  const { count } = await call(analyticsNamespace, pageId, "hit", payload);
  return count.toString();
};

/**
 * Get a badge's analytics summary, or null when it has none.
 *
 * A 404 is the documented answer for a badge with no data, so it maps to null.
 * Every other failure propagates: silently returning null for them is what made
 * an outage indistinguishable from an empty badge.
 */
export const page_id_get_analytics = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string,
): Promise<AnalyticsSummary | null> => {
  try {
    return await call(analyticsNamespace, pageId, "summary");
  } catch (error) {
    if (error instanceof DoCallError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

/** Whether a badge has ever been recorded. */
export const page_id_exists = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string,
): Promise<boolean> => {
  const { exists } = await call(analyticsNamespace, pageId, "exists");
  return exists;
};
