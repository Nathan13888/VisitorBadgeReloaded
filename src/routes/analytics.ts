/**
 * The public analytics API for a badge.
 *
 * The most expensive route in the service: it is not cached, and every call
 * reaches the badge's Durable Object wherever in the world it lives. That is
 * why it is metered per client before it touches storage.
 */

import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { page_id_exists, page_id_get_analytics } from "../do-client";
import { clientKey, withinLimit } from "../rate-limit";
import { AnalyticsSummarySchema, ErrorResponseSchema } from "../schema";

const analytics = new Hono<{ Bindings: Env }>();

analytics.get(
  "/api/analytics/:pageId",
  describeRoute({
    description: "Get analytics summary for a badge",
    responses: {
      200: {
        description: "Successful response",
        content: {
          // The same schema the Durable Object's reply is validated against and
          // the info page renders, so what is published here cannot describe a
          // shape the service does not actually return.
          "application/json": { schema: resolver(AnalyticsSummarySchema) },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
      404: {
        description: "Not Found",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
      429: {
        description: "Too Many Requests",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
    },
  }),
  async (c) => {
    const { pageId } = c.req.param();

    if (!pageId) {
      return c.json({ error: "page_id is required" }, 400);
    }

    const badgeStore = c.env.BADGE_STORE;

    // Metered per client rather than per badge, and before anything touches
    // storage. The binding reports only whether the request is allowed, so
    // there is no remaining/reset to report back.
    if (!(await withinLimit(c.env.RL_ANALYTICS, clientKey(c.req.raw)))) {
      c.header("Retry-After", "60");
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    // Check if badge exists first
    const exists = await page_id_exists(badgeStore, pageId);
    if (!exists) {
      return c.json({ error: "Badge not found" }, 404);
    }

    // Get analytics summary
    const summary = await page_id_get_analytics(badgeStore, pageId);
    if (!summary) {
      return c.json({ error: "No analytics data available" }, 404);
    }

    return c.json(summary);
  },
);

export default analytics;
