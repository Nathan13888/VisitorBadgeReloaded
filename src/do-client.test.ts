import { describe, expect, test } from "bun:test";
import {
  DoCallError,
  page_id_exists,
  page_id_fetch,
  page_id_fetch_add_one,
  page_id_get_analytics,
} from "./do-client";
import type { AnalyticsSummary } from "./schema";

const PAGE = "example-page";

/** Namespace whose object answers every call with one canned response. */
function namespaceReturning(
  reply: (path: string, init?: RequestInit) => Response,
): DurableObjectNamespace {
  const fake = {
    idFromName: (name: string) => ({ name }),
    get: () => ({
      fetch: async (url: string, init?: RequestInit) =>
        reply(new URL(url).pathname, init),
    }),
  };
  return fake as unknown as DurableObjectNamespace;
}

const summary: AnalyticsSummary = {
  totalHits: 12,
  uniqueVisitorsToday: 3,
  hitsLast24Hours: 4,
  hitsLast7Days: 8,
  hitsLast14Days: 12,
  topReferrers: [{ referrer: "github.com", count: 9 }],
  topCountries: [{ country: "CA", count: 9 }],
  topUserAgents: [{ agent: "GitHub Camo", count: 9 }],
  topPlatforms: [{ platform: "Other", count: 9 }],
  dailyStats: [{ date: "2026-08-05", hits: 4, uniqueVisitors: 3 }],
  hourlyStats: [{ hour: "2026-08-05-11", hits: 4 }],
};

const request = new Request("https://vbr.test/badge", {
  headers: {
    "CF-Connecting-IP": "203.0.113.7",
    "CF-IPCountry": "CA",
    "User-Agent": "github-camo/1",
  },
});

describe("successful calls", () => {
  test("reads a count", async () => {
    const store = namespaceReturning(() => Response.json({ count: 41 }));

    expect(await page_id_fetch(store, PAGE)).toBe("41");
  });

  test("records a hit and forwards the request metadata", async () => {
    let body: unknown;
    const store = namespaceReturning((_path, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ count: 42 });
    });

    expect(await page_id_fetch_add_one(store, PAGE, request)).toBe("42");
    expect(body).toEqual({
      pageId: PAGE,
      ip: "203.0.113.7",
      referrer: "direct",
      country: "CA",
      userAgent: "github-camo/1",
    });
  });

  test("returns a validated summary", async () => {
    const store = namespaceReturning(() => Response.json(summary));

    expect(await page_id_get_analytics(store, PAGE)).toEqual(summary);
  });

  test("reports existence", async () => {
    const store = namespaceReturning(() => Response.json({ exists: true }));

    expect(await page_id_exists(store, PAGE)).toBe(true);
  });
});

describe("failed calls", () => {
  /**
   * The regression this boundary exists for.
   *
   * A Durable Object error used to be read as `{ count }`, so the worker called
   * `.toString()` on `undefined` and the badge failed with a TypeError several
   * frames from the fault. It must now fail as the call that actually broke.
   */
  test("a 500 from a hit raises a DoCallError, not a TypeError", async () => {
    const store = namespaceReturning(() =>
      Response.json({ error: "Internal server error" }, { status: 500 }),
    );

    const failure = page_id_fetch_add_one(store, PAGE, request);

    await expect(failure).rejects.toThrow(DoCallError);
    await expect(failure).rejects.toThrow(/hit failed \(500\)/);
  });

  test("a 500 from a count read raises a DoCallError", async () => {
    const store = namespaceReturning(() =>
      Response.json({ error: "boom" }, { status: 500 }),
    );

    await expect(page_id_fetch(store, PAGE)).rejects.toThrow(DoCallError);
  });

  test("a body that is not JSON raises a DoCallError", async () => {
    // A 200 that is not actually JSON, as an intercepting error page would be.
    const store = namespaceReturning(
      () =>
        new Response("<html>gateway error</html>", {
          headers: { "Content-Type": "application/json" },
        }),
    );

    await expect(page_id_fetch(store, PAGE)).rejects.toThrow(/unreadable body/);
  });

  test("a well-formed reply of the wrong shape is rejected", async () => {
    const store = namespaceReturning(() => Response.json({ count: "41" }));

    await expect(page_id_fetch(store, PAGE)).rejects.toThrow(DoCallError);
  });

  test("a summary missing a field is rejected rather than half-rendered", async () => {
    const { hourlyStats: _dropped, ...partial } = summary;
    const store = namespaceReturning(() => Response.json(partial));

    await expect(page_id_get_analytics(store, PAGE)).rejects.toThrow(
      DoCallError,
    );
  });

  test("an exists reply of the wrong shape is rejected", async () => {
    const store = namespaceReturning(() => Response.json({ exists: "yes" }));

    await expect(page_id_exists(store, PAGE)).rejects.toThrow(DoCallError);
  });
});

describe("expected absence", () => {
  test("a 404 summary is null, not an error", async () => {
    const store = namespaceReturning(() =>
      Response.json({ error: "No analytics data" }, { status: 404 }),
    );

    expect(await page_id_get_analytics(store, PAGE)).toBeNull();
  });

  test("a 500 summary still throws, so an outage is not read as an empty badge", async () => {
    const store = namespaceReturning(() =>
      Response.json({ error: "boom" }, { status: 500 }),
    );

    await expect(page_id_get_analytics(store, PAGE)).rejects.toThrow(
      DoCallError,
    );
  });
});
