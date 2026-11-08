/**
 * @fileoverview Additional document upload routes for the DhanSync API server.
 *
 * Manages physical file attachments at the loan level (separate from the
 * Surepass API-fetched documents stored in the `documents` table).
 *
 * All uploaded files are stored as base64 strings in the `loan_uploads.file_data`
 * TEXT column.  This approach trades storage efficiency for operational simplicity
 * — no external object storage dependency required.
 *
 * All routes are mounted directly on the root API router (no prefix) and resolve
 * to `/api/loans/:id/uploads/*`.
 *
 * Access control model:
 *   - A portal user may only upload to / delete from loans they own (`loan.userId === session.userId`).
 *   - An admin operator may read, upload, and delete from any loan.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { loanUploadsTable, loansTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { requireUserOrAdmin } from "../middleware/auth";
import { MAX_FILE_BYTES } from "../config/constants";

const router = Router();

/* ─── Validation Schema ───────────────────────────────────────────────────── */

/**
 * Zod schema for `POST /api/loans/:id/uploads` request body.
 * `fileData` must be a valid base64 string; `fileSize` is validated against
 * `MAX_FILE_BYTES` (10 MiB) to reject oversized uploads before they hit the DB.
 */
const uploadBodySchema = z.object({
  /** Human-readable category label (e.g. "Bank Statement", "IT Returns"). */
  docLabel: z.string().min(1).max(120),
  /** Original filename, including extension. */
  fileName: z.string().min(1).max(255),
  /** Base64-encoded file content. */
  fileData: z.string().min(1),
  /** MIME type string (e.g. `"application/pdf"`, `"image/jpeg"`). */
  mimeType: z.string().min(1).max(100),
  /**
   * Decoded file size in bytes.  Must not exceed `MAX_FILE_BYTES` (10 MiB).
   * The client calculates this from `file.size` before base64 encoding.
   */
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * @description Resolves loan ownership for access-control checks.
 *   Admins can access any loan.  Users can only access loans they own.
 *
 * @param {number}          loanId  - The loan ID to look up.
 * @param {number|undefined} userId  - Session user ID (undefined for admins).
 * @param {number|undefined} adminId - Session admin ID (undefined for users).
 * @returns {Promise<typeof loansTable.$inferSelect | null>}
 *   The loan record if access is granted, or `null` if not found / denied.
 */
async function resolveLoanAccess(
  loanId:  number,
  userId:  number | undefined,
  adminId: number | undefined,
): Promise<typeof loansTable.$inferSelect | null> {
  const [loan] = await db
    .select()
    .from(loansTable)
    .where(eq(loansTable.id, loanId))
    .limit(1);

  if (!loan) return null;
  // Admins bypass ownership check
  if (adminId) return loan;
  // Users must own the loan
  if (userId && loan.userId === userId) return loan;
  return null;
}

/* ─── Routes ──────────────────────────────────────────────────────────────── */

/**
 * @description Lists all uploads for a loan (metadata only — no `fileData`).
 *   Results are ordered by upload timestamp ascending.
 *
 * @route   GET /api/loans/:id/uploads
 * @access  Protected — user (own loan) or admin (any loan).
 * @param   {string} params.id - Loan ID.
 * @returns {200} `{ uploads: UploadMetadata[] }` — array without `fileData`.
 * @throws  {401} Not authenticated.
 * @throws  {404} Loan not found or access denied.
 */
router.get("/loans/:id/uploads", requireUserOrAdmin, async (req, res) => {
  const loanId = parseInt(req.params.id as string, 10);
  const loan   = await resolveLoanAccess(loanId, req.session.userId, req.session.adminId);
  if (!loan) {
    res.status(404).json({ error: "Loan not found or access denied" });
    return;
  }

  const uploads = await db
    .select({
      id:              loanUploadsTable.id,
      loanId:          loanUploadsTable.loanId,
      docLabel:        loanUploadsTable.docLabel,
      fileName:        loanUploadsTable.fileName,
      mimeType:        loanUploadsTable.mimeType,
      fileSize:        loanUploadsTable.fileSize,
      uploadedByUserId:loanUploadsTable.uploadedByUserId,
      uploadedAt:      loanUploadsTable.uploadedAt,
    })
    .from(loanUploadsTable)
    .where(eq(loanUploadsTable.loanId, loanId))
    .orderBy(loanUploadsTable.uploadedAt);

  res.json({ uploads });
});

/**
 * @description Uploads a new file attachment to a loan.
 *   The file must be base64-encoded by the client before sending.
 *   Admins can upload to any loan; users can only upload to their own loans.
 *
 * @route   POST /api/loans/:id/uploads
 * @access  Protected — user (own loan) or admin (any loan).
 * @param   {string} params.id         - Loan ID.
 * @param   {string} body.docLabel     - Category label.
 * @param   {string} body.fileName     - Original filename.
 * @param   {string} body.fileData     - Base64-encoded file content.
 * @param   {string} body.mimeType     - File MIME type.
 * @param   {number} body.fileSize     - Decoded file size in bytes (max 10 MiB).
 * @returns {201} `{ ok: true, upload: UploadMetadata }`
 * @throws  {400} Validation error or file too large.
 * @throws  {401} Not authenticated.
 * @throws  {404} Loan not found or access denied.
 */
router.post("/loans/:id/uploads", requireUserOrAdmin, async (req, res) => {
  const loanId  = parseInt(req.params.id as string, 10);
  const isAdmin = !!req.session.adminId;

  // Access check: users must own the loan; admins bypass ownership
  if (!isAdmin) {
    const loan = await resolveLoanAccess(loanId, req.session.userId, undefined);
    if (!loan) {
      res.status(404).json({ error: "Loan not found or access denied" });
      return;
    }
  } else {
    const [loan] = await db
      .select({ id: loansTable.id })
      .from(loansTable)
      .where(eq(loansTable.id, loanId))
      .limit(1);
    if (!loan) {
      res.status(404).json({ error: "Loan not found" });
      return;
    }
  }

  const parsed = uploadBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { docLabel, fileName, fileData, mimeType, fileSize } = parsed.data;

  const [upload] = await db
    .insert(loanUploadsTable)
    .values({
      loanId,
      // Track who uploaded — null when uploaded by an admin (no user session)
      uploadedByUserId: req.session.userId ?? null,
      docLabel,
      fileName,
      fileData,
      mimeType,
      fileSize,
    })
    .returning({
      id:              loanUploadsTable.id,
      loanId:          loanUploadsTable.loanId,
      docLabel:        loanUploadsTable.docLabel,
      fileName:        loanUploadsTable.fileName,
      mimeType:        loanUploadsTable.mimeType,
      fileSize:        loanUploadsTable.fileSize,
      uploadedByUserId:loanUploadsTable.uploadedByUserId,
      uploadedAt:      loanUploadsTable.uploadedAt,
    });

  res.status(201).json({ ok: true, upload });
});

/**
 * @description Deletes a specific upload from a loan.
 *   Admins can delete any upload.  Users can only delete uploads from their own loans.
 *
 * @route   DELETE /api/loans/:id/uploads/:uploadId
 * @access  Protected — user (own loan) or admin (any loan).
 * @param   {string} params.id       - Loan ID.
 * @param   {string} params.uploadId - Upload record ID.
 * @returns {200} `{ ok: true }`
 * @throws  {401} Not authenticated.
 * @throws  {403} User does not own the loan.
 * @throws  {404} Upload not found.
 */
router.delete("/loans/:id/uploads/:uploadId", requireUserOrAdmin, async (req, res) => {
  const loanId   = parseInt(req.params.id as string, 10);
  const uploadId = parseInt(req.params.uploadId as string, 10);
  const isAdmin  = !!req.session.adminId;

  const [upload] = await db
    .select()
    .from(loanUploadsTable)
    .where(
      and(
        eq(loanUploadsTable.id, uploadId),
        eq(loanUploadsTable.loanId, loanId)
      )
    )
    .limit(1);

  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }

  if (!isAdmin) {
    const loan = await resolveLoanAccess(loanId, req.session.userId, undefined);
    if (!loan) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  await db.delete(loanUploadsTable).where(eq(loanUploadsTable.id, uploadId));
  res.json({ ok: true });
});

/**
 * @description Streams a previously uploaded file as a binary download.
 *   Decodes the stored base64 string and sends raw bytes with the original
 *   MIME type and filename as `Content-Disposition: attachment`.
 *
 * @route   GET /api/loans/:id/uploads/:uploadId/download
 * @access  Protected — user (own loan) or admin (any loan).
 * @param   {string} params.id       - Loan ID.
 * @param   {string} params.uploadId - Upload record ID.
 * @returns {200} Binary file stream with appropriate Content-Type header.
 * @throws  {401} Not authenticated.
 * @throws  {403} User does not own the loan.
 * @throws  {404} Upload not found.
 */
router.get("/loans/:id/uploads/:uploadId/download", requireUserOrAdmin, async (req, res) => {
  const loanId   = parseInt(req.params.id as string, 10);
  const uploadId = parseInt(req.params.uploadId as string, 10);
  const isAdmin  = !!req.session.adminId;

  const [upload] = await db
    .select()
    .from(loanUploadsTable)
    .where(
      and(
        eq(loanUploadsTable.id, uploadId),
        eq(loanUploadsTable.loanId, loanId)
      )
    )
    .limit(1);

  if (!upload) {
    res.status(404).json({ error: "Upload not found" });
    return;
  }

  if (!isAdmin) {
    const loan = await resolveLoanAccess(loanId, req.session.userId, undefined);
    if (!loan) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  // Decode base64 → binary Buffer, then send as a typed download
  const buffer = Buffer.from(upload.fileData, "base64");
  res.setHeader("Content-Type", upload.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(upload.fileName)}"`
  );
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
});

export default router;
