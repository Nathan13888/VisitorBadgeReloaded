/**
 * Resolves a `logo=` parameter to an SVG data URI, entirely in-process.
 *
 * Behaviour follows Shields' `lib/logos.js` so badges that were built against
 * `img.shields.io` keep rendering identically: the same name normalisation,
 * the same legacy aliases, and the same brand/light/dark colour choice.
 *
 * @see https://github.com/badges/shields/blob/master/lib/logos.js
 */
import { fromString } from "css-color-converter";
import type { BadgeStyle } from "./badge";
import { ICON_BLOB, ICON_INDEX_JSON } from "./generated/simple-icons";

/**
 * Logo names Shields kept working after the underlying icons were renamed or
 * removed upstream. Applied before the index lookup, exactly as Shields does.
 */
const LEGACY_ALIASES: Record<string, string> = {
  azuredevops: "azure-devops",
  eclipse: "eclipse-ide",
  "gitter-white": "gitter",
  scrutinizer: "scrutinizer-ci",
  stackoverflow: "stack-overflow",
  tfs: "azure-devops",
  travis: "travisci",
};

/** Brightness bounds Shields uses to decide when a brand colour needs help. */
const LIGHT_THRESHOLD = 0.4;
const DARK_THRESHOLD = 0.6;

const DATA_URI =
  /^data:[\w+.-]+\/[\w+.-]+(?:;[\w-]+=[\w.+-]+)*(?:;base64)?,.*$/;

/** The nine colour names Shields defines on top of CSS. */
const NAMED_COLOURS: Record<string, string> = {
  brightgreen: "#4b0",
  green: "#67ac09",
  yellow: "#d8b800",
  yellowgreen: "#95991a",
  orange: "#ea7233",
  red: "#dd4343",
  blue: "#007ec6",
  grey: "#555",
  lightgrey: "#939393",
};

const COLOUR_ALIASES: Record<string, string> = {
  gray: "grey",
  lightgray: "lightgrey",
  critical: "red",
  important: "orange",
  success: "brightgreen",
  informational: "blue",
  inactive: "lightgrey",
};

type IconIndex = Record<string, [offset: number, length: number]>;

const parseIndex = (): IconIndex => JSON.parse(ICON_INDEX_JSON);

let index: IconIndex | undefined;

/** ~4500 keys, so this is deferred until a badge actually asks for a logo. */
const lookup = (key: string): { hex: string; svgTail: string } | undefined => {
  if (!index) {
    index = parseIndex();
  }
  const record = index[key];
  if (!record) {
    return undefined;
  }
  const [offset, length] = record;
  return {
    hex: ICON_BLOB.slice(offset, offset + 6),
    svgTail: ICON_BLOB.slice(offset + 6, offset + length),
  };
};

const findIcon = (name: string) => {
  const lowered = name.toLowerCase();
  const key = (LEGACY_ALIASES[lowered] ?? lowered).replace(/ /g, "-");

  // Canonical slugs and hyphenated titles both live in the index; the stripped
  // form is a last resort for names like `google_chrome` that Shields rejects.
  return lookup(key) ?? lookup(key.replace(/[^a-z0-9]/g, ""));
};

/**
 * Reduces a colour to a canonical name, `#hex`, or lowercased CSS colour.
 * Returns undefined when the input is not a colour at all, which is the
 * caller's cue to fall back to a default.
 */
const normalizeColour = (colour: string): string | undefined => {
  if (colour in NAMED_COLOURS) {
    return colour;
  }
  if (colour in COLOUR_ALIASES) {
    return COLOUR_ALIASES[colour];
  }
  if (/^([\da-f]{3}){1,2}$/i.test(colour)) {
    return `#${colour.toLowerCase()}`;
  }
  // Shields matches CSS colours case sensitively, so `Blue` is not a colour to
  // it at all and the caller's default wins. Kept as-is for that reason.
  return fromString(colour.trim()) ? colour.toLowerCase() : undefined;
};

const toSvgColour = (colour: string): string | undefined => {
  const normalized = normalizeColour(colour);
  return normalized !== undefined && normalized in NAMED_COLOURS
    ? NAMED_COLOURS[normalized]
    : normalized;
};

/** Perceived brightness of a six digit hex, on the 0-1 scale Shields uses. */
const brightness = (hex: string): number => {
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return +((r * 299 + g * 587 + b * 114) / 255000).toFixed(2);
};

/**
 * Brand colour by default, except where it would disappear: dark logos are
 * lightened against the badge background, and light logos are darkened against
 * the pale background of the social style.
 */
const defaultFill = (hex: string, style: BadgeStyle): string => {
  const level = brightness(hex);
  if (style !== "social" && level <= LIGHT_THRESHOLD) {
    return "whitesmoke";
  }
  if (style === "social" && level >= DARK_THRESHOLD) {
    return "#333";
  }
  return `#${hex}`;
};

/** `btoa` only takes latin1, and a handful of icon titles are not ASCII. */
const toBase64 = (text: string): string => {
  let latin1 = "";
  for (const byte of new TextEncoder().encode(text)) {
    latin1 += String.fromCharCode(byte);
  }
  return btoa(latin1);
};

/**
 * Query strings turn `+` into a space, so put them back before deciding
 * whether the value is a data URI. Bare media types like `image/png;base64,...`
 * are accepted too, matching Shields.
 */
const asDataUri = (logo: string): string | undefined => {
  const candidate = (logo.startsWith("data:") ? logo : `data:${logo}`)
    .replace(/ /g, "+")
    .replace(/\s/g, "");
  return DATA_URI.test(candidate) ? candidate : undefined;
};

export type LogoOptions = {
  /** A Simple Icons name or a data URI. */
  logo: string;
  /** Overrides the icon's brand colour when it names a colour. */
  logoColour: string;
  style: BadgeStyle;
};

/**
 * @returns a data URI to embed in the badge, or undefined when the logo is
 * neither a known icon nor a usable data URI (in which case the badge renders
 * without one, as Shields does).
 */
export const resolveLogo = ({
  logo,
  logoColour,
  style,
}: LogoOptions): string | undefined => {
  if (!logo) {
    return undefined;
  }

  const dataUri = asDataUri(logo);
  if (dataUri) {
    return dataUri;
  }

  const icon = findIcon(logo);
  if (!icon) {
    return undefined;
  }

  const fill = toSvgColour(logoColour) ?? defaultFill(icon.hex, style);

  return `data:image/svg+xml;base64,${toBase64(`<svg fill="${fill}"${icon.svgTail}`)}`;
};
