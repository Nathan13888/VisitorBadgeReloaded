/**
 * Minimal HyperLogLog sketch for estimating distinct daily visitors.
 *
 * The point of using a sketch here is that nothing identifying is ever stored.
 * A visitor address is hashed with a per-day key and folded into 256 one-byte
 * registers, which are lossy by construction - they hold a maximum leading-zero
 * rank, not any per-visitor value.
 *
 * The key is derived from a Worker secret (see `deriveDailyKey`) and is never
 * persisted. That matters: registers alone are not probeable, but registers
 * *plus* the key let someone test a guessed address for membership, and on a
 * quiet badge a real visitor always tests positive. Storing the key next to
 * the registers would hand an attacker both halves and defeat the point.
 */

/** Register address bits. p = 8 gives m = 256 registers, ~6.5% standard error. */
const HLL_PRECISION = 8;

/** Number of registers (m). */
export const HLL_REGISTERS = 1 << HLL_PRECISION;

/** Bias-correction constant for m registers. Valid for m >= 128. */
function alpha(m: number): number {
  return 0.7213 / (1 + 1.079 / m);
}

/** A single day's sketch. Safe to persist: it holds no key and no addresses. */
export interface HllSketch {
  /** UTC date this sketch covers, formatted YYYY-MM-DD. */
  date: string;
  /** base64 of the HLL_REGISTERS registers, one byte each. */
  registers: string;
}

/**
 * Encode bytes as base64 (registers persist as a string, not a 256-item array)
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Decode base64 back into bytes
 */
export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create an empty sketch for a day
 */
export function createSketch(date: string): HllSketch {
  return { date, registers: bytesToBase64(new Uint8Array(HLL_REGISTERS)) };
}

/**
 * Derive the hashing key for one badge on one day.
 *
 * HMAC over the badge and date means a register dump cannot be replayed
 * against another badge or another day, and because the key is recomputed from
 * a Worker secret on every request it never reaches storage.
 */
export async function deriveDailyKey(
  secret: string,
  pageId: string,
  date: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${pageId}:${date}`),
  );
  return new Uint8Array(signature);
}

/**
 * Fold a value (e.g. a client address) into the sketch.
 *
 * The value is only ever hashed in memory: SHA-256 over the day's key followed
 * by the value bytes. Byte 0 of the digest selects the register and the leading
 * zero count across bytes 1..7 gives the rank, so the stored value is between 1
 * and 57 and always fits in a byte.
 */
export async function addToSketch(
  sketch: HllSketch,
  value: string,
  key: Uint8Array,
): Promise<void> {
  const valueBytes = new TextEncoder().encode(value);
  const input = new Uint8Array(key.length + valueBytes.length);
  input.set(key, 0);
  input.set(valueBytes, key.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const index = digest[0];

  let rank = 1;
  for (let i = 1; i < 8; i++) {
    const byte = digest[i];
    if (byte === 0) {
      rank += 8;
      continue;
    }
    // Math.clz32 counts leading zeros in 32 bits; subtract the 24 padding bits.
    rank += Math.clz32(byte) - 24;
    break;
  }

  const registers = base64ToBytes(sketch.registers);
  if (rank > registers[index]) {
    registers[index] = rank;
    sketch.registers = bytesToBase64(registers);
  }
}

/**
 * Estimate the number of distinct values folded into a set of registers
 */
export function estimateRegisters(registers: Uint8Array): number {
  // m comes from the array, not the module constant, so sketches persisted
  // under an older precision still estimate correctly.
  const m = registers.length;

  let harmonic = 0;
  let zeros = 0;
  for (const value of registers) {
    harmonic += 2 ** -value;
    if (value === 0) {
      zeros++;
    }
  }

  let estimate = (alpha(m) * m * m) / harmonic;

  // Small-range correction (linear counting). Badges commonly see only a
  // handful of visitors a day, where the raw estimator is badly biased.
  if (estimate <= 2.5 * m && zeros > 0) {
    estimate = m * Math.log(m / zeros);
  }

  // The large-range (2^32) correction is omitted: no single badge approaches
  // billions of distinct visitors in one day.
  return Math.round(estimate);
}

/**
 * Estimate the number of distinct values folded into a sketch
 */
export function estimateSketch(sketch: HllSketch): number {
  return estimateRegisters(base64ToBytes(sketch.registers));
}
