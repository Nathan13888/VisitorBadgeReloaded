import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import { Hono } from "hono";
import {
  type GenerateSpecOptions,
  describeRoute,
  generateSpecs,
  openAPIRouteHandler,
  resolver,
  validator,
} from "hono-openapi";
import type { FC } from "hono/jsx";
import z from "zod";
import { handleBadgeRequest } from "./badge-request";
import { BadgeDO } from "./do";
import { page_id_exists, page_id_get_analytics } from "./page";
import InfoPage from "./pages/info";
import LandingPage from "./pages/landing";
import { clientKey, withinLimit } from "./rate-limit";

export { BadgeDO };

const app = new Hono<{ Bindings: Env }>();

/**
 * Home page layout
 * @param props
 * @returns
 */
const Layout: FC = (props) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Visitor Badge Reloaded</title>

        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" />
      </head>
      <body>{props.children}</body>
    </html>
  );
};

app.get("/", (c) => {
  return c.html(
    <Layout>
      <LandingPage />
    </Layout>,
  );
});

app.get(
  "/info/:id",
  describeRoute({
    description: "Badge Info Page",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "The badge page ID",
        allowEmptyValue: false,
        example: "example-page-id",
        // schema: resolver(z.string()),
      },
    ],
    responses: {
      200: {
        description: "Successful response",
        content: {
          "text/html": { schema: resolver(z.string()) },
        },
      },
    },
  }),
  async (c) => {
    const { id } = c.req.param();

    // Renders the same summary the analytics API does, so it is metered the
    // same way. Without this it was the cheapest route to the most expensive
    // Durable Object call in the service.
    if (!(await withinLimit(c.env.RL_ANALYTICS, clientKey(c.req.raw)))) {
      c.header("Retry-After", "60");
      return c.text("Rate limit exceeded", 429);
    }

    const analytics = c.env.BADGE_STORE;
    const summary = await page_id_get_analytics(analytics, id);

    return c.html(
      <Layout>
        <InfoPage id={id} analytics={summary} />
      </Layout>,
    );
  },
);

app.get(
  "/healthz",
  describeRoute({
    description: "Health",
    responses: {
      200: {
        description: "Successful response",
        content: {
          "text/plain": { schema: resolver(z.string()) },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: "ok" });
  },
);

// Analytics API endpoint
app.get(
  "/api/analytics/:pageId",
  describeRoute({
    description: "Get analytics summary for a badge",
    responses: {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                totalHits: z.number(),
                uniqueVisitorsToday: z
                  .number()
                  .nullable()
                  .describe(
                    "Estimated distinct visitors so far today (UTC), from a HyperLogLog sketch with ~6.5% margin of error. Not a person-level count. Null when the metric is unavailable.",
                  ),
                hitsLast24Hours: z.number(),
                hitsLast7Days: z.number(),
                hitsLast14Days: z.number(),
                topReferrers: z.array(
                  z.object({ referrer: z.string(), count: z.number() }),
                ),
                topCountries: z.array(
                  z.object({ country: z.string(), count: z.number() }),
                ),
                topUserAgents: z.array(
                  z.object({ agent: z.string(), count: z.number() }),
                ),
                topPlatforms: z.array(
                  z.object({ platform: z.string(), count: z.number() }),
                ),
                dailyStats: z.array(
                  z.object({
                    date: z.string(),
                    hits: z.number(),
                    uniqueVisitors: z
                      .number()
                      .nullable()
                      .describe(
                        "Estimated distinct visitors that day (~6.5% margin of error), or null for days predating this measurement.",
                      ),
                  }),
                ),
                hourlyStats: z.array(
                  z.object({ hour: z.string(), hits: z.number() }),
                ),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
        },
      },
      404: {
        description: "Not Found",
        content: {
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
        },
      },
      429: {
        description: "Too Many Requests",
        content: {
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
        },
      },
    },
  }),
  async (c) => {
    const { pageId } = c.req.param();

    if (!pageId) {
      return c.json({ error: "page_id is required" }, 400);
    }

    const analytics = c.env.BADGE_STORE;

    // Metered per client rather than per badge, and before anything touches
    // storage. The binding reports only whether the request is allowed, so
    // there is no remaining/reset to report back.
    if (!(await withinLimit(c.env.RL_ANALYTICS, clientKey(c.req.raw)))) {
      c.header("Retry-After", "60");
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    // Check if badge exists first
    const exists = await page_id_exists(analytics, pageId);
    if (!exists) {
      return c.json({ error: "Badge not found" }, 404);
    }

    // Get analytics summary
    const summary = await page_id_get_analytics(analytics, pageId);
    if (!summary) {
      return c.json({ error: "No analytics data available" }, 404);
    }

    return c.json(summary);
  },
);

/**
 * Badge generation endpoint
 */

app.get(
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
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
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
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
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

/**
 * OpenAPI Documentation and LLM Markdown Generation
 */
const specs: Partial<GenerateSpecOptions> = {
  documentation: {
    info: {
      title: "Visitor Badge Reloaded API",
      version: "1.0.0",
      description: "A modern visitor badge service",
    },
    servers: [
      { url: "https://vbr.nathanchung.dev", description: "Official Website" },
      {
        url: "https://github.com/Nathan13888/VisitorBadgeReloaded",
        description: "GitHub",
      },
    ],
  },
};
app.get("/openapi", openAPIRouteHandler(app, specs));

app.get(
  "/docs",
  Scalar({
    url: "/openapi",
    theme: "purple",
    cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest",
    // proxyUrl: "proxy.scalar.dev",
  }),
);

/**
 * Register a route to serve the Markdown for LLMs
 *
 * Q: Why /llms.txt?
 * A: It's a proposal to standardise on using an /llms.txt file.
 *
 * @see https://llmstxt.org/
 */
const docs = await generateSpecs(app, specs);
const markdown = await createMarkdownFromOpenApi(JSON.stringify(docs));
app.get("/llms.txt", (c) => c.text(markdown));

export default app;
