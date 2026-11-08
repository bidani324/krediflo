/**
 * @fileoverview Centralised constants for the DhanSync API server.
 *
 * All magic numbers, external service URLs, and configuration literals are
 * declared here.  Import from this module instead of hard-coding values in
 * route handlers or middleware.
 *
 * Import pattern:
 *   import { SESSION_CONFIG, SUREPASS, BCRYPT_ROUNDS } from "../config/constants";
 */

/* ─── Session Configuration ───────────────────────────────────────────────── */

/**
 * Settings passed to `express-session` and `connect-pg-simple`.
 *
 * `COOKIE_MAX_AGE_MS`: 7 days expressed in milliseconds.  Rolling sessions
 * extend the expiry on every request, so active users stay logged in
 * indefinitely while inactive ones are evicted after 7 days of inactivity.
 *
 * `DEV_FALLBACK_SECRET`: Used only when `SESSION_SECRET` env var is absent
 * (i.e., local development without a `.env` file).  The server will log a
 * warning if this fallback is active in a non-development environment.
 */
export const SESSION_CONFIG = {
  /** PostgreSQL table managed by connect-pg-simple for session storage. */
  TABLE_NAME: "user_sessions",

  /** Session cookie lifetime: 7 days in milliseconds. */
  COOKIE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,

  /**
   * Insecure development-only fallback secret.
   * In production, `SESSION_SECRET` env var must always be set.
   * @see environment-secrets skill for managing secrets in Replit.
   */
  DEV_FALLBACK_SECRET: "nexgen-dev-secret-change-in-prod",
} as const;

/* ─── Password Hashing ────────────────────────────────────────────────────── */

/**
 * bcrypt cost factor used when hashing user and admin passwords.
 *
 * A value of 10 requires ~100 ms on a modern CPU — slow enough to resist
 * brute-force attacks while fast enough for login UX.  Increase to 12 if the
 * server hardware allows and registration/login latency is acceptable.
 */
export const BCRYPT_ROUNDS = 10;

/* ─── File Upload Constraints ─────────────────────────────────────────────── */

/**
 * Maximum decoded file size in bytes for the `POST /api/loans/:id/uploads`
 * endpoint.  Must match `MAX_UPLOAD_BYTES` in the frontend constants file to
 * prevent client/server disagreements on what constitutes an oversized upload.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB

/* ─── Surepass KYC API ────────────────────────────────────────────────────── */

/**
 * Configuration for the Surepass document-procurement API.
 *
 * `BASE_URL`: All Surepass endpoints are relative to this base.
 * The `SUREPASS_TOKEN` bearer token is read from `process.env.SUREPASS_TOKEN`
 * at request time — it is NEVER bundled into application code or exposed to
 * the browser.
 *
 * @see https://kyc-api.surepass.io — Surepass API documentation
 * @see artifacts/api-server/src/routes/surepass.ts — proxy implementation
 */
export const SUREPASS = {
  BASE_URL: "https://kyc-api.surepass.io/api/v1",
} as const;

/* ─── FINpass Account Aggregator API ─────────────────────────────────────── */

/**
 * Configuration for the FINpass Account Aggregator API.
 * Credentials (FINPASS_API_KEY, FINPASS_API_SECRET) are read from env at
 * request time — never bundled into application code or sent to the browser.
 *
 * @see https://api.finpass.ai — FINpass API documentation
 * @see artifacts/api-server/src/routes/finpass.ts — proxy implementation
 */
export const FINPASS = {
  BASE_URL: "https://api.finpass.ai/api/v1",
} as const;

/* ─── Request Body Limits ─────────────────────────────────────────────────── */

/**
 * Maximum size for JSON request bodies parsed by `express.json()`.
 * A 10 MB PDF becomes 13.34 MB in base64; allow JSON encoding overhead.
 * Individual upload endpoints still enforce decoded file limits.
 */
export const JSON_BODY_LIMIT = "15mb";
