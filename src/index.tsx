/**
 * Worker entrypoint.
 *
 * Assembly only: each feature owns its own routes under `src/routes`, and this
 * decides what is mounted and in what order. Anything that belongs to one
 * feature - its schemas, its rate limiting, its caching - belongs in that
 * feature's module, not here.
 */

import { Hono } from "hono";
import { BadgeDO } from "./do";
import analytics from "./routes/analytics";
import badge from "./routes/badge";
import { registerDocs } from "./routes/docs";
import health from "./routes/health";
import pages from "./routes/pages";

export { BadgeDO };

const app = new Hono<{ Bindings: Env }>();

app.route("/", pages);
app.route("/", health);
app.route("/", analytics);
app.route("/", badge);

// Last, and only ever last: the OpenAPI document and the Markdown served at
// /llms.txt are generated from whatever is already registered above.
await registerDocs(app);

export default app;
