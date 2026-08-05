import { describe, expect, test } from "bun:test";
import { shouldRecordHit } from "./hit-policy";

const protectedPageId = "visitor-badge-reloaded-visitors";

describe("shouldRecordHit", () => {
  test("allows GitHub Camo to record hits for the protected page", () => {
    const request = new Request("https://example.com/badge", {
      headers: { "User-Agent": "github-camo (abcdef)" },
    });

    expect(shouldRecordHit(protectedPageId, request, true)).toBe(true);
  });

  test("rejects direct hits for the protected page", () => {
    const request = new Request("https://example.com/badge", {
      headers: { "User-Agent": "curl/8.7.1" },
    });

    expect(shouldRecordHit(protectedPageId, request, true)).toBe(false);
  });

  test("rejects user agents that only contain the Camo name", () => {
    const request = new Request("https://example.com/badge", {
      headers: { "User-Agent": "not-github-camo (abcdef)" },
    });

    expect(shouldRecordHit(protectedPageId, request, true)).toBe(false);
  });

  test("rejects a missing user agent for the protected page", () => {
    const request = new Request("https://example.com/badge");

    expect(shouldRecordHit(protectedPageId, request, true)).toBe(false);
  });

  test("leaves other page IDs unrestricted", () => {
    const request = new Request("https://example.com/badge", {
      headers: { "User-Agent": "curl/8.7.1" },
    });

    expect(shouldRecordHit("another-project", request, true)).toBe(true);
  });

  test("does not record a hit when hit=false", () => {
    const request = new Request("https://example.com/badge", {
      headers: { "User-Agent": "github-camo (abcdef)" },
    });

    expect(shouldRecordHit(protectedPageId, request, false)).toBe(false);
  });
});
