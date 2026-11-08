/**
 * @fileoverview User authentication routes for the DhanSync API server.
 *
 * Handles portal user registration, login, logout, and session introspection.
 * All routes are mounted at `/api/auth/*` via `routes/index.ts`.
 *
 * Security model:
 *   - Passwords are hashed with bcrypt (cost factor `BCRYPT_ROUNDS`).
 *   - Sessions are stored in PostgreSQL (`user_sessions` table).
 *   - PAN numbers are masked before being returned to the client.
 *   - Login errors intentionally use a generic message to prevent user enumeration.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { BCRYPT_ROUNDS } from "../config/constants";

const router = Router();

/* ─── Validation Schemas ──────────────────────────────────────────────────── */

/**
 * Zod schema for `POST /register`.
 * Enforces Indian mobile number format (starts with 6–9, 10 digits) and
 * standard PAN format (`AAAAA9999A`).
 */
const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  /** Indian mobile: starts with 6–9, followed by 9 digits. */
  mobile:    z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  /** PAN format: 5 letters + 4 digits + 1 letter (all uppercase). */
  pan:       z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"),
  address:   z.string().optional(),
  password:  z.string().min(8),
});

/**
 * Zod schema for `POST /login`.
 * Mobile and password are validated loosely here; bcrypt compare is the real gate.
 */
const loginSchema = z.object({
  mobile:   z.string(),
  password: z.string(),
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * @description Masks the first 5 characters of a PAN with 'X' for privacy.
 *   Example: `ABCDE1234F` → `XXXXX1234F`.
 *
 * This masking is applied to every API response that includes a PAN so the
 * full PAN is never transmitted to the browser (it remains only in the DB).
 *
 * @param {string} pan - A valid 10-character PAN string (uppercase).
 * @returns {string} Masked PAN with the first 5 letters replaced by 'X'.
 */
function maskPan(pan: string): string {
  // Replace each of the first 5 characters with 'X'; keep the numeric+alpha suffix
  return pan.slice(0, 5).replace(/./g, "X") + pan.slice(5);
}

/* ─── Routes ──────────────────────────────────────────────────────────────── */

/**
 * @description Registers a new portal user.
 *   Checks uniqueness of mobile and PAN before inserting.
 *   On success, creates a session and returns the user profile (PAN masked).
 *
 * @route   POST /api/auth/register
 * @access  Public — no authentication required.
 * @param   {string} body.firstName - User's first name.
 * @param   {string} body.lastName  - User's last name.
 * @param   {string} body.mobile    - Indian mobile number (10 digits, starts 6–9).
 * @param   {string} body.pan       - PAN card number (format: `AAAAA9999A`).
 * @param   {string} [body.address] - Optional residential address.
 * @param   {string} body.password  - Password (minimum 8 characters).
 * @returns {201} `{ user }` — newly created user with masked PAN.
 * @throws  {400} Validation error — invalid mobile/PAN format or missing fields.
 * @throws  {409} Conflict — mobile or PAN already registered.
 * @throws  {500} Session save failure.
 */
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { firstName, lastName, mobile, pan, address, password } = parsed.data;

  // Uniqueness check: mobile
  const existingMobile = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.mobile, mobile))
    .limit(1);

  if (existingMobile.length > 0) {
    res.status(409).json({ error: "Mobile number already registered" });
    return;
  }

  // Uniqueness check: PAN (normalised to uppercase)
  const existingPan = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.pan, pan.toUpperCase()))
    .limit(1);

  if (existingPan.length > 0) {
    res.status(409).json({ error: "PAN already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(usersTable)
    .values({
      firstName,
      lastName,
      mobile,
      pan: pan.toUpperCase(),
      address,
      passwordHash,
    })
    .returning({
      id:        usersTable.id,
      firstName: usersTable.firstName,
      lastName:  usersTable.lastName,
      mobile:    usersTable.mobile,
      pan:       usersTable.pan,
      address:   usersTable.address,
      createdAt: usersTable.createdAt,
    });

  // Establish session — mutual exclusivity: clear any existing admin session
  req.session.userId  = user.id;
  req.session.adminId = undefined;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session save failed" });
      return;
    }
    res.status(201).json({ user: { ...user, pan: maskPan(user.pan) } });
  });
});

/**
 * @description Authenticates an existing portal user via mobile + password.
 *   Uses a constant-time bcrypt comparison to mitigate timing attacks.
 *   Generic error messages prevent user enumeration.
 *
 * @route   POST /api/auth/login
 * @access  Public — no authentication required.
 * @param   {string} body.mobile   - Registered mobile number.
 * @param   {string} body.password - Plain-text password (compared against bcrypt hash).
 * @returns {200} `{ user }` — authenticated user profile with masked PAN.
 * @throws  {400} Validation error.
 * @throws  {401} Invalid credentials or inactive account.
 * @throws  {500} Session save failure.
 */
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const { mobile, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.mobile, mobile))
    .limit(1);

  // Guard: user not found OR soft-deleted (isActive = false)
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid mobile number or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid mobile number or password" });
    return;
  }

  req.session.userId  = user.id;
  req.session.adminId = undefined;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session save failed" });
      return;
    }
    res.json({
      user: {
        id:        user.id,
        firstName: user.firstName,
        lastName:  user.lastName,
        mobile:    user.mobile,
        pan:       maskPan(user.pan),
        address:   user.address,
        createdAt: user.createdAt,
      },
    });
  });
});

/**
 * @description Destroys the current session and clears the session cookie.
 *   Safe to call even if the user is not logged in (idempotent).
 *
 * @route   POST /api/auth/logout
 * @access  Public — no authentication required (safe to call unauthenticated).
 * @returns {200} `{ ok: true }`
 */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

/**
 * @description Returns the currently authenticated user's profile.
 *   Used by `AuthContext.refreshUser()` on page load to restore session state.
 *
 * @route   GET /api/auth/me
 * @access  Protected — requires a valid user session.
 * @returns {200} `{ user }` — current user profile with masked PAN.
 * @throws  {401} No session or user not found (e.g. deleted after login).
 */
router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id:        user.id,
      firstName: user.firstName,
      lastName:  user.lastName,
      mobile:    user.mobile,
      pan:       maskPan(user.pan),
      address:   user.address,
      createdAt: user.createdAt,
    },
  });
});

export default router;
