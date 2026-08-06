import { describe, expect, test } from "bun:test";
import { detectPlatform, referrerHost, simplifyUserAgent } from "./classify";

describe("referrerHost", () => {
  test("reduces a referrer to its host", () => {
    expect(referrerHost("https://github.com/Nathan13888/vbr#readme")).toBe(
      "github.com",
    );
  });

  test("reports an absent referrer as direct", () => {
    expect(referrerHost("direct")).toBe("Direct");
  });

  test("never throws on a header that is not a URL", () => {
    // `Referer` is attacker-controlled; this used to fail the whole hit.
    for (const value of ["", "}{", "javascript:alert(1)//", "  "]) {
      expect(() => referrerHost(value)).not.toThrow();
    }
    expect(referrerHost("}{")).toBe("Unknown");
  });
});

describe("detectPlatform", () => {
  test("classifies anything self-declaring as a bot first", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14) Googlebot")).toBe(
      "Bot",
    );
    expect(detectPlatform("some-crawler/1.0")).toBe("Bot");
    expect(detectPlatform("spider/2")).toBe("Bot");
  });

  test("classifies the common platforms", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      "iOS",
    );
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Mac OS X 10_15_7)")).toBe(
      "macOS",
    );
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
    expect(detectPlatform("Mozilla/5.0 (X11; CrOS x86_64)")).toBe("Chrome OS");
  });

  test("falls back rather than failing", () => {
    expect(detectPlatform("")).toBe("Other");
    expect(detectPlatform("curl/8.7.1")).toBe("Other");
  });
});

describe("simplifyUserAgent", () => {
  test("names the bots that matter", () => {
    expect(simplifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(
      "Googlebot",
    );
    expect(simplifyUserAgent("github-camo (0123abcd)")).toBe("GitHub Camo");
  });

  test("does not read Edge as Chrome", () => {
    const edge =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

    expect(simplifyUserAgent(edge)).toBe("Edge");
  });

  test("does not read Chrome as Safari", () => {
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

    expect(simplifyUserAgent(chrome)).toBe("Chrome");
  });

  test("recognises Safari only without Chrome", () => {
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";

    expect(simplifyUserAgent(safari)).toBe("Safari");
  });

  test("falls back rather than failing", () => {
    expect(simplifyUserAgent("")).toBe("Other");
  });
});
