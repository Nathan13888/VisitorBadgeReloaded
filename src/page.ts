import { hashPageId } from "./util";
import type { AnalyticsSummary } from "./do";

/**
 * Get Durable Object stub for a page ID
 */
function getStub(
  namespace: DurableObjectNamespace,
  pageId: string
): DurableObjectStub {
  // Use page ID as the durable object ID for deterministic routing
  const id = namespace.idFromName(pageId);
  return namespace.get(id);
}

// Fetch page id count without modification
export const page_id_fetch = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string
): Promise<string> => {
  const stub = getStub(analyticsNamespace, pageId);
  const response = await stub.fetch("http://do/count");
  const data = await response.json<{ count: number }>();
  return data.count.toString();
};

// Fetch page id count and increment it by one
export const page_id_fetch_add_one = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string,
  request: Request
): Promise<string> => {
  // Extract request metadata
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const referrer = request.headers.get("Referer") || "direct";
  const country = request.headers.get("CF-IPCountry") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "unknown";

  const stub = getStub(analyticsNamespace, pageId);
  
  const payload = {
    pageId,
    ip,
    referrer,
    country,
    userAgent,
  };

  const response = await stub.fetch("http://do/hit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json<{ count: number }>();
  return data.count.toString();
};

/**
 * Get analytics summary for a badge
 */
export const page_id_get_analytics = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string
): Promise<AnalyticsSummary | null> => {
  const stub = getStub(analyticsNamespace, pageId);
  const response = await stub.fetch("http://do/summary");
  
  if (!response.ok) {
    return null;
  }
  
  return await response.json<AnalyticsSummary>();
};

/**
 * Check if a badge exists
 */
export const page_id_exists = async (
  analyticsNamespace: DurableObjectNamespace,
  pageId: string
): Promise<boolean> => {
  const stub = getStub(analyticsNamespace, pageId);
  const response = await stub.fetch("http://do/exists");
  const data = await response.json<{ exists: boolean }>();
  return data.exists;
};
