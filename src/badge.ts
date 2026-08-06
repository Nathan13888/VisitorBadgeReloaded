/**
 * Badge rendering. Runs entirely in the Worker - no request leaves Cloudflare.
 *
 * Uses `badge-maker`, the library Shields itself renders with, so the SVG is
 * byte-comparable with what `img.shields.io` used to return for the same
 * inputs.
 */
import { makeBadge } from "badge-maker";
import { resolveLogo } from "./logo";

export type BadgeStyle =
  | "plastic"
  | "flat"
  | "flat-square"
  | "for-the-badge"
  | "social";

const BADGE_STYLES = new Set<string>([
  "plastic",
  "flat",
  "flat-square",
  "for-the-badge",
  "social",
]);

export const DEFAULT_STYLE: BadgeStyle = "flat";

/**
 * `badge-maker` throws on an unknown style where Shields quietly fell back, so
 * anything unrecognised becomes the default rather than a failed badge.
 */
export const toBadgeStyle = (style: string): BadgeStyle =>
  BADGE_STYLES.has(style) ? (style as BadgeStyle) : DEFAULT_STYLE;

/**
 * Decodes the escaping Shields applies to badge text. Label and message used to
 * travel through a Shields URL path, so `text=Total_Visits` has always rendered
 * as "Total Visits" and existing badges depend on it.
 *
 * Single underscores become spaces, double underscores become one underscore,
 * and double dashes become one dash.
 *
 * @see https://github.com/badges/shields/blob/master/core/badge-urls/path-helpers.js
 */
export const escapeFormat = (text: string): string =>
  text
    .replace(/(^|[^_])((?:__)*)_(?!_)/g, "$1$2 ")
    .replace(/__/g, "_")
    .replace(/--/g, "-");

export type BadgeOptions = {
  label: string;
  text: string;
  colour: string;
  labelColour: string;
  style: string;
  logo: string;
  logoColour: string;
};

export const createBadge = (opt: BadgeOptions): string => {
  const style = toBadgeStyle(opt.style);
  const logoBase64 = resolveLogo({
    logo: opt.logo,
    logoColour: opt.logoColour,
    style,
  });

  return makeBadge({
    label: escapeFormat(opt.label),
    message: escapeFormat(opt.text),
    color: opt.colour,
    labelColor: opt.labelColour,
    style,
    // `makeBadge` rejects the key outright when it is present but undefined.
    ...(logoBase64 ? { logoBase64 } : {}),
  });
};
