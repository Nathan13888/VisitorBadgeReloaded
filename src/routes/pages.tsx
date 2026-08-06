/**
 * The HTML the service serves: the landing page and a badge's info page.
 *
 * The page components themselves live in `src/pages`; this is only the routing
 * and the shell they render into.
 */

import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type { FC } from "hono/jsx";
import z from "zod";
import { page_id_get_analytics } from "../do-client";
import InfoPage from "../pages/info";
import LandingPage from "../pages/landing";
import { clientKey, withinLimit } from "../rate-limit";

const pages = new Hono<{ Bindings: Env }>();

/**
 * Shell shared by every rendered page
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

pages.get("/", (c) => {
  return c.html(
    <Layout>
      <LandingPage />
    </Layout>,
  );
});

pages.get(
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

export default pages;
