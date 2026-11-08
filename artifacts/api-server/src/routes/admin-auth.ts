/**
 * @fileoverview Admin authentication routes for the DhanSync API server.
 *
 * Handles login, logout, and session introspection for admin operators.
 * All routes are mounted at `/api/admin/auth/*` via `routes/index.ts`.
 *
 * Admin sessions are stored in the same PostgreSQL session table as user sessions
 * but use `req.session.adminId` instead of `req.session.userId`.  The login
 * handler explicitly clears `userId` to ensure mutual exclusivity — a single
 * browser cannot be simultaneously authenticated as both a user and an admin.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

/* ─── Validation Schema ───────────────────────────────────────────────────── */

/**
 * Zod schema for `POST /login`.
 * Email is normalised to lowercase before the DB lookup to support
 * case-insensitive matching without a case-insensitive index.
 */
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

/* ─── Routes ──────────────────────────────────────────────────────────────── */

/**
 * @description Authenticates an admin operator via email + password.
 *   Uses bcrypt for constant-time comparison.  Sets `adminId` in the session
 *   and clears `userId` to enforce mutual exclusivity with user sessions.
 *
 * @route   POST /api/admin/auth/login
 * @access  Public — no prior authentication required.
 * @param   {string} body.email    - Admin email address (case-insensitive).
 * @param   {string} body.password - Plain-text password.
 * @returns {200} `{ admin: { id, name, email } }` — authenticated admin profile.
 * @throws  {400} Validation error — missing or malformed email/password.
 * @throws  {401} Invalid credentials.
 * @throws  {500} Session save failure.
 */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const { email, password } = parsed.data;

  // Normalise to lowercase before lookup — admin emails are stored lowercase
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.toLowerCase()))
    .limit(1);

  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Set admin session; clear any co-existing user session (mutual exclusivity)
  req.session.adminId = admin.id;
  req.session.userId  = undefined;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session save failed" });
      return;
    }
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  });
});

/**
 * @description Destroys the admin session and clears the session cookie.
 *   Idempotent — safe to call even when not logged in.
 *
 * @route   POST /api/admin/auth/logout
 * @access  Public — no authentication required.
 * @returns {200} `{ ok: true }`
 */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

/**
 * @description Returns the currently authenticated admin's profile.
 *   Called by `AuthContext.refreshAdmin()` on page load to restore admin state.
 *
 * @route   GET /api/admin/auth/me
 * @access  Protected — requires a valid admin session.
 * @returns {200} `{ admin: { id, name, email } }`
 * @throws  {401} No admin session, or admin deleted after login.
 */
router.get("/me", async (req, res) => {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated as admin" });
    return;
  }

  const [admin] = await db
    .select({ id: adminsTable.id, name: adminsTable.name, email: adminsTable.email })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId))
    .limit(1);

  if (!admin) {
    res.status(401).json({ error: "Admin not found" });
    return;
  }

  res.json({ admin });
});

export default router;
