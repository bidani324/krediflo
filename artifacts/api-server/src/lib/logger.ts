/**
 * @fileoverview Pino logger singleton for the DhanSync API server.
 *
 * Provides a structured, JSON-first logger suitable for production log
 * aggregation pipelines (e.g. Datadog, Loki, CloudWatch).
 *
 * Behaviour differs by environment:
 *   - **Development**: Uses `pino-pretty` for colourised, human-readable output
 *     in the Replit console.
 *   - **Production**: Emits raw JSON (no transport overhead) for ingestion by
 *     external log aggregators.
 *
 * Redacted fields: `authorization`, `cookie`, and `set-cookie` headers are
 * stripped from every log line to prevent credential leakage in log storage.
 *
 * Usage:
 *   - In route handlers, use `req.log.info(...)` (attached by pino-http in app.ts).
 *   - In non-request code (startup, scheduled jobs), use `logger.info(...)`.
 *
 * @example
 *   import { logger } from "../lib/logger";
 *   logger.info({ userId: 42 }, "User profile updated");
 *   logger.error({ err }, "Database connection failed");
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Configured Pino logger instance.
 *
 * `LOG_LEVEL` env var controls the minimum log level (default: `"info"`).
 * Valid values: `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"`.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",

  // Redact sensitive HTTP headers before writing to stdout
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],

  ...(isProduction
    ? {} // Production: plain JSON output — no transport overhead
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
