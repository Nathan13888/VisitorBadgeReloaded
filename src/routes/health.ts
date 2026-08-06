/**
 * Liveness probe.
 *
 * Deliberately touches nothing: it answers whether the worker is running, not
 * whether any badge's storage is reachable, so a probe can never itself become
 * a source of Durable Object load.
 */

import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import z from "zod";

const health = new Hono<{ Bindings: Env }>();

health.get(
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

export default health;
