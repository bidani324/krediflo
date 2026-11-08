/**
 * @fileoverview Express session type augmentation for the DhanSync API server.
 *
 * Extends the `express-session` `SessionData` interface to include DhanSync's
 * session fields, giving TypeScript full type-safety when reading or writing
 * `req.session.userId` / `req.session.adminId` in route handlers and middleware.
 *
 * Both fields are optional (`?`) because sessions start empty (not yet
 * authenticated) and only one is set at a time — logging in as a user clears
 * `adminId`, and vice-versa (enforced in the login route handlers).
 *
 * @see artifacts/api-server/src/routes/auth.ts       — sets `userId`
 * @see artifacts/api-server/src/routes/admin-auth.ts — sets `adminId`
 * @see artifacts/api-server/src/middleware/auth.ts   — reads both fields
 */

import "express-session";

declare module "express-session" {
  interface SessionData {
    /** ID of the authenticated portal user (`users.id`). Undefined when not logged in. */
    userId?: number;
    /** ID of the authenticated admin operator (`admins.id`). Undefined when not logged in. */
    adminId?: number;
  }
}
