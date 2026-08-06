import { describe, expect, test } from "bun:test";
import {
  type BadgeDeps,
  CACHE_TTL_SECONDS,
  handleBadgeRequest,
  parseHit,
} from "./badge-request";
import type { Limiter } from "./rate-limit";

const protectedPageId = "visitor-badge-reloaded-visitors";

/**
 * Minimal stand-in for `caches.default`, keyed the way the real one is: by
 * request URL, honouring `max-age` against a clock the test controls.
 */
class FakeCache {
  private entries = new Map<
    string,
    { body: string; storedAt: number; ttl: number }
  >();
  now = 0;
  puts = 0;

  async match(request: Request): Promise<Response | undefined> {
    const entry = this.entries.get(request.url);
    if (!entry) {
      return undefined;
    }
    if (this.now - entry.storedAt >= entry.ttl * 1000) {
      this.entries.delete(request.url);
      return undefined;
    }
    return new Response(entry.body);
  }

  async put(request: Request, response: Response): Promise<void> {
    this.puts += 1;
    const control = response.headers.get("Cache-Control") ?? "";
    if (control.includes("no-store")) {
      throw new Error("refused to cache a no-store response");
    }
    const maxAge = Number(control.match(/max-age=(\d+)/)?.[1] ?? 0);
    this.entries.set(request.url, {
      body: await response.text(),
      storedAt: this.now,
      ttl: maxAge,
    });
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}

/** Records every Durable Object call so tests can assert none happened. */
class FakeBadgeStore {
  calls: string[] = [];
  count = 41;
  /** Hits that ran to completion, as opposed to merely being dispatched. */
  recorded = 0;
  /** When set, `/hit` waits on this before answering: a write still in flight. */
  hitGate: Promise<void> | null = null;
  /** When true, `/hit` fails the way an unreachable Durable Object would. */
  failHits = false;

  idFromName(name: string) {
    return { name };
  }

  get(_id: unknown) {
    return {
      fetch: async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        this.calls.push(path);
        if (path === "/hit") {
          if (this.hitGate) {
            await this.hitGate;
          }
          if (this.failHits) {
            return Response.json({ error: "unavailable" }, { status: 500 });
          }
          this.count += 1;
          this.recorded += 1;
        }
        return Response.json({ count: this.count });
      },
    };
  }

  get reads(): number {
    return this.calls.filter((path) => path === "/count").length;
  }

  get writes(): number {
    return this.calls.filter((path) => path === "/hit").length;
  }
}

const allow: Limiter = { limit: async () => ({ success: true }) };
const deny: Limiter = { limit: async () => ({ success: false }) };

interface Harness {
  deps: BadgeDeps;
  cache: FakeCache;
  store: FakeBadgeStore;
  pending: Promise<unknown>[];
}

function harness(overrides: Partial<BadgeDeps> = {}): Harness {
  const cache = new FakeCache();
  const store = new FakeBadgeStore();
  const pending: Promise<unknown>[] = [];

  return {
    cache,
    store,
    pending,
    deps: {
      cache: cache as unknown as Cache,
      badgeStore: store as unknown as DurableObjectNamespace,
      hitLimiter: allow,
      clientLimiter: allow,
      waitUntil: (work) => {
        pending.push(work);
      },
      ...overrides,
    },
  };
}

/** Drain `waitUntil` work, which is where cache writes happen. */
async function settle(h: Harness): Promise<void> {
  await Promise.all(h.pending);
  h.pending.length = 0;
}

function badgeRequest(query: string, headers: Record<string, string> = {}) {
  return new Request(`https://vbr.example.dev/badge?${query}`, { headers });
}

describe("parseHit", () => {
  test("counts by default and for the affirmative spellings", () => {
    expect(parseHit(null)).toBe(true);
    expect(parseHit("true")).toBe(true);
    expect(parseHit("TRUE")).toBe(true);
    expect(parseHit("yes")).toBe(true);
  });

  test("does not count for anything else, including an empty value", () => {
    expect(parseHit("false")).toBe(false);
    expect(parseHit("off")).toBe(false);
    expect(parseHit("")).toBe(false);
  });
});

describe("hit=false caching", () => {
  test("a repeated request touches neither Durable Object", async () => {
    const h = harness();

    const first = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=false"),
      h.deps,
    );
    await settle(h);

    expect(first.headers.get("X-VBR-Cache")).toBe("MISS");
    expect(h.store.reads).toBe(1);

    const second = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=false"),
      h.deps,
    );

    expect(second.headers.get("X-VBR-Cache")).toBe("HIT");
    expect(h.store.calls).toHaveLength(1);
    expect(h.store.writes).toBe(0);
    expect(await second.text()).toBe(await first.clone().text());
  });

  test("styled variants of one badge share a single count read", async () => {
    const h = harness();

    for (const style of ["flat", "flat-square", "plastic", "for-the-badge"]) {
      await handleBadgeRequest(
        badgeRequest(`page_id=alpha&style=${style}&hit=false`),
        h.deps,
      );
      await settle(h);
    }

    // Four distinct renders, one count read shared between them.
    expect(h.store.reads).toBe(1);
    expect(h.store.writes).toBe(0);
  });

  test("is advertised as cacheable without the backdated hit headers", async () => {
    const h = harness();

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=false"),
      h.deps,
    );

    expect(response.headers.get("Cache-Control")).toBe(
      `public, max-age=${CACHE_TTL_SECONDS}`,
    );
    expect(response.headers.get("Expires")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  test("unrecognised parameters cannot bust the cache", async () => {
    const h = harness();

    await handleBadgeRequest(badgeRequest("page_id=alpha&hit=false"), h.deps);
    await settle(h);

    for (let i = 0; i < 5; i++) {
      const response = await handleBadgeRequest(
        badgeRequest(`page_id=alpha&hit=false&cachebust=${i}`),
        h.deps,
      );
      expect(response.headers.get("X-VBR-Cache")).toBe("HIT");
    }

    expect(h.store.calls).toHaveLength(1);
  });

  test("parameter order does not fragment the cache", async () => {
    const h = harness();

    await handleBadgeRequest(
      badgeRequest("page_id=alpha&style=plastic&hit=false"),
      h.deps,
    );
    await settle(h);

    const reordered = await handleBadgeRequest(
      badgeRequest("hit=false&style=plastic&page_id=alpha"),
      h.deps,
    );

    expect(reordered.headers.get("X-VBR-Cache")).toBe("HIT");
  });

  test("the entry expires once the TTL has passed", async () => {
    const h = harness();

    await handleBadgeRequest(badgeRequest("page_id=alpha&hit=false"), h.deps);
    await settle(h);

    h.cache.now += (CACHE_TTL_SECONDS + 1) * 1000;

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=false"),
      h.deps,
    );

    expect(response.headers.get("X-VBR-Cache")).toBe("MISS");
    expect(h.store.reads).toBe(2);
  });
});

describe("hit recording", () => {
  test("records the hit and is never cached", async () => {
    const h = harness();

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
    );
    await settle(h);

    expect(h.store.writes).toBe(1);
    expect(response.headers.get("Cache-Control")).toBe("no-cache,max-age=0");
    expect(response.headers.get("X-VBR-Cache")).toBe("BYPASS");

    // Only the count snapshot may be written, never the rendered badge.
    expect(h.cache.keys()).toEqual([
      "https://vbr.example.dev/__vbr/count/alpha",
    ]);
  });

  test("keeps the backdated headers that make Camo re-fetch", async () => {
    const h = harness();
    const now = Date.parse("2026-08-05T12:00:00Z");

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
      now,
    );

    const expires = Date.parse(response.headers.get("Expires") ?? "");
    expect(expires).toBe(now - 10 * 60 * 1000);
    expect(response.headers.get("Date")).toBe(response.headers.get("Expires"));
  });

  test("a recorded hit refreshes the snapshot its siblings read", async () => {
    const h = harness();

    // The snapshot is cold, so this request's own count lookup is the one read.
    await handleBadgeRequest(badgeRequest("page_id=alpha"), h.deps);
    await settle(h);
    expect(h.store.reads).toBe(1);

    const sibling = await handleBadgeRequest(
      badgeRequest("page_id=alpha&style=plastic&hit=false"),
      h.deps,
    );
    await settle(h);

    // The sibling reused the snapshot the background hit wrote rather than
    // re-reading, and so sees the incremented count.
    expect(h.store.reads).toBe(1);
    expect(await sibling.text()).toContain("42");
  });

  test("only the hit refreshes the snapshot, so the count cannot go backwards", async () => {
    const h = harness();

    await handleBadgeRequest(badgeRequest("page_id=alpha"), h.deps);
    await settle(h);

    // The count lookup on a recording request read 41 but must not have written
    // it: doing so could land after the hit's own 42 and pin the badge to the
    // lower number until the entry expired.
    expect(h.cache.puts).toBe(1);
    const sibling = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=false"),
      h.deps,
    );
    expect(await sibling.text()).toContain("42");
  });

  test("the response does not wait for the hit to be recorded", async () => {
    const h = harness();
    let release: () => void = () => {};
    h.store.hitGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
    );

    // The badge is rendered and returned while the write is still in flight.
    expect(response.status).toBe(200);
    expect(await response.clone().text()).toContain("41");
    expect(h.store.writes).toBe(1);
    expect(h.store.recorded).toBe(0);

    release();
    await settle(h);
    expect(h.store.recorded).toBe(1);
  });

  test("a Durable Object failure costs the hit, not the badge", async () => {
    const h = harness();
    h.store.failHits = true;

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
    );

    // Settling must not reject: the failure is swallowed in the background,
    // where there is no longer anybody to report it to.
    await settle(h);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("41");
    expect(h.store.recorded).toBe(0);
  });

  test("a request that never asked to opt out is not cached", async () => {
    const h = harness();

    const first = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=true"),
      h.deps,
    );
    await settle(h);
    const second = await handleBadgeRequest(
      badgeRequest("page_id=alpha&hit=true"),
      h.deps,
    );
    await settle(h);

    expect(first.headers.get("X-VBR-Cache")).toBe("BYPASS");
    expect(second.headers.get("X-VBR-Cache")).toBe("BYPASS");
    expect(h.store.writes).toBe(2);
  });
});

describe("User-Agent dependent responses", () => {
  test("a rejected direct hit is never cached under a URL Camo will ask for", async () => {
    const h = harness();
    const query = `page_id=${protectedPageId}`;

    // A direct request is refused a hit purely because of its User-Agent.
    const direct = await handleBadgeRequest(
      badgeRequest(query, { "User-Agent": "curl/8.7.1" }),
      h.deps,
    );
    await settle(h);

    expect(direct.headers.get("X-VBR-Cache")).toBe("BYPASS");
    expect(h.store.writes).toBe(0);

    // If that response had been cached, this would be served from it and the
    // legitimate hit would vanish.
    await handleBadgeRequest(
      badgeRequest(query, { "User-Agent": "github-camo (abcdef)" }),
      h.deps,
    );
    await settle(h);

    expect(h.store.writes).toBe(1);
  });
});

describe("rate limiting", () => {
  test("an exhausted hit budget still serves a badge, without counting", async () => {
    const h = harness({ hitLimiter: deny });

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
    );

    expect(response.status).toBe(200);
    expect(h.store.writes).toBe(0);
    expect(h.store.reads).toBe(1);
  });

  test("an exhausted client budget turns a direct request away before any storage", async () => {
    const h = harness({ clientLimiter: deny });

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha", { "User-Agent": "curl/8.7.1" }),
      h.deps,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(h.store.calls).toHaveLength(0);
  });

  test("the refusal cannot be cached past the minute it applies to", async () => {
    const h = harness({ clientLimiter: deny });
    const now = Date.parse("2026-08-05T12:00:00Z");

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha", { "User-Agent": "curl/8.7.1" }),
      h.deps,
      now,
    );

    expect(Date.parse(response.headers.get("Expires") ?? "")).toBe(
      now - 10 * 60 * 1000,
    );
    expect(response.headers.get("Date")).toBe(response.headers.get("Expires"));
  });

  test("an exhausted client budget degrades Camo to a read instead of refusing", async () => {
    const h = harness({ clientLimiter: deny });

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha", { "User-Agent": "github-camo (abcdef)" }),
      h.deps,
    );
    await settle(h);

    // Camo's addresses are shared by every badge on GitHub, so one busy egress
    // must never be able to put an error image in an unrelated README.
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("41");

    // Degraded to reads: the hit is what would have persisted a record, and so
    // the one thing a rotating-page-ID client must not still get.
    expect(h.store.writes).toBe(0);
    expect(h.store.reads).toBe(1);
  });

  test("a degraded proxy is held to reads even for a badge it may normally count", async () => {
    const h = harness({ clientLimiter: deny });

    await handleBadgeRequest(
      badgeRequest(`page_id=${protectedPageId}`, {
        "User-Agent": "github-camo (abcdef)",
      }),
      h.deps,
    );
    await settle(h);

    expect(h.store.writes).toBe(0);
  });

  test("a client within its budget is unaffected by the proxy exemption", async () => {
    const h = harness();

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha", { "User-Agent": "curl/8.7.1" }),
      h.deps,
    );
    await settle(h);

    expect(response.status).toBe(200);
    expect(h.store.writes).toBe(1);
  });

  test("a cache hit does not spend the client budget", async () => {
    let checks = 0;
    const counting: Limiter = {
      limit: async () => {
        checks += 1;
        return { success: true };
      },
    };
    const h = harness({ clientLimiter: counting });

    await handleBadgeRequest(badgeRequest("page_id=alpha&hit=false"), h.deps);
    await settle(h);
    await handleBadgeRequest(badgeRequest("page_id=alpha&hit=false"), h.deps);

    expect(checks).toBe(1);
  });

  test("keys the hit budget on client and page together", async () => {
    const seen: string[] = [];
    const recording: Limiter = {
      limit: async ({ key }) => {
        seen.push(key);
        return { success: true };
      },
    };
    const h = harness({ hitLimiter: recording });

    await handleBadgeRequest(
      badgeRequest("page_id=alpha", { "CF-Connecting-IP": "203.0.113.7" }),
      h.deps,
    );

    expect(seen).toEqual(["203.0.113.7|alpha"]);
  });

  test("failing open keeps badges rendering when a limiter is unavailable", async () => {
    const broken: Limiter = {
      limit: async () => {
        throw new Error("binding unavailable");
      },
    };
    const h = harness({ clientLimiter: broken, hitLimiter: broken });

    const response = await handleBadgeRequest(
      badgeRequest("page_id=alpha"),
      h.deps,
    );
    await settle(h);

    expect(response.status).toBe(200);
    expect(h.store.writes).toBe(1);
  });
});
