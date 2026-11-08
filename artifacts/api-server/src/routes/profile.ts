/**
 * @fileoverview User profile and detail-sheet routes for the DhanSync API server.
 *
 * The "detail sheet" is a structured JSONB document (stored in `user_detail_sheets`)
 * that captures comprehensive applicant information required for loan processing:
 * individual details, co-applicant details, company information, personal/trade
 * references, and existing loan obligations.
 *
 * On first access, if no sheet has been saved yet, the GET endpoint performs a
 * best-effort pre-fill by sourcing data from the user's most recent loan
 * application and associated applicant records, falling back to registration data.
 *
 * Routes are mounted directly on the root API router at:
 *   GET /api/profile/detail-sheet
 *   PUT /api/profile/detail-sheet
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  loansTable,
  applicantsTable,
  userDetailSheetsTable,
} from "@workspace/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { z } from "zod/v4";
import { requireUser } from "../middleware/auth";

const router = Router();

/* ─── Validation Schemas ──────────────────────────────────────────────────── */

/** Represents a single row in the user's existing loan obligation table. */
const loanEntrySchema = z.object({
  bankName:       z.string().optional(),
  loanAmount:     z.string().optional(),
  loanType:       z.string().optional(),
  startDate:      z.string().optional(),
  endDate:        z.string().optional(),
  currentBalance: z.string().optional(),
});

/** Individual / co-applicant personal details section. */
const personSchema = z.object({
  name:             z.string().optional(),
  mobile:           z.string().optional(),
  motherName:       z.string().optional(),
  fatherName:       z.string().optional(),
  spouseName:       z.string().optional(),
  qualification:    z.string().optional(),
  dob:              z.string().optional(),
  pan:              z.string().optional(),
  aadhar:           z.string().optional(),
  currentAddress:   z.string().optional(),
  addressProof:     z.string().optional(),
  residenceStatus:  z.string().optional(),
  residenceSince:   z.string().optional(),
  email:            z.string().optional(),
});

/** Company details section (applicant or co-applicant entity). */
const companySchema = z.object({
  name:              z.string().optional(),
  incorporationDate: z.string().optional(),
  officeAddress:     z.string().optional(),
  officeStatus:      z.string().optional(),
  addressProof:      z.string().optional(),
  gstNumber:         z.string().optional(),
  pan:               z.string().optional(),
  natureOfBusiness:  z.string().optional(),
});

/** A single personal reference contact. */
const refPersonSchema = z.object({
  name:    z.string().optional(),
  address: z.string().optional(),
  mobile:  z.string().optional(),
});

/** A single trade reference (business contact / supplier). */
const refTradeSchema = z.object({
  companyName:   z.string().optional(),
  contactPerson: z.string().optional(),
  address:       z.string().optional(),
  mobile:        z.string().optional(),
});

/**
 * Top-level schema for the entire detail sheet document.
 * All sections are optional so partial saves work without data loss.
 */
const detailSheetSchema = z.object({
  individual:    personSchema.optional(),
  coApplicant:   personSchema.optional(),
  company:       companySchema.optional(),
  coCompany:     companySchema.optional(),
  personalRef1:  refPersonSchema.optional(),
  personalRef2:  refPersonSchema.optional(),
  tradeRef1:     refTradeSchema.optional(),
  tradeRef2:     refTradeSchema.optional(),
  existingLoans: z.array(loanEntrySchema).optional(),
});

/* ─── Routes ──────────────────────────────────────────────────────────────── */

/**
 * @description Returns the current user's detail sheet.
 *
 *   Pre-fill strategy (when no saved sheet exists):
 *   1. Find the user's most recent loan application (`loansTable`, `userId` match).
 *   2. Fallback: find any loan where the user appears as a primary/co-applicant
 *      by matching mobile or PAN from the `applicantsTable`.
 *   3. Fallback: use the user's registration data alone.
 *
 *   The response always includes a `prefilled` flag so the frontend can show
 *   a "data pre-filled from your application — please review" banner.
 *
 * @route   GET /api/profile/detail-sheet
 * @access  Protected — requires user session.
 * @returns {200} `{ data, updatedAt, prefilled, prefillSource? }`
 * @throws  {401} Not authenticated.
 */
router.get("/profile/detail-sheet", requireUser, async (req, res) => {
  const userId = req.session.userId!;

  // ── Step 1: Return saved sheet if one exists ─────────────────────────────
  const [sheet] = await db
    .select()
    .from(userDetailSheetsTable)
    .where(eq(userDetailSheetsTable.userId, userId))
    .limit(1);

  if (sheet) {
    res.json({ data: sheet.data, updatedAt: sheet.updatedAt, prefilled: false });
    return;
  }

  // ── Step 2: No saved sheet — attempt pre-fill from application data ──────
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  // Prefer a loan directly owned by this user (most reliable source)
  const userLoans = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.userId, userId))
    .orderBy(desc(loansTable.createdAt))
    .limit(1);

  let loan = userLoans[0] ?? null;
  let applicants: (typeof applicantsTable.$inferSelect)[] = [];

  if (loan) {
    applicants = await db
      .select()
      .from(applicantsTable)
      .where(eq(applicantsTable.loanId, loan.id));
  } else if (user) {
    // Fallback: match any loan where this user appears as an applicant by mobile or PAN
    const matchedApplicant = await db
      .select({ loanId: applicantsTable.loanId })
      .from(applicantsTable)
      .where(
        or(
          eq(applicantsTable.mobile, user.mobile),
          eq(applicantsTable.pan, user.pan)
        )
      )
      .orderBy(desc(applicantsTable.createdAt))
      .limit(1);

    if (matchedApplicant.length > 0) {
      const [matchedLoan] = await db
        .select()
        .from(loansTable)
        .where(eq(loansTable.id, matchedApplicant[0].loanId))
        .limit(1);
      loan = matchedLoan ?? null;

      if (loan) {
        applicants = await db
          .select()
          .from(applicantsTable)
          .where(eq(applicantsTable.loanId, loan.id));
      }
    }
  }

  // ── Step 3: Build pre-fill object from resolved sources ──────────────────
  const primary = applicants.find((a) => a.applicantType === "primary");
  const coApp   = applicants.find((a) => a.applicantType === "co-applicant");

  const prefillData: Record<string, unknown> = {};

  // Individual section: primary applicant → fallback to user registration record
  if (primary) {
    prefillData.individual = {
      name:           `${primary.firstName} ${primary.lastName}`.trim(),
      mobile:         primary.mobile        || user?.mobile  || "",
      email:          primary.email         || "",
      pan:            primary.pan           || user?.pan     || "",
      dob:            primary.dateOfBirth   || "",
      currentAddress: primary.address       || user?.address || "",
    };
  } else if (user) {
    prefillData.individual = {
      name:           `${user.firstName} ${user.lastName}`.trim(),
      mobile:         user.mobile,
      pan:            user.pan,
      currentAddress: user.address || "",
    };
  }

  // Co-applicant section (if present on the loan)
  if (coApp) {
    prefillData.coApplicant = {
      name:           `${coApp.firstName} ${coApp.lastName}`.trim(),
      mobile:         coApp.mobile      || "",
      email:          coApp.email       || "",
      pan:            coApp.pan         || "",
      dob:            coApp.dateOfBirth || "",
      currentAddress: coApp.address     || "",
    };
  }

  // Company section: sourced from loan record fields
  if (loan?.companyName) {
    prefillData.company = {
      name:              loan.companyName,
      natureOfBusiness:  loan.employmentType || "",
      officeAddress:     loan.propertyAddress || "",
    };
  }

  const hasPrefillData = Object.keys(prefillData).length > 0;

  res.json({
    data:         hasPrefillData ? prefillData : null,
    updatedAt:    null,
    prefilled:    hasPrefillData,
    prefillSource: loan
      ? `Loan application #${loan.id} (${loan.loanType?.toUpperCase()} loan)`
      : "registration data",
  });
});

/**
 * @description Saves (upserts) the current user's detail sheet.
 *   Creates a new record on first save; updates the existing one on subsequent saves.
 *
 * @route   PUT /api/profile/detail-sheet
 * @access  Protected — requires user session.
 * @param   {object} body - Partial or complete `detailSheetSchema` payload.
 * @returns {200} `{ ok: true, message: "Detail sheet saved" }`
 * @throws  {400} Validation error.
 * @throws  {401} Not authenticated.
 */
router.put("/profile/detail-sheet", requireUser, async (req, res) => {
  const userId = req.session.userId!;

  const parsed = detailSheetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const existing = await db
    .select({ id: userDetailSheetsTable.id })
    .from(userDetailSheetsTable)
    .where(eq(userDetailSheetsTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing record
    await db
      .update(userDetailSheetsTable)
      .set({ data: parsed.data as never, updatedAt: new Date() })
      .where(eq(userDetailSheetsTable.userId, userId));
  } else {
    // First save — insert new record
    await db
      .insert(userDetailSheetsTable)
      .values({ userId, data: parsed.data as never });
  }

  res.json({ ok: true, message: "Detail sheet saved" });
});

export default router;
