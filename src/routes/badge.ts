/**
 * The badge itself.
 *
 * Only the route lives here - the caching, hit policy, and rendering behind it
 * are in `src/badge-request.ts`, where they are driven by injected dependencies
 * and can be tested without a worker.
 */

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import z from "zod";
import { handleBadgeRequest } from "../badge-request";
import { ErrorResponseSchema } from "../schema";

const badge = new Hono<{ Bindings: Env }>();

badge.get(
  "/badge",
  describeRoute({
    description:
      "Render a visitor badge, counting the view unless `hit` opts out.",
    responses: {
      200: {
        description:
          "The badge. Cached for 15 seconds when `hit` opts out of counting, never cached otherwise.",
        content: {
          "image/svg+xml": { schema: resolver(z.string()) },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
      429: {
        description:
          "The client is over its overall badge budget. Being over the budget for *counting* a view is not an error - the badge renders normally and the view is not counted.",
        content: {
          "image/svg+xml": { schema: resolver(z.string()) },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
    },
  }),
  validator(
    "query",
    z.object({
      // A page ID becomes a Durable Object name, so it is length-capped rather
      // than left unbounded. 256 is far above any real badge and well below
      // what an abusive caller would otherwise be free to store.
      page_id: z.string().min(1).max(256),
      color: z.string().optional(),
      lcolor: z.string().optional(),
      style: z.string().optional(),
      text: z.string().optional(),
      label: z.string().optional(),
      logo: z.string().optional(),
      logoColor: z.string().optional(),
      lColor: z.string().optional(),
      hit: z.string().optional(),
      custom: z.string().optional(),
    }),
  ),
  async (c) => {
    const pageId = c.req.query("page_id");
    if (!pageId) {
      return c.json({ error: "page_id is required" }, 400);
    }

    return await handleBadgeRequest(c.req.raw, {
      cache: caches.default,
      badgeStore: c.env.BADGE_STORE,
      hitLimiter: c.env.RL_BADGE_HIT,
      clientLimiter: c.env.RL_BADGE_CLIENT,
      waitUntil: (work) => c.executionCtx.waitUntil(work),
    });
  },
);

export default badge;
