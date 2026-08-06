import { describe, expect, test } from "bun:test";
import { resolveLogo } from "./logo";

const resolve = (
  logo: string,
  logoColour = "",
  style: "flat" | "social" = "flat",
) => resolveLogo({ logo, logoColour, style });

const decode = (dataUri: string | undefined): string =>
  dataUri ? atob(dataUri.replace("data:image/svg+xml;base64,", "")) : "";

const pathOf = (logo: string): string =>
  decode(resolve(logo)).match(/ d="([^"]+)"/)?.[1] ?? "";

const fillOf = (
  logo: string,
  logoColour = "",
  style: "flat" | "social" = "flat",
): string =>
  decode(resolve(logo, logoColour, style)).match(/fill="([^"]+)"/)?.[1] ?? "";

describe("name resolution", () => {
  test("resolves the canonical Simple Icons slug", () => {
    expect(pathOf("googlechrome")).not.toBe("");
  });

  test("resolves the hyphenated title Shields accepts", () => {
    for (const [title, slug] of [
      ["google-chrome", "googlechrome"],
      ["sublime-text", "sublimetext"],
      ["adblock-plus", "adblockplus"],
    ]) {
      expect(pathOf(title)).not.toBe("");
      expect(pathOf(title)).toBe(pathOf(slug));
    }
  });

  test("is case insensitive", () => {
    expect(pathOf("GitHub")).not.toBe("");
    expect(pathOf("GitHub")).toBe(pathOf("github"));
    expect(pathOf("Google-Chrome")).toBe(pathOf("googlechrome"));
  });

  test("treats spaces like Shields does", () => {
    expect(pathOf("google chrome")).not.toBe("");
    expect(pathOf("google chrome")).toBe(pathOf("googlechrome"));
  });

  test("keeps Shields' aliases for renamed icons", () => {
    for (const [alias, target] of [
      ["eclipse", "eclipse-ide"],
      ["gitter-white", "gitter"],
      ["scrutinizer", "scrutinizer-ci"],
      ["stackoverflow", "stack-overflow"],
      ["travis", "travisci"],
    ]) {
      expect(pathOf(alias)).not.toBe("");
      expect(pathOf(alias)).toBe(pathOf(target));
    }
  });

  test("matches Shields where the upstream icon is gone entirely", () => {
    // Simple Icons dropped Azure DevOps, so both aliases pointing at it render
    // nothing - which is also what Shields does today.
    expect(resolve("azuredevops")).toBeUndefined();
    expect(resolve("tfs")).toBeUndefined();
  });

  test("resolves Simple Icons' own aliases, which Shields ignores", () => {
    // `Rome` was renamed to Biome upstream.
    expect(pathOf("rome")).not.toBe("");
    expect(pathOf("rome")).toBe(pathOf("biome"));
    expect(pathOf("deep-lake")).toBe(pathOf("activeloop"));
    expect(pathOf("deeplake")).toBe(pathOf("activeloop"));
  });

  test("falls back to stripping separators the index does not use", () => {
    expect(pathOf("google_chrome")).not.toBe("");
    expect(pathOf("google_chrome")).toBe(pathOf("googlechrome"));
    expect(pathOf("Sublime Text")).toBe(pathOf("sublimetext"));
  });

  test("never lets a title shadow another icon's slug", () => {
    // Two icons are titled "Hive"; the slug must win over the title key.
    expect(pathOf("hive")).not.toBe("");
    expect(pathOf("hive_blockchain")).not.toBe("");
    expect(pathOf("hive")).not.toBe(pathOf("hive_blockchain"));
  });

  test("returns nothing for unknown names", () => {
    expect(resolve("")).toBeUndefined();
    expect(resolve("definitely-not-an-icon")).toBeUndefined();
    expect(resolve("../../etc/passwd")).toBeUndefined();
  });
});

describe("logo colour", () => {
  test("honours an explicit colour", () => {
    expect(fillOf("github", "red")).toBe("#dd4343");
    expect(fillOf("github", "55acb7")).toBe("#55acb7");
    expect(fillOf("github", "white")).toBe("white");
    expect(fillOf("github", "rebeccapurple")).toBe("rebeccapurple");
  });

  test("prefers the Shields palette over the CSS colour of the same name", () => {
    expect(fillOf("github", "blue")).toBe("#007ec6");
    expect(fillOf("github", "gray")).toBe("#555");
  });

  test("is case sensitive about colour names, as Shields is", () => {
    // `Blue` parses as no colour at all upstream, so the icon keeps its default.
    expect(fillOf("github", "Blue")).toBe("whitesmoke");
  });

  test("lightens a dark brand colour so it stays visible", () => {
    expect(fillOf("github")).toBe("whitesmoke");
  });

  test("keeps a bright brand colour as-is", () => {
    // Simple Icons gives Snapchat #FFFC00.
    expect(fillOf("snapchat")).toBe("#FFFC00");
  });

  test("darkens a bright brand colour on the pale social style", () => {
    expect(fillOf("snapchat", "", "social")).toBe("#333");
    expect(fillOf("github", "", "social")).toBe("#181717");
  });

  test("ignores a colour that is not a colour", () => {
    expect(fillOf("github", "not-a-colour")).toBe("whitesmoke");
  });
});

describe("data URIs", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAgAABQAB";

  test("passes a data URI through untouched", () => {
    expect(resolve(png)).toBe(png);
  });

  test("accepts a bare media type, as Shields does", () => {
    expect(resolve(png.replace("data:", ""))).toBe(png);
  });

  test("restores the + characters a query string turns into spaces", () => {
    expect(resolve(png.replace(/\+/g, " "))).toBe(png);
  });

  test("rejects anything that is not a data URI", () => {
    expect(resolve("data:not-a-media-type")).toBeUndefined();
    expect(resolve("https://example.com/logo.png")).toBeUndefined();
  });
});
