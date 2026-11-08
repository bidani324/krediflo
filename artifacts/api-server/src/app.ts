/**
 * @fileoverview Express application factory for the DhanSync API server.
 *
 * Configures the middleware pipeline in order:
 *   1. Reverse-proxy trust (`trust proxy`) — required for secure cookies behind Replit's proxy.
 *   2. Structured HTTP request/response logging via pino-http.
 *   3. CORS with credentials — allows the frontend origin to send cookies.
 *   4. Body parsing — JSON (10 mb limit to support base64 file uploads) + URL-encoded forms.
 *   5. Session management — PostgreSQL-backed sessions via connect-pg-simple.
 *   6. API router — all `/api/*` routes are handled here.
 *
 * This module exports a configured `Express` instance.  The HTTP server is
 * created in `index.ts` so this file remains testable in isolation.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./middleware/rate-limit";
import { SESSION_CONFIG, JSON_BODY_LIMIT } from "./config/constants";

const PgStore = connectPgSimple(session);

const app: Express = express();

// ── 1. Reverse-proxy trust ────────────────────────────────────────────────── //
// Trust Replit's reverse proxy so `req.secure` and `req.ip` are set correctly.
// Required for `cookie.secure: true` to work in production behind the proxy.
app.set("trust proxy", 1);

// ── 2. HTTP request logging ───────────────────────────────────────────────── //
// Attach Pino logger to every request.  Serialisers strip sensitive headers
// (cookie, authorization) before writing to stdout.
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          // Strip query params from logs to avoid leaking sensitive search terms
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── 3. Security headers ──────────────────────────────────────────────────── //
// Helmet sets CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
// and other hardening headers. CSP here governs API responses only (the SPA is
// served separately); it is intentionally strict since the API returns JSON.
const isProductionEnv = process.env.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    frameguard: { action: "deny" },
    hsts: isProductionEnv
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// ── 3b. CORS ─────────────────────────────────────────────────────────────── //
// Production: restrict to krediflo.com and its subdomains only.
// Development: allow the Replit preview domain and localhost so the proxied
// preview iframe keeps working. `credentials: true` is required for cookies.
const PRODUCTION_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*krediflo\.com$/i;

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / non-browser requests send no Origin header — allow.
      if (!origin) return callback(null, true);
      if (!isProductionEnv) return callback(null, true);
      if (PRODUCTION_ORIGIN_RE.test(origin)) return callback(null, true);
      // Allow the Replit deployment domain itself (same-app requests).
      const replitDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean);
      if (replitDomains.some((d) => origin === `https://${d.trim()}`)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

// ── 3c. CSRF origin enforcement ──────────────────────────────────────────── //
// Session cookies use SameSite=None in production, so CORS alone does not stop
// cross-site state-changing requests (simple form POSTs bypass preflight).
// Reject any mutating request whose Origin header is present but not an
// authorized origin. Same-origin and non-browser clients (no Origin) pass.
app.use((req, res, next) => {
  if (!isProductionEnv) return next();
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const replitDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").filter(Boolean);
  const allowed =
    PRODUCTION_ORIGIN_RE.test(origin) ||
    replitDomains.some((d) => origin === `https://${d.trim()}`);
  if (!allowed) {
    return void res.status(403).json({ error: "Cross-origin request rejected" });
  }
  next();
});

// ── 4. Body parsers ───────────────────────────────────────────────────────── //
// 10 mb JSON limit accommodates base64-encoded file payloads from the
// document upload feature (`POST /api/loans/:id/uploads`).
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// ── 5. Session middleware ─────────────────────────────────────────────────── //
const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      // `user_sessions` table must exist — NOT auto-created due to esbuild bundling
      // incompatibility with connect-pg-simple's `createTableIfMissing` option.
      tableName: SESSION_CONFIG.TABLE_NAME,
    }),
    // SESSION_SECRET must be set in production via the Replit secrets manager
    // (enforced at boot by env-check.ts). The dev fallback only ever applies
    // in local development.
    secret: process.env.SESSION_SECRET ?? SESSION_CONFIG.DEV_FALLBACK_SECRET,
    resave: false,
    saveUninitialized: false,
    // Rolling: extend the cookie expiry on every authenticated request
    rolling: true,
    cookie: {
      // In production: HTTPS-only, cross-site (needed behind Replit's proxy)
      secure: isProduction,
      // HTTP-only prevents JS from reading the session cookie (XSS mitigation)
      httpOnly: true,
      maxAge: SESSION_CONFIG.COOKIE_MAX_AGE_MS,
      sameSite: isProduction ? "none" : "lax",
    },
  }),
);

// ── 6. API router (behind a generous global rate-limit backstop) ─────────── //
app.use("/api", apiLimiter, router);

// ── 7. Global error handler ──────────────────────────────────────────────── //
// Catches anything thrown or passed to next(err) by route handlers. Never
// exposes stack traces or internal error details to the client; in production
// the message is fully generic.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if ((err as { type?: string })?.type === "entity.too.large") {
    return void res.status(413).json({ ok: false, error: "Request too large. Upload a smaller file." });
  }
  logger.error({ err, url: req.url?.split("?")[0], method: req.method }, "Unhandled route error");
  if (res.headersSent) return;
  res.status(500).json({
    error: isProductionEnv
      ? "Something went wrong on our side. Please try again shortly."
      : err instanceof Error
        ? err.message
        : "Unknown error",
  });
});

export default app;
