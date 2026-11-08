/**
 * @fileoverview Admin user management routes for the DhanSync API server.
 *
 * Provides CRUD operations on portal user records and the ability to download
 * a user's detail sheet as a formatted Excel workbook.
 *
 * All routes require an active admin session (`requireAdmin` middleware).
 * Routes are mounted directly on the root API router at `/api/admin/users/*`.
 *
 * Excel generation uses the `xlsx` (SheetJS) library and produces a two-tab
 * workbook matching the "SRM Associates" detail sheet template:
 *   Tab 1: "Detail sheet" — individual, co-applicant, company, and reference data
 *   Tab 2: "Loan sheet"   — existing loan obligations table
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, adminsTable, loansTable, userDetailSheetsTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { z } from "zod/v4";
import ExcelJS from "exceljs";
import { requireAdmin } from "../middleware/auth";
import { BCRYPT_ROUNDS } from "../config/constants";

const router = Router();

/* ─── Routes ──────────────────────────────────────────────────────────────── */

const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"),
  address: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const createAdminSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: string }).code === "23505";
}

/**
 * @description Lists administrator accounts without password hashes.
 * @route GET /api/admin/admins
 * @access Admin only.
 */
router.get("/admin/admins", requireAdmin, async (_req, res) => {
  const admins = await db
    .select({
      id: adminsTable.id,
      name: adminsTable.name,
      email: adminsTable.email,
      createdAt: adminsTable.createdAt,
    })
    .from(adminsTable)
    .orderBy(sql`${adminsTable.createdAt} DESC`);

  res.json(admins);
});

/**
 * @description Creates a customer account from the admin portal.
 * @route POST /api/admin/users
 * @access Admin only.
 */
router.post("/admin/users", requireAdmin, async (req, res) => {
  const parsed = createCustomerSchema.safeParse({
    ...req.body,
    pan: typeof req.body?.pan === "string" ? req.body.pan.toUpperCase() : req.body?.pan,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { firstName, lastName, mobile, pan, address, password } = parsed.data;
  const [existingMobile, existingPan] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.mobile, mobile)).limit(1),
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.pan, pan)).limit(1),
  ]);

  if (existingMobile.length > 0) {
    res.status(409).json({ error: "Mobile number already registered" });
    return;
  }
  if (existingPan.length > 0) {
    res.status(409).json({ error: "PAN already registered" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [created] = await db
      .insert(usersTable)
      .values({ firstName, lastName, mobile, pan, address: address || undefined, passwordHash })
      .returning({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        mobile: usersTable.mobile,
        pan: usersTable.pan,
        address: usersTable.address,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json({
      user: { ...created, pan: `XXXXX${created.pan.slice(5)}` },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Mobile number or PAN already registered" });
      return;
    }
    throw error;
  }
});

/**
 * @description Creates an administrator account from the admin portal.
 * @route POST /api/admin/admins
 * @access Admin only.
 */
router.post("/admin/admins", requireAdmin, async (req, res) => {
  const parsed = createAdminSchema.safeParse({
    ...req.body,
    email: typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : req.body?.email,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { name, email, password } = parsed.data;
  const [existing] = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Administrator email already registered" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [created] = await db
      .insert(adminsTable)
      .values({ name, email, passwordHash })
      .returning({
        id: adminsTable.id,
        name: adminsTable.name,
        email: adminsTable.email,
        createdAt: adminsTable.createdAt,
      });

    res.status(201).json({ admin: created });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Administrator email already registered" });
      return;
    }
    throw error;
  }
});

/**
 * @description Lists all portal users with their loan application count.
 *   Uses a LEFT JOIN + GROUP BY so users with zero loans are still returned.
 *   Results are sorted by registration date descending (newest first).
 *
 * @route   GET /api/admin/users
 * @access  Admin only.
 * @returns {200} Array of user records including `loanCount`.
 * @throws  {401} Not authenticated as admin.
 */
router.get("/admin/users", requireAdmin, async (req, res) => {
  const users = await db
    .select({
      id:        usersTable.id,
      firstName: usersTable.firstName,
      lastName:  usersTable.lastName,
      mobile:    usersTable.mobile,
      pan:       usersTable.pan,
      address:   usersTable.address,
      isActive:  usersTable.isActive,
      createdAt: usersTable.createdAt,
      loanCount: count(loansTable.id),
    })
    .from(usersTable)
    .leftJoin(loansTable, eq(loansTable.userId, usersTable.id))
    .groupBy(usersTable.id)
    .orderBy(sql`${usersTable.createdAt} DESC`);

  res.json(users);
});

/**
 * @description Returns full details for a single user.
 *   The `passwordHash` field is stripped before the response is sent.
 *
 * @route   GET /api/admin/users/:id
 * @access  Admin only.
 * @param   {string} params.id - User ID (integer).
 * @returns {200} User record (without `passwordHash`).
 * @throws  {400} Invalid (non-numeric) user ID.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.get("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Omit password hash from the API response — never send credentials to clients
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

/**
 * Zod schema for the `PATCH /admin/users/:id` partial update endpoint.
 * All fields are optional; at least one must be provided (enforced at runtime).
 */
const editUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  mobile:    z.string().regex(/^[6-9]\d{9}$/).optional(),
  pan:       z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  address:   z.string().optional(),
  isActive:  z.boolean().optional(),
});

/**
 * @description Partially updates a user's profile fields.
 *   Only the supplied fields are updated; omitted fields are left unchanged.
 *   PAN is normalised to uppercase before storing.
 *
 * @route   PATCH /api/admin/users/:id
 * @access  Admin only.
 * @param   {string}  params.id        - User ID.
 * @param   {object}  body             - Partial user fields to update.
 * @returns {200} Updated user record (without `passwordHash`).
 * @throws  {400} Invalid ID or empty update payload.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = editUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  // Build partial update object — only include fields that were actually provided
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.firstName !== undefined) updates.firstName = parsed.data.firstName;
  if (parsed.data.lastName  !== undefined) updates.lastName  = parsed.data.lastName;
  if (parsed.data.mobile    !== undefined) updates.mobile    = parsed.data.mobile;
  if (parsed.data.pan       !== undefined) updates.pan       = parsed.data.pan.toUpperCase();
  if (parsed.data.address   !== undefined) updates.address   = parsed.data.address;
  if (parsed.data.isActive  !== undefined) updates.isActive  = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { passwordHash, ...safe } = updated;
  res.json(safe);
});

/**
 * @description Hard-deletes a user account.
 *   Note: associated loans and uploads are NOT cascade-deleted at the DB level;
 *   consider soft-deletion (`isActive: false`) for auditable workflows.
 *
 * @route   DELETE /api/admin/users/:id
 * @access  Admin only.
 * @param   {string} params.id - User ID.
 * @returns {200} `{ ok: true, message: "User deleted" }`
 * @throws  {400} Invalid user ID.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [deleted] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ ok: true, message: "User deleted" });
});

/**
 * @description Resets a user's password to a new bcrypt-hashed value.
 *   Should be used alongside an out-of-band notification to the user (e.g. SMS).
 *
 * @route   POST /api/admin/users/:id/reset-password
 * @access  Admin only.
 * @param   {string} params.id          - User ID.
 * @param   {string} body.newPassword   - New password (minimum 8 characters).
 * @returns {200} `{ ok: true, message: "Password updated" }`
 * @throws  {400} Invalid ID or password too short.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.post("/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = z
    .object({ newPassword: z.string().min(8) })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);

  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ ok: true, message: "Password updated" });
});

/**
 * @description Returns a user's saved detail sheet (JSON) for admin review.
 *
 * @route   GET /api/admin/users/:id/detail-sheet
 * @access  Admin only.
 * @param   {string} params.id - User ID.
 * @returns {200} `{ user, data, updatedAt }` — `data` is null if no sheet saved yet.
 * @throws  {400} Invalid user ID.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.get("/admin/users/:id/detail-sheet", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db
    .select({
      id:        usersTable.id,
      firstName: usersTable.firstName,
      lastName:  usersTable.lastName,
      mobile:    usersTable.mobile,
      pan:       usersTable.pan,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [sheet] = await db
    .select()
    .from(userDetailSheetsTable)
    .where(eq(userDetailSheetsTable.userId, id))
    .limit(1);

  res.json({ user, data: sheet?.data ?? null, updatedAt: sheet?.updatedAt ?? null });
});

/**
 * @description Generates and streams a formatted Excel workbook (.xlsx) for a
 *   user's detail sheet, following the "SRM Associates" loan processing template.
 *
 *   Workbook structure:
 *     - Sheet 1 "Detail sheet": individual, co-applicant, company, references
 *     - Sheet 2 "Loan sheet": existing loan obligations table
 *
 *   If no detail sheet has been saved, the workbook is generated with empty cells
 *   so the template structure is always present.
 *
 * @route   GET /api/admin/users/:id/detail-sheet/download
 * @access  Admin only.
 * @param   {string} params.id - User ID.
 * @returns {200} Binary `.xlsx` file download.
 * @throws  {400} Invalid user ID.
 * @throws  {401} Not authenticated as admin.
 * @throws  {404} User not found.
 */
router.get("/admin/users/:id/detail-sheet/download", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [sheet] = await db
    .select()
    .from(userDetailSheetsTable)
    .where(eq(userDetailSheetsTable.userId, id))
    .limit(1);

  // Shorthand alias — all field accesses below use this typed object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = sheet?.data ?? {};

  const wb = new ExcelJS.Workbook();

  // ── Sheet 1: Detail Sheet ────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Detail sheet");
  ws1.columns = [
    { width: 22 }, { width: 30 }, { width: 2 }, { width: 30 }, { width: 30 },
  ];

  const detailRows: unknown[][] = [
    ["SRM ASSOCIATES", "", "", "DATE:", new Date().toLocaleDateString("en-IN")],
    ["Detail Sheet - Self Employed", "", "", "Source By:", ""],
    [],
    ["Individual Details", "APPLICANT", "", "CO-APPLICANT", ""],
    ["Name",              d.individual?.name           ?? "", "", d.coApplicant?.name           ?? "", ""],
    ["Mobile No.",        d.individual?.mobile         ?? "", "", d.coApplicant?.mobile         ?? "", ""],
    ["Mother's Name",     d.individual?.motherName     ?? "", "", d.coApplicant?.motherName     ?? "", ""],
    ["Father's Name",     d.individual?.fatherName     ?? "", "", d.coApplicant?.fatherName     ?? "", ""],
    ["Spouse Name",       d.individual?.spouseName     ?? "", "", d.coApplicant?.spouseName     ?? "", ""],
    ["Qualification",     d.individual?.qualification  ?? "", "", d.coApplicant?.qualification  ?? "", ""],
    ["DOB",               d.individual?.dob            ?? "", "", d.coApplicant?.dob            ?? "", ""],
    ["PAN No.",           d.individual?.pan            ?? user.pan ?? "", "", d.coApplicant?.pan ?? "", ""],
    ["Aadhar No.",        d.individual?.aadhar         ?? "", "", d.coApplicant?.aadhar         ?? "", ""],
    ["Current Address",   d.individual?.currentAddress ?? user.address ?? "", "", d.coApplicant?.currentAddress ?? "", ""],
    ["Address Proof",     d.individual?.addressProof   ?? "", "", d.coApplicant?.addressProof   ?? "", ""],
    ["Residence Status",  d.individual?.residenceStatus ?? "", "", d.coApplicant?.residenceStatus ?? "", ""],
    ["Residence Since",   d.individual?.residenceSince ?? "", "", d.coApplicant?.residenceSince ?? "", ""],
    ["Email",             d.individual?.email          ?? "", "", d.coApplicant?.email          ?? "", ""],
    [],
    ["Company Details", "APPLICANT", "", "CO-APPLICANT", ""],
    ["Company Name",          d.company?.name              ?? "", "", d.coCompany?.name              ?? "", ""],
    ["Date of Incorporation", d.company?.incorporationDate ?? "", "", d.coCompany?.incorporationDate ?? "", ""],
    ["Office Address",        d.company?.officeAddress     ?? "", "", d.coCompany?.officeAddress     ?? "", ""],
    ["Office Status",         d.company?.officeStatus      ?? "", "", d.coCompany?.officeStatus      ?? "", ""],
    ["Address Proof",         d.company?.addressProof      ?? "", "", d.coCompany?.addressProof      ?? "", ""],
    ["GST Registration",      d.company?.gstNumber         ?? "", "", d.coCompany?.gstNumber         ?? "", ""],
    ["PAN No.",               d.company?.pan               ?? "", "", d.coCompany?.pan               ?? "", ""],
    ["Nature of Business",    d.company?.natureOfBusiness  ?? "", "", d.coCompany?.natureOfBusiness  ?? "", ""],
    [],
    ["Personal References", "Reference 1", "", "Reference 2", ""],
    ["Name",       d.personalRef1?.name    ?? "", "", d.personalRef2?.name    ?? "", ""],
    ["Address",    d.personalRef1?.address ?? "", "", d.personalRef2?.address ?? "", ""],
    ["Mobile No.", d.personalRef1?.mobile  ?? "", "", d.personalRef2?.mobile  ?? "", ""],
    [],
    ["Trade References", "Reference 1", "", "Reference 2", ""],
    ["Company Name",   d.tradeRef1?.companyName   ?? "", "", d.tradeRef2?.companyName   ?? "", ""],
    ["Contact Person", d.tradeRef1?.contactPerson ?? "", "", d.tradeRef2?.contactPerson ?? "", ""],
    ["Address",        d.tradeRef1?.address       ?? "", "", d.tradeRef2?.address       ?? "", ""],
    ["Mobile No.",     d.tradeRef1?.mobile        ?? "", "", d.tradeRef2?.mobile        ?? "", ""],
  ];

  for (const row of detailRows) {
    ws1.addRow(row as ExcelJS.CellValue[]);
  }

  // ── Sheet 2: Loan Obligations ────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Loan sheet");
  ws2.columns = [
    { width: 22 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 16 },
  ];

  const loanRows: unknown[][] = [
    ["BANK NAME", "LOAN AMOUNT", "TYPES OF LOAN", "START DATE", "ENDING DATE", "CURRENT BALANCE"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((d.existingLoans ?? []) as any[]).map((l: any) => [
      l.bankName       ?? "",
      l.loanAmount     ?? "",
      l.loanType       ?? "",
      l.startDate      ?? "",
      l.endDate        ?? "",
      l.currentBalance ?? "",
    ]),
  ];

  for (const row of loanRows) {
    ws2.addRow(row as ExcelJS.CellValue[]);
  }

  const buf = await wb.xlsx.writeBuffer();

  // Sanitise filename: replace whitespace with underscores
  const filename = `detail_sheet_${user.firstName}_${user.lastName}_${user.mobile}.xlsx`
    .replace(/\s+/g, "_");

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.send(buf);
});

export default router;
