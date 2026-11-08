/**
 * @fileoverview Centralized record-ownership assertions.
 *
 * Every route that resolves a caller-supplied loan, applicant, or document id
 * MUST run one of these assertions before touching the record. Admin sessions
 * bypass ownership; portal users must own the parent loan. Each helper writes
 * the error response itself (401 no session, 403 foreign record, 404 missing)
 * and returns `false` when access is denied.
 */

import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, loansTable, applicantsTable, documentsTable } from "@workspace/db";

/** Admins may access any loan; portal users only loans they own. */
export async function assertLoanAccess(
  req: Request,
  res: Response,
  loanId: number,
): Promise<boolean> {
  if (!req.session.userId && !req.session.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (req.session.adminId) return true;

  const [loan] = await db
    .select({ id: loansTable.id, userId: loansTable.userId })
    .from(loansTable)
    .where(eq(loansTable.id, loanId));

  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return false;
  }
  if (loan.userId !== req.session.userId) {
    res.status(403).json({ error: "You do not have access to this loan" });
    return false;
  }
  return true;
}

/** Resolves an applicant to its loan and runs assertLoanAccess on it. */
export async function assertApplicantAccess(
  req: Request,
  res: Response,
  applicantId: number,
): Promise<boolean> {
  if (!req.session.userId && !req.session.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (req.session.adminId) return true;

  const [applicant] = await db
    .select({ loanId: applicantsTable.loanId })
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId));

  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return false;
  }
  return assertLoanAccess(req, res, applicant.loanId);
}

/** Resolves a document to its applicant and runs assertApplicantAccess. */
export async function assertDocumentAccess(
  req: Request,
  res: Response,
  docId: number,
): Promise<boolean> {
  if (!req.session.userId && !req.session.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (req.session.adminId) return true;

  const [doc] = await db
    .select({ applicantId: documentsTable.applicantId })
    .from(documentsTable)
    .where(eq(documentsTable.id, docId));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return false;
  }
  return assertApplicantAccess(req, res, doc.applicantId);
}
