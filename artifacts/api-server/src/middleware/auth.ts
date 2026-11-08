/**
 * @fileoverview Authentication guard middleware for the DhanSync API server.
 *
 * All three middleware functions follow the Express `(req, res, next)` pattern:
 *   - On success → call `next()` to continue the middleware chain.
 *   - On failure → respond with HTTP 401 and short-circuit the chain.
 *
 * Session fields (`req.session.userId`, `req.session.adminId`) are populated by
 * the login handlers in `routes/auth.ts` and `routes/admin-auth.ts` respectively,
 * and their types are declared in `types/session.d.ts`.
 */

import { Request, Response, NextFunction } from "express";

/**
 * @description Express middleware that allows only authenticated portal users.
 *   Checks for `req.session.userId` (set on successful user login).
 *
 * Apply to any route that should be inaccessible to guests and admin-only
 * operators (e.g. `POST /api/loans`, `GET /api/profile/*`).
 *
 * @param {Request}      req  - Incoming HTTP request with session data.
 * @param {Response}     res  - Outgoing HTTP response.
 * @param {NextFunction} next - Passes control to the next handler.
 * @returns {void}
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * @description Express middleware that allows only authenticated admin operators.
 *   Checks for `req.session.adminId` (set on successful admin login).
 *
 * Apply to all `/api/admin/*` routes that manage users, loans, and system data.
 *
 * @param {Request}      req  - Incoming HTTP request with session data.
 * @param {Response}     res  - Outgoing HTTP response.
 * @param {NextFunction} next - Passes control to the next handler.
 * @returns {void}
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

/**
 * @description Express middleware that allows either an authenticated portal
 *   user OR an authenticated admin operator to proceed.
 *
 * Use for shared resources such as file uploads and loan reads where both
 * users (viewing their own loan) and admins (viewing any loan) require access.
 *
 * @param {Request}      req  - Incoming HTTP request with session data.
 * @param {Response}     res  - Outgoing HTTP response.
 * @param {NextFunction} next - Passes control to the next handler.
 * @returns {void}
 */
export function requireUserOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId && !req.session.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
