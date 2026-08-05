const GITHUB_CAMO_ONLY_PAGE_IDS = new Set(["visitor-badge-reloaded-visitors"]);

/**
 * Decide whether a badge request may record a hit.
 *
 * The project visitor badge is intentionally restricted to GitHub's image
 * proxy so direct requests and embeds outside GitHub cannot inflate its count.
 * This cannot distinguish the project's README from another GitHub README,
 * because both are fetched by GitHub Camo.
 */
export function shouldRecordHit(
  pageId: string,
  request: Request,
  hitRequested: boolean,
): boolean {
  if (!hitRequested) {
    return false;
  }

  if (!GITHUB_CAMO_ONLY_PAGE_IDS.has(pageId)) {
    return true;
  }

  const userAgent = request.headers.get("User-Agent")?.toLowerCase() ?? "";
  return userAgent.startsWith("github-camo ");
}
