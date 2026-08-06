/**
 * OpenAPI document, its browsable reference, and the Markdown rendering of it.
 *
 * Everything here is derived from the routes already registered on the app,
 * which is why this is a function the entrypoint calls last rather than a
 * router it mounts alongside the others: a route registered after this runs
 * would be missing from the published document.
 */

import { Scalar } from "@scalar/hono-api-reference";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import type { Hono } from "hono";
import {
  type GenerateSpecOptions,
  generateSpecs,
  openAPIRouteHandler,
} from "hono-openapi";

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

/**
 * Register the documentation routes.
 *
 * `/llms.txt` is a proposal to standardise on serving a Markdown description of
 * a service for language models.
 *
 * @see https://llmstxt.org/
 */
export async function registerDocs(app: Hono<{ Bindings: Env }>) {
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

  // Rendered once at startup rather than per request: the document cannot
  // change while the worker is running.
  const docs = await generateSpecs(app, specs);
  const markdown = await createMarkdownFromOpenApi(JSON.stringify(docs));
  app.get("/llms.txt", (c) => c.text(markdown));
}
