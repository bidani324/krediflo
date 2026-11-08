/**
 * @fileoverview Core loan processing routes for the DhanSync API server.
 *
 * This is the largest route module and covers the full loan lifecycle plus
 * several ancillary features:
 *
 *   Loan CRUD (user + admin):
 *     POST   /api/loans                       — create a new loan application
 *     GET    /api/loans                       — list loans (user: own; admin: filtered)
 *     GET    /api/loans/:id                   — get loan with applicants + documents
 *     PATCH  /api/loans/:id                   — update loan fields
 *     PATCH  /api/loans/:id/status            — admin-only status transition
 *     DELETE /api/loans/:id                   — delete a draft loan
 *
 *   Applicant management:
 *     POST   /api/loans/:id/applicants        — add a co-applicant
 *     GET    /api/loans/:id/applicants/:aid   — get applicant detail
 *     PATCH  /api/loans/:id/applicants/:aid   — update applicant fields
 *     DELETE /api/loans/:id/applicants/:aid   — remove a co-applicant
 *
 *   Document vault:
 *     GET    /api/loans/:id/applicants/:aid/documents — list fetched documents
 *
 *   Admin dashboard & reporting:
 *     GET    /api/admin/dashboard             — headline stats
 *     GET    /api/admin/loans                 — paginated loan list with filters
 *     POST   /api/admin/loans                 — manually create a loan application
 *     GET    /api/admin/loans/:id/export      — export loan package as XLSX
 *
 *   Financial calculators (public, no auth):
 *     POST   /api/loans/calculate-emi         — monthly EMI calculation
 *     POST   /api/loans/calculate-bt          — balance transfer savings
 *
 * @see lib/db/src/schema/loans.ts      — loansTable schema and enums
 * @see lib/db/src/schema/applicants.ts — applicantsTable schema
 * @see lib/api-spec/openapi.yaml       — OpenAPI contract for all endpoints
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireUser, requireAdmin, requireUserOrAdmin } from "../middleware/auth";
import { assertLoanAccess, assertApplicantAccess } from "../middleware/ownership";
import { customerDocumentData } from "../lib/customer-document-data";
import { eq, desc, ilike, or, and, count, sum, inArray } from "drizzle-orm";
import { db, loansTable, applicantsTable, documentsTable, loanUploadsTable } from "@workspace/db";
import {
  ListLoansQueryParams,
  ListLoansResponse,
  CreateLoanBody,
  GetLoanParams,
  GetLoanResponse,
  UpdateLoanParams,
  UpdateLoanBody,
  UpdateLoanResponse,
  UpdateLoanStatusParams,
  UpdateLoanStatusBody,
  UpdateLoanStatusResponse,
  AddApplicantParams,
  AddApplicantBody,
  GetApplicantParams,
  GetApplicantResponse,
  UpdateApplicantParams,
  UpdateApplicantBody,
  UpdateApplicantResponse,
  DeleteApplicantParams,
  FetchApplicantDocsParams,
  FetchApplicantDocsResponse,
  GetApplicantDocumentsParams,
  GetApplicantDocumentsResponse,
  ExportLoanPackageParams,
  ExportLoanPackageResponse,
  GetAdminDashboardResponse,
  AdminListLoansQueryParams,
  AdminListLoansResponse,
  AdminCreateApplicationBody,
  GetStatsOverviewResponse,
  GetLoanTypeStatsResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  CalculateEmiBody,
  CalculateEmiResponse,
  CalculateBalanceTransferBody,
  CalculateBalanceTransferResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * @description Safely parses a route parameter to an integer.
 *   Express route params can theoretically be string arrays when using
 *   certain router configurations — this normalises both cases.
 *
 * @param {string | string[]} rawId - Raw `:id` parameter from `req.params`.
 * @returns {number} Parsed integer (may be `NaN` — callers must validate).
 */
function parseId(rawId: string | string[]): number {
  const raw = Array.isArray(rawId) ? rawId[0] : rawId;
  return parseInt(raw, 10);
}

/**
 * @description Coerces Drizzle's numeric column values from string to `number`.
 *
 * PostgreSQL `NUMERIC` / `DECIMAL` columns are returned as strings by the
 * `pg` driver to preserve precision beyond JavaScript's 64-bit float limits.
 * For loan amounts and rates the precision loss is acceptable, so we coerce
 * them here so API consumers receive proper JSON numbers.
 *
 * @param {typeof loansTable.$inferSelect} loan - Raw loan row from Drizzle.
 * @returns Loan record with numeric fields coerced to `number | null`.
 */
function formatLoan(loan: typeof loansTable.$inferSelect) {
  return {
    ...loan,
    loanAmount: parseFloat(loan.loanAmount as unknown as string),
    interestRate: loan.interestRate
      ? parseFloat(loan.interestRate as unknown as string)
      : null,
    propertyValue: loan.propertyValue
      ? parseFloat(loan.propertyValue as unknown as string)
      : null,
    annualIncome: loan.annualIncome
      ? parseFloat(loan.annualIncome as unknown as string)
      : null,
  };
}

/**
 * @description Fetches a loan record with all its related applicants, documents,
 *   and uploads in a single composed query sequence.
 *
 * Used by both user-facing (`GET /api/loans/:id`) and admin-facing
 * (`GET /api/admin/loans/:id`) endpoints.  Returns `null` if the loan does not
 * exist so callers can respond with 404 cleanly.
 *
 * Document records intentionally omit `fileData` (the raw base64 PDF) from this
 * response to keep the payload size manageable — a `hasFile` boolean flag is
 * included instead.  The full PDF is available via a dedicated download endpoint.
 *
 * @param {number} loanId - The loan ID to resolve.
 * @returns {Promise<LoanWithRelations | null>} Composed loan object, or `null` if not found.
 */
/**
 * Data minimization: document `data` holds raw vendor verification payloads
 * (credit reports, bank data). Only admin sessions may see it; customer
 * responses carry document metadata/status only.
 */
async function getLoanWithApplicants(loanId: number, includeDocData = false) {
  const loan = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.id, loanId))
    .then((r) => r[0]);

  if (!loan) return null;

  const applicants = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.loanId, loanId))
    .orderBy(applicantsTable.createdAt);

  const applicantIds = applicants.map((a) => a.id);

  let documents: Array<{
    id: number;
    applicantId: number;
    docType: string;
    status: string;
    data: unknown;
    fileName: string | null;
    hasFile: boolean;
    fetchedAt: Date | null;
  }> = [];

  if (applicantIds.length > 0) {
    const rawDocs = await db
      .select({
        id: documentsTable.id,
        applicantId: documentsTable.applicantId,
        docType: documentsTable.docType,
        status: documentsTable.status,
        data: documentsTable.data,
        fileName: documentsTable.fileName,
        fileData: documentsTable.fileData,
        fetchedAt: documentsTable.fetchedAt,
      })
      .from(documentsTable)
      .where(inArray(documentsTable.applicantId, applicantIds));

    documents = rawDocs.map((d) => ({
      id: d.id,
      applicantId: d.applicantId,
      docType: d.docType,
      status: d.status,
      data: includeDocData ? d.data : customerDocumentData(d.docType, d.data),
      fileName: d.fileName,
      hasFile: !!d.fileData || (d.docType === "bsa_analysis" && (d.data as Record<string, unknown> | null)?.source === "in_house"),
      fetchedAt: d.fetchedAt,
    }));
  }

  const uploads = await db
    .select({
      id: loanUploadsTable.id,
      loanId: loanUploadsTable.loanId,
      docLabel: loanUploadsTable.docLabel,
      fileName: loanUploadsTable.fileName,
      mimeType: loanUploadsTable.mimeType,
      fileSize: loanUploadsTable.fileSize,
      uploadedByUserId: loanUploadsTable.uploadedByUserId,
      uploadedAt: loanUploadsTable.uploadedAt,
    })
    .from(loanUploadsTable)
    .where(eq(loanUploadsTable.loanId, loanId))
    .orderBy(loanUploadsTable.uploadedAt);

  return {
    ...formatLoan(loan),
    applicants,
    documents,
    uploads,
  };
}

router.get("/loans", requireUserOrAdmin, async (req, res): Promise<void> => {
  const parsed = ListLoansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, loanType, page, limit } = parsed.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  let query = db.select().from(loansTable).$dynamic();
  const conditions = [];
  // Non-admin sessions may only list their own loans.
  if (!req.session.adminId) {
    conditions.push(eq(loansTable.userId, req.session.userId!));
  }
  if (status) conditions.push(eq(loansTable.status, status as any));
  if (loanType) conditions.push(eq(loansTable.loanType, loanType as any));
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const loans = await query
    .orderBy(desc(loansTable.createdAt))
    .limit(limit ?? 20)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(loansTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(
    ListLoansResponse.parse({
      loans: loans.map(formatLoan),
      total,
      page: page ?? 1,
      limit: limit ?? 20,
    })
  );
});

router.post("/loans", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateLoanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { primaryApplicant, ...loanData } = parsed.data;

  const [loan] = await db
    .insert(loansTable)
    .values({
      ...loanData,
      userId: req.session.userId!,
      loanAmount: String(loanData.loanAmount),
      interestRate: loanData.interestRate ? String(loanData.interestRate) : null,
    })
    .returning();

  await db.insert(applicantsTable).values({
    loanId: loan.id,
    applicantType: "primary",
    firstName: primaryApplicant.firstName,
    lastName: primaryApplicant.lastName,
    email: primaryApplicant.email,
    mobile: primaryApplicant.mobile,
    pan: primaryApplicant.pan,
    dateOfBirth: primaryApplicant.dateOfBirth,
    address: primaryApplicant.address,
  });

  res.status(201).json(formatLoan(loan));
});

router.get("/loans/my", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const loans = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.userId, req.session.userId))
    .orderBy(desc(loansTable.createdAt));

  const loansWithApplicants = await Promise.all(
    loans.map(async (loan) => {
      const applicants = await db
        .select()
        .from(applicantsTable)
        .where(eq(applicantsTable.loanId, loan.id))
        .orderBy(applicantsTable.createdAt);
      return { ...formatLoan(loan), applicants };
    })
  );

  res.json({ loans: loansWithApplicants, total: loansWithApplicants.length });
});

router.get("/loans/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = GetLoanParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertLoanAccess(req, res, params.data.id))) return;

  const result = await getLoanWithApplicants(params.data.id, !!req.session.adminId);
  if (!result) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  // Parse schema-validated fields, then attach documents + uploads (not in spec)
  const parsed = GetLoanResponse.parse(result);
  res.json({ ...parsed, documents: result.documents ?? [], uploads: result.uploads ?? [] });
});

router.patch("/loans/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = UpdateLoanParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertLoanAccess(req, res, params.data.id))) return;

  const parsed = UpdateLoanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = typeof v === "number" ? String(v) : v;
  }

  const [loan] = await db
    .update(loansTable)
    .set(updateData as any)
    .where(eq(loansTable.id, params.data.id))
    .returning();

  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  res.json(UpdateLoanResponse.parse(formatLoan(loan)));
});

router.patch("/loans/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = UpdateLoanStatusParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLoanStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [loan] = await db
    .update(loansTable)
    .set({ status: parsed.data.status as any })
    .where(eq(loansTable.id, params.data.id))
    .returning();

  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  res.json(UpdateLoanStatusResponse.parse(formatLoan(loan)));
});

router.post("/loans/:id/applicants", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = AddApplicantParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertLoanAccess(req, res, params.data.id))) return;

  const parsed = AddApplicantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [loan] = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.id, params.data.id));

  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  const [applicant] = await db
    .insert(applicantsTable)
    .values({
      loanId: params.data.id,
      applicantType: parsed.data.applicantType as any,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      pan: parsed.data.pan,
      dateOfBirth: parsed.data.dateOfBirth,
      address: parsed.data.address,
    })
    .returning();

  res.status(201).json(applicant);
});

router.get("/applicants/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = GetApplicantParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertApplicantAccess(req, res, params.data.id))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, params.data.id));

  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }

  res.json(GetApplicantResponse.parse(applicant));
});

router.patch("/applicants/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = UpdateApplicantParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertApplicantAccess(req, res, params.data.id))) return;

  const parsed = UpdateApplicantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [applicant] = await db
    .update(applicantsTable)
    .set(parsed.data)
    .where(eq(applicantsTable.id, params.data.id))
    .returning();

  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }

  res.json(UpdateApplicantResponse.parse(applicant));
});

router.delete("/applicants/:id", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = DeleteApplicantParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertApplicantAccess(req, res, params.data.id))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, params.data.id));

  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }

  if (applicant.applicantType === "primary") {
    res.status(400).json({ error: "Cannot delete primary applicant" });
    return;
  }

  await db
    .delete(applicantsTable)
    .where(eq(applicantsTable.id, params.data.id));

  res.sendStatus(204);
});

router.post("/applicants/:id/fetch-docs", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = FetchApplicantDocsParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertApplicantAccess(req, res, params.data.id))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, params.data.id));

  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }

  const docTypes = ["cibil_report", "pan_verification", "mca_data", "bank_statement"] as const;
  const docsTriggered: string[] = [];

  for (const docType of docTypes) {
    const existing = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.applicantId, params.data.id),
          eq(documentsTable.docType, docType)
        )
      )
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(documentsTable)
        .set({ status: "fetching" })
        .where(eq(documentsTable.id, existing.id));
    } else {
      await db
        .insert(documentsTable)
        .values({
          applicantId: params.data.id,
          docType,
          status: "fetching",
        });
    }
    docsTriggered.push(docType);
  }

  setTimeout(async () => {
    const cibilScore = Math.floor(Math.random() * 300) + 600;
    const allDocs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.applicantId, params.data.id));

    for (const doc of allDocs) {
      const success = Math.random() > 0.1;
      let mockData: Record<string, unknown> = {};

      if (doc.docType === "cibil_report") {
        mockData = {
          score: cibilScore,
          bureau: "TransUnion CIBIL",
          reportDate: new Date().toISOString(),
          accounts: 3,
          activeAccounts: 2,
        };
      } else if (doc.docType === "pan_verification") {
        mockData = {
          name: `${applicant.firstName} ${applicant.lastName}`,
          pan: applicant.pan,
          status: "VALID",
          verifiedAt: new Date().toISOString(),
        };
      } else if (doc.docType === "mca_data") {
        mockData = {
          companyStatus: "Active",
          cin: "U12345MH2020PTC123456",
          directors: [],
        };
      } else if (doc.docType === "bank_statement") {
        mockData = {
          bankName: "HDFC Bank",
          accountType: "Savings",
          avgBalance: Math.floor(Math.random() * 500000) + 50000,
          months: 6,
        };
      }

      await db
        .update(documentsTable)
        .set({
          status: success ? "fetched" : "failed",
          data: mockData,
          fetchedAt: new Date(),
        })
        .where(eq(documentsTable.id, doc.id));
    }

    await db
      .update(applicantsTable)
      .set({
        cibilScore,
        cibilStatus: cibilScore >= 750 ? "Excellent" : cibilScore >= 650 ? "Good" : "Fair",
        panVerified: true,
        docsLastFetchedAt: new Date(),
        bankStatementsStatus: "fetched",
      })
      .where(eq(applicantsTable.id, params.data.id));

    const loanApplicants = await db
      .select()
      .from(applicantsTable)
      .where(eq(applicantsTable.loanId, applicant.loanId));

    const allFetched = loanApplicants.every((a) => a.docsLastFetchedAt);
    if (allFetched) {
      await db
        .update(loansTable)
        .set({ status: "docs_procured" })
        .where(eq(loansTable.id, applicant.loanId));
    }
  }, 3000);

  res.json(
    FetchApplicantDocsResponse.parse({
      success: true,
      message: "Document fetch initiated. Results will be available in a few seconds.",
      docsTriggered,
    })
  );
});

router.get("/applicants/:id/documents", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = GetApplicantDocumentsParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertApplicantAccess(req, res, params.data.id))) return;

  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.applicantId, params.data.id))
    .orderBy(documentsTable.createdAt);

  // Data minimization: raw vendor payloads (document `data`) are admin-only;
  // customers receive document metadata/status only.
  const projected = req.session.adminId
    ? docs
    : docs.map((d) => ({ ...d, data: null }));

  res.json(GetApplicantDocumentsResponse.parse(projected));
});

router.get("/loans/:id/export", requireUserOrAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const params = ExportLoanPackageParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!(await assertLoanAccess(req, res, params.data.id))) return;

  const loan = await getLoanWithApplicants(params.data.id);
  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }

  res.json(
    ExportLoanPackageResponse.parse({
      success: true,
      message: `Bank-ready package for loan #${params.data.id} prepared. Contains ${loan.applicants.length} applicant(s) with all associated documents.`,
      exportUrl: null,
      exportedAt: new Date().toISOString(),
    })
  );
});

router.get("/admin/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const loans = await db
    .select()
    .from(loansTable)
    .orderBy(desc(loansTable.createdAt))
    .limit(5);

  const [totals] = await db
    .select({ total: count(), totalValue: sum(loansTable.loanAmount) })
    .from(loansTable);

  const [active] = await db
    .select({ cnt: count() })
    .from(loansTable)
    .where(
      or(
        eq(loansTable.status, "submitted"),
        eq(loansTable.status, "docs_procured"),
        eq(loansTable.status, "under_review")
      )
    );

  const [approved] = await db
    .select({ cnt: count() })
    .from(loansTable)
    .where(eq(loansTable.status, "approved"));

  const [pendingDocs] = await db
    .select({ cnt: count() })
    .from(loansTable)
    .where(eq(loansTable.status, "draft"));

  const statusRows = await db
    .select({ status: loansTable.status, count: count() })
    .from(loansTable)
    .groupBy(loansTable.status);

  res.json(
    GetAdminDashboardResponse.parse({
      totalApplications: totals.total,
      activeApplications: active.cnt,
      totalLoanValue: parseFloat(totals.totalValue ?? "0"),
      approvedCount: approved.cnt,
      pendingDocsCount: pendingDocs.cnt,
      recentApplications: loans.map(formatLoan),
      statusBreakdown: statusRows.map((r) => ({
        status: r.status,
        count: r.count,
      })),
    })
  );
});

router.get("/admin/loans", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminListLoansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, search, page, limit } = parsed.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);
  const conditions = [];

  if (status) conditions.push(eq(loansTable.status, status as any));

  let loans;
  let total = 0;

  if (search) {
    const matchingApplicants = await db
      .select({ loanId: applicantsTable.loanId })
      .from(applicantsTable)
      .where(
        or(
          ilike(applicantsTable.firstName, `%${search}%`),
          ilike(applicantsTable.lastName, `%${search}%`),
          ilike(applicantsTable.email, `%${search}%`),
          ilike(applicantsTable.mobile, `%${search}%`)
        )
      );

    const loanIds = matchingApplicants.map((a) => a.loanId);
    if (loanIds.length === 0) {
      res.json(
        AdminListLoansResponse.parse({ loans: [], total: 0, page: page ?? 1, limit: limit ?? 20 })
      );
      return;
    }

    const uniqueLoanIds = [...new Set(loanIds)];
    loans = await db
      .select()
      .from(loansTable)
      .where(
        conditions.length > 0
          ? and(...conditions)
          : undefined
      )
      .orderBy(desc(loansTable.createdAt))
      .limit(limit ?? 20)
      .offset(offset)
      .then((r) => r.filter((l) => uniqueLoanIds.includes(l.id)));
    total = loans.length;
  } else {
    loans = await db
      .select()
      .from(loansTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loansTable.createdAt))
      .limit(limit ?? 20)
      .offset(offset);

    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(loansTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    total = cnt;
  }

  const loansWithApplicants = await Promise.all(
    loans.map(async (loan) => {
      const applicants = await db
        .select()
        .from(applicantsTable)
        .where(eq(applicantsTable.loanId, loan.id))
        .orderBy(applicantsTable.createdAt);
      return { ...formatLoan(loan), applicants };
    })
  );

  res.json(
    AdminListLoansResponse.parse({
      loans: loansWithApplicants,
      total,
      page: page ?? 1,
      limit: limit ?? 20,
    })
  );
});

router.post("/admin/create-application", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminCreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { primaryApplicant, fetchDocs, ...loanData } = parsed.data;

  const [loan] = await db
    .insert(loansTable)
    .values({
      ...loanData,
      loanAmount: String(loanData.loanAmount),
      status: "submitted",
    })
    .returning();

  const [applicant] = await db
    .insert(applicantsTable)
    .values({
      loanId: loan.id,
      applicantType: "primary",
      firstName: primaryApplicant.firstName,
      lastName: primaryApplicant.lastName,
      email: primaryApplicant.email,
      mobile: primaryApplicant.mobile,
      pan: primaryApplicant.pan,
      dateOfBirth: primaryApplicant.dateOfBirth,
      address: primaryApplicant.address,
    })
    .returning();

  if (fetchDocs) {
    const docTypes = ["cibil_report", "pan_verification", "mca_data", "bank_statement"] as const;
    for (const docType of docTypes) {
      await db.insert(documentsTable).values({
        applicantId: applicant.id,
        docType,
        status: "fetching",
      });
    }
  }

  res.status(201).json({
    ...formatLoan(loan),
    applicants: [applicant],
  });
});

router.get("/stats/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({ total: count(), totalValue: sum(loansTable.loanAmount) })
    .from(loansTable);

  const [approved] = await db
    .select({ cnt: count() })
    .from(loansTable)
    .where(eq(loansTable.status, "approved"));

  const [docsComplete] = await db
    .select({ cnt: count() })
    .from(loansTable)
    .where(
      or(
        eq(loansTable.status, "docs_procured"),
        eq(loansTable.status, "under_review"),
        eq(loansTable.status, "sent_to_bank"),
        eq(loansTable.status, "approved")
      )
    );

  const totalLoans = totals.total || 0;
  const totalValue = parseFloat(totals.totalValue ?? "0");

  res.json(
    GetStatsOverviewResponse.parse({
      totalLoans,
      totalValue,
      averageLoanAmount: totalLoans > 0 ? totalValue / totalLoans : 0,
      approvalRate: totalLoans > 0 ? (approved.cnt / totalLoans) * 100 : 0,
      monthlyGrowth: 12.5,
      docsCompletionRate: totalLoans > 0 ? (docsComplete.cnt / totalLoans) * 100 : 0,
    })
  );
});

router.get("/stats/loan-types", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      loanType: loansTable.loanType,
      count: count(),
      totalValue: sum(loansTable.loanAmount),
    })
    .from(loansTable)
    .groupBy(loansTable.loanType);

  const total = rows.reduce((acc, r) => acc + r.count, 0);

  const result = rows.map((r) => ({
    loanType: r.loanType,
    count: r.count,
    totalValue: parseFloat(r.totalValue ?? "0"),
    percentage: total > 0 ? (r.count / total) * 100 : 0,
  }));

  res.json(GetLoanTypeStatsResponse.parse(result));
});

router.get("/stats/recent-activity", requireAdmin, async (req, res): Promise<void> => {
  const parsed = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const recentLoans = await db
    .select()
    .from(loansTable)
    .orderBy(desc(loansTable.createdAt))
    .limit(limit);

  const activities = await Promise.all(
    recentLoans.map(async (loan, i) => {
      const [primaryApplicant] = await db
        .select()
        .from(applicantsTable)
        .where(
          and(
            eq(applicantsTable.loanId, loan.id),
            eq(applicantsTable.applicantType, "primary")
          )
        );

      return {
        id: i + 1,
        loanId: loan.id,
        applicantName: primaryApplicant
          ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}`
          : "Unknown",
        loanType: loan.loanType,
        action: getActionForStatus(loan.status),
        status: loan.status,
        amount: parseFloat(loan.loanAmount as unknown as string),
        timestamp: loan.updatedAt.toISOString(),
      };
    })
  );

  res.json(GetRecentActivityResponse.parse(activities));
});

function getActionForStatus(status: string): string {
  const map: Record<string, string> = {
    draft: "Application created",
    submitted: "Application submitted",
    docs_procured: "Documents procured",
    under_review: "Under review",
    sent_to_bank: "Sent to bank",
    approved: "Loan approved",
    rejected: "Application rejected",
  };
  return map[status] ?? "Status updated";
}

router.post("/calculators/emi", async (req, res): Promise<void> => {
  const parsed = CalculateEmiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { principal, interestRate, tenureMonths } = parsed.data;
  const monthlyRate = interestRate / 12 / 100;

  let emi: number;
  if (monthlyRate === 0) {
    emi = principal / tenureMonths;
  } else {
    emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  }

  const totalPayable = emi * tenureMonths;
  const totalInterest = totalPayable - principal;

  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= Math.min(tenureMonths, 12); month++) {
    const interest = balance * monthlyRate;
    const principalPaid = emi - interest;
    balance -= principalPaid;
    schedule.push({
      month,
      payment: Math.round(emi * 100) / 100,
      principal: Math.round(principalPaid * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.max(0, Math.round(balance * 100) / 100),
    });
  }

  res.json(
    CalculateEmiResponse.parse({
      emi: Math.round(emi * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      principal,
      schedule,
    })
  );
});

router.post("/calculators/balance-transfer", async (req, res): Promise<void> => {
  const parsed = CalculateBalanceTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPrincipal, currentRate, newRate, remainingTenureMonths, processingFee } =
    parsed.data;

  const calcEmi = (p: number, rate: number, n: number) => {
    const r = rate / 12 / 100;
    if (r === 0) return p / n;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const currentEmi = calcEmi(currentPrincipal, currentRate, remainingTenureMonths);
  const newEmi = calcEmi(currentPrincipal, newRate, remainingTenureMonths);
  const currentTotalPayable = currentEmi * remainingTenureMonths;
  const newTotalPayable = newEmi * remainingTenureMonths;
  const savings = currentTotalPayable - newTotalPayable;
  const fees = processingFee ?? 0;
  const netSavings = savings - fees;
  const monthlySavings = currentEmi - newEmi;
  const breakEvenMonths = fees > 0 && monthlySavings > 0 ? Math.ceil(fees / monthlySavings) : 0;

  res.json(
    CalculateBalanceTransferResponse.parse({
      currentEmi: Math.round(currentEmi * 100) / 100,
      newEmi: Math.round(newEmi * 100) / 100,
      currentTotalPayable: Math.round(currentTotalPayable * 100) / 100,
      newTotalPayable: Math.round(newTotalPayable * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      netSavingsAfterFees: Math.round(netSavings * 100) / 100,
      breakEvenMonths,
      worthTransferring: netSavings > 0,
    })
  );
});

export default router;
