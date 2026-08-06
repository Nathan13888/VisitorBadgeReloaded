import { describe, expect, test } from "bun:test";
import {
  type BadgeStyle,
  createBadge,
  escapeFormat,
  toBadgeStyle,
} from "./badge";

const STYLES: BadgeStyle[] = [
  "plastic",
  "flat",
  "flat-square",
  "for-the-badge",
  "social",
];

const options = {
  label: "Visitors",
  text: "1234",
  colour: "blue",
  labelColour: "grey",
  style: "flat",
  logo: "",
  logoColour: "white",
};

/** Decodes the `<image href="data:...;base64,...">` a resolved logo produces. */
const logoSvg = (badge: string): string => {
  const match = badge.match(/href="data:image\/svg\+xml;base64,([^"]+)"/);
  return match ? atob(match[1]) : "";
};

describe("escapeFormat", () => {
  test("decodes the escaping badge text used to travel through Shields URLs", () => {
    expect(escapeFormat("Total_Visits")).toBe("Total Visits");
    expect(escapeFormat("snake__case")).toBe("snake_case");
    expect(escapeFormat("a--b")).toBe("a-b");
    expect(escapeFormat("_leading")).toBe(" leading");
    expect(escapeFormat("trailing_")).toBe("trailing ");
    expect(escapeFormat("___")).toBe("_ ");
  });

  test("leaves ordinary text alone", () => {
    expect(escapeFormat("Visitors")).toBe("Visitors");
    expect(escapeFormat("1234")).toBe("1234");
  });
});

describe("toBadgeStyle", () => {
  test("passes through the styles badge-maker supports", () => {
    for (const style of STYLES) {
      expect(toBadgeStyle(style)).toBe(style);
    }
  });

  test("falls back rather than throwing, the way Shields did", () => {
    expect(toBadgeStyle("square")).toBe("flat");
    expect(toBadgeStyle("")).toBe("flat");
  });
});

describe("createBadge", () => {
  test("renders label, message and colours", () => {
    const badge = createBadge(options);

    expect(badge).toStartWith("<svg");
    expect(badge).toContain("Visitors");
    expect(badge).toContain("1234");
    expect(badge).toContain("#007ec6");
  });

  test("accepts bare hex colours, as the query params document", () => {
    expect(createBadge({ ...options, colour: "55acb7" })).toContain("#55acb7");
  });

  test("does not throw on an unusable style or colour", () => {
    const badge = createBadge({
      ...options,
      style: "not-a-style",
      colour: "not-a-colour",
    });

    expect(badge).toStartWith("<svg");
  });

  test("escapes text rather than letting it reach the SVG", () => {
    const badge = createBadge({ ...options, label: "<script>" });

    expect(badge).not.toContain("<script>");
    expect(badge).toContain("&lt;script&gt;");
  });

  test("embeds a named logo without any outbound request", () => {
    const badge = createBadge({ ...options, logo: "github" });

    expect(logoSvg(badge)).toContain("<path d=");
  });

  test("omits the logo entirely when the name is unknown", () => {
    const badge = createBadge({ ...options, logo: "definitely-not-an-icon" });

    expect(badge).not.toContain("<image");
  });

  test("passes a data URI logo through", () => {
    const logo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAgAABQAB";
    const badge = createBadge({ ...options, logo });

    expect(badge).toContain(logo);
  });

  test("renders every supported style", () => {
    for (const style of STYLES) {
      expect(createBadge({ ...options, style, logo: "github" })).toStartWith(
        "<svg",
      );
    }
  });
});
