/**
 * @fileoverview Rate limiting middleware for the Krediflo API server.
 *
 * Three tiers:
 *  - `verificationLimiter` — strict 20 requests / 15 min / IP for endpoints
 *    that trigger paid third-party verification calls (CIBIL, PAN, MCA,
 *    Account Aggregator syncs, BSA). Prevents API bill exhaustion and
 *    brute-force PAN/OTP probing.
 *  - `authLimiter` — 10 requests / 15 min / IP on login/register endpoints
 *    to slow credential stuffing. **Production only** — in development all
 *    browser traffic routes through Replit's shared proxy IP, so a per-IP
 *    limit would lock out all users from a single test burst.
 *  - `apiLimiter` — a generous global backstop (300 requests / 15 min / IP).
 *    Also production-only for the same proxy-IP reason.
 *
 * The limiters trust `req.ip`, which is correct because `trust proxy` is set
 * in app.ts so the client IP is derived from Replit's reverse-proxy headers.
 */

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** No-op middleware used in development where shared-proxy IPs make per-IP limits unsafe. */
const passThrough = ((_req: Request, _res: Response, next: NextFunction) => next()) as import("express-rate-limit").RateLimitRequestHandler;

const standardOptions = {
  windowMs: WINDOW_MS,
  standardHeaders: true as const,
  legacyHeaders: false,
};

/**
 * Strict limiter for endpoints that trigger paid third-party verification calls.
 * Active in production only — dev traffic shares a single proxy IP.
 * The limit of 20/15min covers a full multi-applicant AA/BSA + CIBIL/PAN/MCA
 * flow with retries while still blocking scripted abuse.
 */
export const verificationLimiter = IS_PRODUCTION
  ? rateLimit({
      ...standardOptions,
      limit: 20,
      message: {
        error:
          "Too many verification requests. Please wait 15 minutes before trying again.",
      },
    })
  : passThrough;

/**
 * Limiter for authentication endpoints (login/register/logout POSTs).
 * Active in production only — see module docstring for why dev is excluded.
 */
export const authLimiter = IS_PRODUCTION
  ? rateLimit({
      ...standardOptions,
      limit: 10,
      message: {
        error: "Too many attempts. Please wait 15 minutes before trying again.",
      },
    })
  : passThrough;

/**
 * Generous global backstop applied to the whole /api router.
 * Active in production only.
 */
export const apiLimiter = IS_PRODUCTION
  ? rateLimit({
      ...standardOptions,
      limit: 300,
      message: {
        error: "Too many requests. Please slow down and try again shortly.",
      },
    })
  : passThrough;
