import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { type BadgeOptions, createBadge } from "./badge";
import { BadgeDO } from "./do";
import {
  page_id_exists,
  page_id_fetch,
  page_id_fetch_add_one,
  page_id_get_analytics,
} from "./page";
import InfoPage from "./pages/info";
import LandingPage from "./pages/landing";
import { RATE_LIMITS, checkRateLimit } from "./rate-limit";
import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import {
  describeRoute,
  type GenerateSpecOptions,
  generateSpecs,
  openAPIRouteHandler,
  resolver,
  validator,
} from "hono-openapi";
import z from "zod";

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
                pageId: z.string(),
                totalVisits: z.number(),
                uniqueVisitors: z.number(),
                dailyVisits: z.array(
                  z.object({
                    date: z.string(),
                    count: z.number(),
                  }),
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

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      analytics,
      pageId,
      RATE_LIMITS.analytics,
    );

    // Add rate limit headers
    c.header("X-RateLimit-Limit", rateLimitResult.limit.toString());
    c.header("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      new Date(rateLimitResult.resetAt).toISOString(),
    );

    if (!rateLimitResult.allowed) {
      return c.json(
        { error: "Rate limit exceeded", retryAfter: rateLimitResult.resetAt },
        429,
      );
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
    description: "Health",
    responses: {
      200: {
        description: "Successful response",
        content: {
          "text/plain": { schema: resolver(z.string()) },
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
        description: "Too Many Requests",
        content: {
          "application/json": {
            schema: resolver(z.object({ error: z.string() })),
          },
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
      page_id: z.string().min(1),
      color: z.string().optional(),
      lcolor: z.string().optional(),
      style: z.string().optional(),
      text: z.string().optional(),
      logo: z.string().optional(),
      logoColor: z.string().optional(),
      hit: z
        .union([z.string(), z.boolean()])
        .optional()
        .transform((val) => {
          if (val === undefined) return undefined;
          if (typeof val === "boolean") return val;
          return val.toLowerCase() === "true" || val.toLowerCase() === "yes";
        }),
      unique: z.boolean().optional(),
      custom: z.string().optional(),
    }),
  ),
  async (c) => {
    const pageId = c.req.query("page_id");
    if (!pageId) {
      return c.json({ error: "page_id is required" }, 400);
    }

    // Check rate limit for badge generation
    const analytics = c.env.BADGE_STORE;
    const rateLimitResult = await checkRateLimit(
      analytics,
      pageId,
      RATE_LIMITS.badge,
    );

    // Add rate limit headers
    c.header("X-RateLimit-Limit", rateLimitResult.limit.toString());
    c.header("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      new Date(rateLimitResult.resetAt).toISOString(),
    );

    if (!rateLimitResult.allowed) {
      // Return a simple error badge instead of JSON for better UX
      const errorBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20">
      <rect width="150" height="20" fill="#e05d44"/>
      <text x="75" y="14" font-family="Verdana" font-size="11" fill="#fff" text-anchor="middle">Rate Limit Exceeded</text>
    </svg>`;
      c.header("Content-Type", "image/svg+xml");
      c.header(
        "Retry-After",
        Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
      );
      return c.body(errorBadge, 429);
    }

    const colour = c.req.query("color") ?? "blue";
    const labelColour = c.req.query("lcolor") ?? "grey";
    const style = c.req.query("style") ?? "flat";
    const label = c.req.query("text") ?? "Visitors";
    const logo = c.req.query("logo") ?? "";
    const logoColour = c.req.query("logoColor") ?? "white";

    const hit_qry = c.req.query("hit");
    const hit =
      hit_qry == null || hit_qry.toLowerCase() === "true" || hit_qry === "yes";

    // set time ten minutes ago, formated time.RFC1123
    const date = new Date(Date.now() - 10 * 60 * 1000).toUTCString();
    let expiry = date;
    const unique = !!c.req.query("unique");
    if (unique) {
      expiry = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
    } else {
      c.header("Cache-Control", "no-cache,max-age=0");
    }
    c.header("Content-Type", "image/svg+xml");
    c.header("Date", date);
    c.header("Expires", expiry);

    // get count using Durable Object analytics
    let text = await (hit
      ? page_id_fetch_add_one(analytics, pageId, c.req.raw)
      : page_id_fetch(analytics, pageId));

    // check for custom formatting
    const custom_template = c.req.query("custom");
    if (custom_template) {
      text = custom_template.replace("CNT", text);
    }

    // get badge
    const badgeOptions: BadgeOptions = {
      label,
      text,
      colour,
      labelColour,
      style,
      logo,
      logoColour,
    };

    const badge = await createBadge(badgeOptions);
    if (!badge) {
      return c.json({ error: "Failed to create badge" }, 500);
    }

    return c.body(badge, 200);
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
