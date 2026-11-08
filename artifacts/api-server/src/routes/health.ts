/**
 * @fileoverview Health check endpoint for the DhanSync API server.
 *
 * Used by the Replit platform, load balancers, and monitoring tools to verify
 * the service is reachable and responsive.  Returns a minimal JSON payload
 * validated against the `HealthCheckResponse` Zod schema so the OpenAPI
 * contract is always satisfied.
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * @description Liveness probe endpoint.
 *   Returns `{ "status": "ok" }` when the server is up and able to handle requests.
 *   Does NOT check database connectivity — for a readiness probe that includes DB,
 *   a separate `/api/readyz` endpoint would be appropriate.
 *
 * @route   GET /api/healthz
 * @access  Public — no authentication required.
 * @returns {{ status: "ok" }} Validated health payload.
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
