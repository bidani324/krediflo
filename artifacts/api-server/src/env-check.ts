/**
 * @fileoverview Startup environment assertion for the Krediflo API server.
 *
 * Verifies that every required environment variable exists before the HTTP
 * server begins accepting traffic. In production, a missing variable halts
 * startup with a clear log line; in development, missing vendor keys produce
 * warnings only (routes that need them fail per-request instead).
 */

import { logger } from "./lib/logger";

/** Variables the server cannot run without, in any environment. */
const REQUIRED_ALWAYS = ["PORT", "DATABASE_URL"] as const;

/** Variables that MUST be present in production. */
const REQUIRED_PRODUCTION = [
  "SESSION_SECRET",
  "SUREPASS_TOKEN",
  "FINPASS_API_KEY",
  "FINPASS_API_SECRET",
  "COMM_CIBIL_API_KEY",
  "COMM_CIBIL_API_SECRET",
] as const;

export function assertEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key]) missing.push(key);
  }

  for (const key of REQUIRED_PRODUCTION) {
    if (!process.env[key]) {
      if (isProduction) missing.push(key);
      else warnings.push(key);
    }
  }

  for (const key of warnings) {
    logger.warn(
      { key },
      `Environment variable ${key} is not set — dependent verification features will be unavailable until it is configured.`,
    );
  }

  if (missing.length > 0) {
    logger.fatal(
      { missing },
      `Startup halted: required environment variable(s) missing: ${missing.join(", ")}. ` +
        "Set them via the Replit Secrets manager and restart the server.",
    );
    process.exit(1);
  }

  logger.info(
    { environment: process.env.NODE_ENV ?? "development" },
    "Environment check passed",
  );
}
