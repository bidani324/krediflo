/**
 * @fileoverview Root API router — aggregates all feature sub-routers.
 *
 * Mounted at `/api` in `app.ts` (`app.use("/api", router)`), so every path
 * defined in the sub-routers is prefixed with `/api/`.
 *
 * Router mount order:
 *   1. healthRouter     → GET  /api/healthz
 *   2. authRouter       → POST /api/auth/login|register|logout, GET /api/auth/me
 *   3. adminAuthRouter  → POST /api/admin/auth/login|logout, GET /api/admin/auth/me
 *   4. surepassRouter   → POST /api/surepass/cibil|pan|mca/*, GET /api/surepass/document/*
 *   5. adminUsersRouter → GET|PATCH|DELETE /api/admin/users/*
 *   6. profileRouter    → GET|PUT /api/profile/detail-sheet
 *   7. uploadsRouter    → GET|POST|DELETE /api/loans/:id/uploads/*
 *   8. loansRouter      → All /api/loans/* CRUD, calculators, and admin dashboard
 */

import { Router, type IRouter } from "express";
import { verificationLimiter, authLimiter } from "../middleware/rate-limit";
import healthRouter    from "./health";
import loansRouter     from "./loans";
import authRouter      from "./auth";
import adminAuthRouter from "./admin-auth";
import surepassRouter  from "./surepass";
import finpassRouter   from "./finpass";
import adminUsersRouter     from "./admin-users";
import adminQuickCheckRouter from "./admin-quick-check";
import profileRouter         from "./profile";
import uploadsRouter         from "./uploads";

const router: IRouter = Router();

// Rate-limit helper: apply a limiter only to state-changing methods.
// GET /auth/me and GET /admin/auth/me are called on every page load / poll
// cycle — they must NOT count against the auth limiter or the window fills
// before a real login POST arrives. Only POST (login/register/logout) needs
// rate limiting here.
import type { Request, Response, NextFunction, RequestHandler } from "express";
// Accepts any Express middleware: real express-rate-limit handlers in
// production, plain no-op middleware in development.
const limitPostsOnly =
  (limiter: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) =>
    req.method === "POST" ? limiter(req, res, next) : next();

router.use(healthRouter);
// Auth: rate-limit only POST /login, /register, /logout — not GET /me.
router.use("/auth",                 limitPostsOnly(authLimiter), authRouter);
router.use("/admin/auth",           limitPostsOnly(authLimiter), adminAuthRouter);
// Verification: rate-limit only POSTs that trigger paid third-party API calls.
// GET document downloads and status polls stay on the generous global limiter.
const limitVerificationPosts = limitPostsOnly(verificationLimiter);

router.use("/admin/quick-check",    limitVerificationPosts, adminQuickCheckRouter);
router.use("/surepass",             limitVerificationPosts, surepassRouter);
router.use("/finpass",              limitVerificationPosts, finpassRouter);
router.use(adminUsersRouter);
router.use(profileRouter);
router.use(uploadsRouter);
router.use(loansRouter);

export default router;
