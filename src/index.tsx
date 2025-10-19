import { Hono } from "hono";
import { type BadgeOptions, createBadge } from "./badge";
import { page_id_fetch, page_id_fetch_add_one, page_id_get_analytics, page_id_exists } from "./page";
import LandingPage from "./pages/landing";
import type { FC } from "hono/jsx";
import InfoPage from "./pages/info";
import { BadgeDO } from "./do";

export { BadgeDO };

const app = new Hono<{ Bindings: Env }>();

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

app.get("/info/:id", async (c) => {
  const { id } = c.req.param();

  const analytics = c.env.BADGE_STORE;
  const summary = await page_id_get_analytics(analytics, id);

  return c.html(
    <Layout>
      <InfoPage id={id} analytics={summary} />
    </Layout>,
  );
});

app.get("/healthz", (c) => {
  return c.json({ status: "ok" });
});

// Analytics API endpoint
app.get("/api/analytics/:pageId", async (c) => {
  const { pageId } = c.req.param();
  
  if (!pageId) {
    return c.json({ error: "page_id is required" }, 400);
  }

  const analytics = c.env.BADGE_STORE;
  
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
});

app.get("/badge", async (c) => {
  const pageId = c.req.query("page_id");
  if (!pageId) {
    return c.json({ error: "page_id is required" }, 400);
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
  const analytics = c.env.BADGE_STORE;
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
});

export default app;
