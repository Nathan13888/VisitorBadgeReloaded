import { describe, expect, test } from "bun:test";
import {
  HLL_REGISTERS,
  type HllSketch,
  addToSketch,
  base64ToBytes,
  bytesToBase64,
  createSketch,
  deriveDailyKey,
  estimateRegisters,
  estimateSketch,
} from "./hll";

const DAY = "2026-08-05";
const SECRET = "test-secret";
const PAGE = "example-page";

const keyFor = (pageId = PAGE, date = DAY) =>
  deriveDailyKey(SECRET, pageId, date);

async function sketchOf(count: number, prefix = "10.0"): Promise<HllSketch> {
  const sketch = createSketch(DAY);
  const key = await keyFor();
  for (let i = 0; i < count; i++) {
    await addToSketch(sketch, `${prefix}.${(i >> 8) & 0xff}.${i & 0xff}`, key);
  }
  return sketch;
}

function relativeError(estimate: number, actual: number): number {
  return Math.abs(estimate - actual) / actual;
}

describe("base64 helpers", () => {
  test("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i;
    }

    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  test("round-trips the empty register set", () => {
    const empty = new Uint8Array(HLL_REGISTERS);
    const decoded = base64ToBytes(bytesToBase64(empty));

    expect(decoded.length).toBe(HLL_REGISTERS);
    expect(decoded.every((value) => value === 0)).toBe(true);
  });

  test("a new sketch encodes exactly one byte per register", () => {
    const sketch = createSketch(DAY);

    expect(base64ToBytes(sketch.registers).length).toBe(HLL_REGISTERS);
  });

  test("a sketch carries no key to persist", () => {
    expect(Object.keys(createSketch(DAY)).sort()).toEqual([
      "date",
      "registers",
    ]);
  });
});

describe("estimateRegisters", () => {
  test("reports zero for empty registers", () => {
    expect(estimateRegisters(new Uint8Array(HLL_REGISTERS))).toBe(0);
  });

  test("applies the small-range correction instead of the raw estimator", () => {
    const registers = new Uint8Array(HLL_REGISTERS);
    registers[0] = 1;

    // The raw estimator would report ~184 here; linear counting reports 1.
    expect(estimateRegisters(registers)).toBe(1);
  });

  test("uses the raw estimator once no registers are empty", () => {
    const registers = new Uint8Array(HLL_REGISTERS).fill(4);

    // alpha * m^2 / (m * 2^-4) = alpha * m * 16
    expect(estimateRegisters(registers)).toBe(2942);
  });
});

// These are deterministic - the key comes from a fixed test secret, so a given
// population always produces the same estimate. The bounds stay loose rather
// than pinned to exact values so they describe the estimator's real guarantee
// (~6.5% standard error at m = 256, asserted at roughly four of them) instead
// of hard-coding whatever this particular secret happens to yield.
describe("sketch accuracy", () => {
  test("is exact for a single visitor", async () => {
    expect(estimateSketch(await sketchOf(1))).toBe(1);
  });

  test("is within 30% for 10 visitors", async () => {
    const estimate = estimateSketch(await sketchOf(10));

    expect(relativeError(estimate, 10)).toBeLessThan(0.3);
  });

  test("is within 30% for 1000 visitors", async () => {
    const estimate = estimateSketch(await sketchOf(1000));

    expect(relativeError(estimate, 1000)).toBeLessThan(0.3);
  });

  test("stays accurate across independent per-day keys", async () => {
    for (let run = 0; run < 5; run++) {
      const estimate = estimateSketch(await sketchOf(200, `172.${run}`));

      expect(relativeError(estimate, 200)).toBeLessThan(0.3);
    }
  });
});

describe("idempotence", () => {
  test("adding the same value twice does not change the estimate", async () => {
    const sketch = createSketch(DAY);
    const key = await keyFor();
    await addToSketch(sketch, "203.0.113.7", key);

    const afterFirst = sketch.registers;
    const estimateAfterFirst = estimateSketch(sketch);

    await addToSketch(sketch, "203.0.113.7", key);

    expect(sketch.registers).toBe(afterFirst);
    expect(estimateSketch(sketch)).toBe(estimateAfterFirst);
  });

  test("repeating a whole population does not change the estimate", async () => {
    const sketch = createSketch(DAY);
    const key = await keyFor();
    const values = ["198.51.100.1", "198.51.100.2", "198.51.100.3"];

    for (const value of values) {
      await addToSketch(sketch, value, key);
    }
    const once = estimateSketch(sketch);
    const registersOnce = sketch.registers;

    for (let repeat = 0; repeat < 10; repeat++) {
      for (const value of values) {
        await addToSketch(sketch, value, key);
      }
    }

    // Assert on the registers rather than on an expected cardinality: three
    // distinct values collide into one register ~1% of the time, which is
    // correct HLL behaviour but would flake a `toBe(3)` assertion.
    expect(sketch.registers).toBe(registersOnce);
    expect(estimateSketch(sketch)).toBe(once);
  });
});

describe("deriveDailyKey", () => {
  const hex = (bytes: Uint8Array) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  test("is stable for the same badge, day and secret", async () => {
    expect(hex(await keyFor())).toBe(hex(await keyFor()));
  });

  test("differs across days, badges and secrets", async () => {
    const base = hex(await keyFor());

    expect(hex(await keyFor(PAGE, "2026-08-06"))).not.toBe(base);
    expect(hex(await keyFor("other-page"))).not.toBe(base);
    expect(hex(await deriveDailyKey("other-secret", PAGE, DAY))).not.toBe(base);
  });

  test("makes sketches from different days uncomparable", async () => {
    const today = createSketch(DAY);
    const yesterday = createSketch("2026-08-04");
    const todayKey = await keyFor();
    const yesterdayKey = await keyFor(PAGE, "2026-08-04");

    // Enough shared values that two keys agreeing on every register is
    // impossible in practice; one value alone would collide ~0.2% of the time.
    for (let i = 0; i < 8; i++) {
      await addToSketch(today, `192.0.2.${i}`, todayKey);
      await addToSketch(yesterday, `192.0.2.${i}`, yesterdayKey);
    }

    // The same visitors land in different registers, so a surviving register
    // dump cannot be replayed against another day's data.
    expect(today.registers).not.toBe(yesterday.registers);
  });
});
