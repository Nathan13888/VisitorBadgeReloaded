import { describe, expect, mock, test } from "bun:test";

/**
 * `cloudflare:workers` only resolves inside workerd, and the base class is a
 * constructor that stores its two arguments. Standing that much in lets the
 * object's lifecycle - which is where the migration invariant lives - be
 * exercised under plain `bun test`, with a fake state underneath it.
 */
mock.module("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      readonly ctx: DurableObjectState,
      readonly env: Env,
    ) {}
  },
}));

/** MD5 is a workerd extension; WebCrypto has no such algorithm. See util.ts. */
mock.module("./util", () => ({
  hashPageId: async (pageId: string) => `md5:${pageId}`,
}));

const { BadgeDO } = await import("./do");

const PAGE_ID = "alpha";

/**
 * Enough of `DurableObjectState` for the object to load, persist and schedule.
 *
 * `blockConcurrencyWhile` is a real serializing implementation rather than a
 * pass-through, because one of the things under test is that it holds two
 * concurrent calls apart.
 */
class FakeState {
  storage = new Map<string, unknown>();
  alarm: number | null = null;
  writes = 0;
  private queue: Promise<unknown> = Promise.resolve();

  readonly id: { name: string };

  constructor(name: string) {
    // Assigned here rather than as a field initializer: those run before the
    // constructor body, so a `{ name: this.name }` field would capture
    // undefined and leave the object unable to name itself for the migration.
    this.id = { name };
  }

  readonly ctxStorage = {
    get: async <T>(key: string): Promise<T | undefined> =>
      this.storage.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => {
      this.writes += 1;
      // Structured-cloned by the real thing, so a stored record must not stay
      // live under the caller's reference.
      this.storage.set(key, structuredClone(value));
    },
    getAlarm: async (): Promise<number | null> => this.alarm,
    setAlarm: async (time: number): Promise<void> => {
      this.alarm = time;
    },
  };

  blockConcurrencyWhile = <T>(callback: () => Promise<T>): Promise<T> => {
    const next = this.queue.then(callback);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  asCtx(): DurableObjectState {
    return {
      id: this.id,
      storage: this.ctxStorage,
      blockConcurrencyWhile: this.blockConcurrencyWhile,
    } as unknown as DurableObjectState;
  }
}

/** The v1 namespace, with a switch for the outage the migration must survive. */
class FakeKv {
  reads = 0;
  failing = false;
  private entries = new Map<string, string>();

  seed(pageId: string, count: string): void {
    this.entries.set(`md5:${pageId}`, count);
  }

  get = async (key: string): Promise<string | null> => {
    this.reads += 1;
    if (this.failing) {
      throw new Error("KV unavailable");
    }
    return this.entries.get(key) ?? null;
  };
}

interface Harness {
  object: InstanceType<typeof BadgeDO>;
  state: FakeState;
  kv: FakeKv;
}

/** A fresh object over the given state, as the runtime builds one per instance. */
function build(state: FakeState, kv: FakeKv): Harness {
  const env = {
    vbr_badge_counts: kv as unknown as KVNamespace,
    // Left unset: the visitor sketch needs a secret and none of this is about
    // the sketch.
    VISITOR_HASH_KEY: undefined,
  } as unknown as Env;

  return { object: new BadgeDO(state.asCtx(), env), state, kv };
}

function harness(): Harness {
  return build(new FakeState(PAGE_ID), new FakeKv());
}

function hit(pageId = PAGE_ID) {
  return {
    pageId,
    ip: "203.0.113.7",
    referrer: "direct",
    country: "CA",
    userAgent: "github-camo (abcdef)",
  };
}

describe("v1 migration", () => {
  test("adopts the legacy count and counts the hit on top of it", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "1234");

    expect(await h.object.recordHit(hit())).toEqual({ count: 1235 });
  });

  test("a badge that was never on v1 starts at its first hit", async () => {
    const h = harness();

    expect(await h.object.recordHit(hit())).toEqual({ count: 1 });
  });

  test("a failed lookup refuses the hit rather than starting a fresh record", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "1234");
    h.kv.failing = true;

    await expect(h.object.recordHit(hit())).rejects.toThrow(
      /migration incomplete/i,
    );

    // Nothing persisted, which is the whole invariant: storage is what retires
    // the migration, so writing here would shadow the legacy count for good.
    expect(h.state.writes).toBe(0);
    expect(h.state.storage.size).toBe(0);
  });

  test("a failed lookup is retried, and the legacy count survives the outage", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "1234");
    h.kv.failing = true;

    await h.object.recordHit(hit()).catch(() => {});
    // Reads are allowed through, and answer for a badge that has nothing yet.
    expect(await h.object.getCount()).toEqual({ count: 0 });

    h.kv.failing = false;

    // The same instance retries: the outage cost one hit, not the count.
    expect(await h.object.recordHit(hit())).toEqual({ count: 1235 });
  });

  test("a value KV cannot make sense of is not retried forever", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "not a number");

    expect(await h.object.recordHit(hit())).toEqual({ count: 1 });
    // Settled on the first look, unlike a failure.
    expect(h.kv.reads).toBe(1);
  });

  test("runs once per badge and never again", async () => {
    const state = new FakeState(PAGE_ID);
    const kv = new FakeKv();
    kv.seed(PAGE_ID, "1234");

    await build(state, kv).object.recordHit(hit());
    expect(kv.reads).toBe(1);

    // A later instance loads the record it wrote and does not consult v1.
    const revived = build(state, kv);
    expect(await revived.object.recordHit(hit())).toEqual({ count: 1236 });
    expect(kv.reads).toBe(1);
  });
});

describe("concurrent initialization", () => {
  test("a hit alongside a count read migrates once and loses neither", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "1234");

    // Exactly what the badge path does: it dispatches the hit and reads the
    // count without waiting for it. Both reach a cold object together, and the
    // input gate does not hold them apart, because the v1 lookup is a KV read
    // rather than a storage operation.
    const [recorded, read] = await Promise.all([
      h.object.recordHit(hit()),
      h.object.getCount(),
    ]);

    expect(h.kv.reads).toBe(1);
    expect(recorded).toEqual({ count: 1235 });
    // The read either preceded the hit or followed it; it may never have seen a
    // record the migration built twice and then half-discarded.
    expect([1234, 1235]).toContain(read.count);

    // Whichever order they ran in, the hit is in the record that was kept.
    const revived = build(h.state, h.kv);
    expect(await revived.object.getCount()).toEqual({ count: 1235 });
  });

  test("concurrent hits on a cold badge all land", async () => {
    const h = harness();
    h.kv.seed(PAGE_ID, "100");

    await Promise.all([
      h.object.recordHit(hit()),
      h.object.recordHit(hit()),
      h.object.recordHit(hit()),
    ]);

    expect(h.kv.reads).toBe(1);
    expect(await h.object.getCount()).toEqual({ count: 103 });
  });
});

describe("retention alarm", () => {
  test("only a badge with data schedules one", async () => {
    const h = harness();

    expect(h.state.alarm).toBeNull();

    await h.object.getCount();
    // A read for an invented page ID must leave nothing behind: no record, no
    // alarm waking the object every six hours.
    expect(h.state.alarm).toBeNull();
    expect(h.state.storage.size).toBe(0);

    await h.object.recordHit(hit());
    expect(h.state.alarm).not.toBeNull();
  });
});
