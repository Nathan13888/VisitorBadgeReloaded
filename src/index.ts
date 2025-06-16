import { Hono } from "hono";
import { type BadgeOptions, createBadge } from "./badge";
import { page_id_fetch, page_id_fetch_add_one } from "./kv";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.redirect("https://github.com/Nathan13888/VisitorBadgeReloaded", 307);
});

app.get("/healthz", (c) => {
  return c.json({ status: "ok" });
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

  // get count
  const kv = c.env.vbr_badge_counts;
  let text = await (hit
    ? page_id_fetch_add_one(kv, pageId)
    : page_id_fetch(kv, pageId));

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
