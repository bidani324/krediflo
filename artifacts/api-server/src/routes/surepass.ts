/**
 * @fileoverview Surepass KYC API proxy routes for the DhanSync API server.
 *
 * Acts as a secure server-side proxy so the `SUREPASS_TOKEN` bearer token is
 * NEVER exposed to the browser.  All routes validate the caller's user session
 * before forwarding to the Surepass API.
 *
 * Supported KYC document types:
 *   - CIBIL credit report (PDF + score)  → POST /api/surepass/cibil
 *   - PAN comprehensive verification      → POST /api/surepass/pan
 *   - MCA company & director data         → POST /api/surepass/mca/create-order
 *                                           GET  /api/surepass/mca/status/:orderId
 *                                           GET  /api/surepass/mca/order-list
 *   - Document download (base64 PDF)      → GET  /api/surepass/document/:docId/download
 *
 * Fire-and-forget pattern:
 *   Each fetch endpoint responds immediately with `{ ok: true, docId }` and
 *   performs the actual Surepass API call asynchronously in the background.
 *   The frontend polls the document status via the loan detail endpoint.
 *
 * @see https://kyc-api.surepass.io — Surepass API documentation
 * @see artifacts/api-server/src/config/constants.ts — SUREPASS.BASE_URL
 */

import { Router } from "express";
import { db, loansTable } from "@workspace/db";
import { documentsTable, applicantsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { requireUser, requireAdmin, requireUserOrAdmin } from "../middleware/auth";
import { assertApplicantAccess, assertDocumentAccess } from "../middleware/ownership";
import { clientErrorMessage } from "../lib/client-error";
import { SUREPASS } from "../config/constants";

const router = Router();

/* ─── Surepass HTTP Helpers ───────────────────────────────────────────────── */

/**
 * @description Builds the HTTP headers required for every Surepass API call.
 *   Reads `SUREPASS_TOKEN` from the environment at call time (not module load
 *   time) so the server can start without the token present in development.
 *
 * @returns {{ "Content-Type": string; Authorization: string }} Surepass request headers.
 */
function surepassHeaders(): { "Content-Type": string; Authorization: string } {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`,
  };
}

/* ─── Document State Machine Helpers ─────────────────────────────────────── */

/**
 * @description Returns an existing document record for an applicant + docType pair,
 *   or creates a new one with `status: "pending"` if none exists.
 *   Prevents duplicate document rows for the same applicant and document type.
 *
 * @param {number} applicantId - The applicant this document belongs to.
 * @param {string} docType     - One of the `doc_type` enum values (e.g. `"cibil_report"`).
 * @returns {Promise<typeof documentsTable.$inferSelect>} Existing or newly created document row.
 */
async function getOrCreateDoc(applicantId: number, docType: string) {
  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.applicantId, applicantId),
        eq(documentsTable.docType, docType as never)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(documentsTable)
    .values({ applicantId, docType: docType as never, status: "pending" })
    .returning();

  return created;
}

/**
 * @description Transitions a document record to `status: "fetching"`.
 *   Called immediately before the Surepass API request is dispatched so the UI
 *   can show a loading indicator while the background fetch is in-flight.
 *
 * @param {number} docId - The document record ID to update.
 * @returns {Promise<void>}
 */
async function setDocFetching(docId: number): Promise<void> {
  await db
    .update(documentsTable)
    .set({ status: "fetching" })
    .where(eq(documentsTable.id, docId));
}

/**
 * @description Transitions a document record to `status: "fetched"` and stores
 *   the Surepass API response payload.  Optionally stores a base64-encoded PDF.
 *
 * @param {number}  docId     - The document record ID to update.
 * @param {object}  data      - The parsed Surepass API JSON response to store (JSONB).
 * @param {string}  [fileName] - Original filename for the downloaded PDF, if any.
 * @param {string}  [fileData] - Base64-encoded PDF content, if downloaded.
 * @returns {Promise<void>}
 */
async function setDocFetched(
  docId: number,
  data: object,
  fileName?: string,
  fileData?: string,
): Promise<void> {
  await db
    .update(documentsTable)
    .set({
      status:    "fetched",
      data,
      fileName:  fileName  ?? null,
      fileData:  fileData  ?? null,
      fetchedAt: new Date(),
    })
    .where(eq(documentsTable.id, docId));
}

/**
 * @description Transitions a document record to `status: "failed"` and stores
 *   a structured error description for debugging via the admin portal.
 *
 * @param {number} docId  - The document record ID to update.
 * @param {string} error  - Human-readable error description from the Surepass response.
 * @returns {Promise<void>}
 */
async function setDocFailed(docId: number, error: string): Promise<void> {
  await db
    .update(documentsTable)
    .set({ status: "failed", data: { error } })
    .where(eq(documentsTable.id, docId));
}

const cibilSchema = z.object({
  applicantId: z.number().int(),
});

const CIBIL_BODY = (applicant: { mobile: string; pan: string; firstName: string; lastName: string }) => ({
  mobile: applicant.mobile,
  pan: applicant.pan,
  name: `${applicant.firstName} ${applicant.lastName}`,
  gender: "male",
  consent: "Y",
});

router.post("/cibil", requireUserOrAdmin, async (req, res) => {
  const parsed = cibilSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) {
    return void res.status(404).json({ error: "Applicant not found" });
  }

  const doc = await getOrCreateDoc(applicantId, "cibil_report");
  await setDocFetching(doc.id);

  // Respond immediately — background processing below
  res.json({ ok: true, docId: doc.id, message: "CIBIL fetch initiated" });

  try {
    // ── Step 1: Score endpoint ────────────────────────────────────────────────
    let scoreValue: number | null = null;
    let scoreRaw: Record<string, unknown> = {};

    try {
      const scoreResp = await fetch(`${SUREPASS.BASE_URL}/credit-report-cibil/score`, {
        method: "POST",
        headers: surepassHeaders(),
        body: JSON.stringify(CIBIL_BODY(applicant)),
      });
      const scoreData = await scoreResp.json() as Record<string, unknown>;
      scoreRaw = scoreData;
      const sd = (scoreData as any)?.data;
      const raw = sd?.cibil_score ?? sd?.credit_score ?? sd?.score ?? null;
      if (raw != null) scoreValue = Number(raw);
    } catch {
      // score call failed — continue to PDF step anyway
    }

    // ── Step 2: Full report PDF ───────────────────────────────────────────────
    const pdfResp = await fetch(`${SUREPASS.BASE_URL}/credit-report-cibil/fetch-report-pdf`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify(CIBIL_BODY(applicant)),
    });

    const contentType = pdfResp.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
      // Direct PDF bytes
      const buf = await pdfResp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const fileName = `cibil_${applicant.pan}_${Date.now()}.pdf`;
      await setDocFetched(
        doc.id,
        { source: "surepass", scoreRaw, cibilScore: scoreValue },
        fileName,
        base64
      );
    } else {
      // JSON response — may contain a link to the PDF
      const pdfData = await pdfResp.json() as Record<string, unknown>;
      const success = (pdfData as any)?.success;
      const pd = (pdfData as any)?.data;
      const pdfLink: string | undefined = pd?.credit_report_link ?? pd?.report_link;

      // Try to resolve score from PDF response if score call missed
      if (!scoreValue) {
        const raw = pd?.cibil_score ?? pd?.credit_score ?? pd?.score ?? null;
        if (raw != null) scoreValue = Number(raw);
      }

      if (pdfLink) {
        try {
          const linked = await fetch(pdfLink);
          if (linked.ok) {
            const buf = await linked.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const fileName = `cibil_${applicant.pan}_${Date.now()}.pdf`;
            await setDocFetched(
              doc.id,
              { source: "surepass", scoreRaw, pdfLink, cibilScore: scoreValue, raw: pdfData },
              fileName,
              base64
            );
          } else {
            // PDF link fetch failed — store JSON
            if (!pdfResp.ok || success === false) {
              await setDocFailed(doc.id, JSON.stringify(pdfData));
            } else {
              await setDocFetched(doc.id, { scoreRaw, ...pdfData as object });
            }
          }
        } catch {
          await setDocFetched(doc.id, { scoreRaw, ...pdfData as object });
        }
      } else if (!pdfResp.ok || success === false) {
        await setDocFailed(doc.id, JSON.stringify({ scoreRaw, pdfData }));
      } else {
        await setDocFetched(doc.id, { scoreRaw, ...pdfData as object });
      }
    }

    // ── Update applicant with score ───────────────────────────────────────────
    await db.update(applicantsTable).set({
      ...(scoreValue != null ? { cibilScore: scoreValue } : {}),
      cibilStatus: "fetched",
      docsLastFetchedAt: new Date(),
    }).where(eq(applicantsTable.id, applicantId));

  } catch (err: any) {
    await setDocFailed(doc.id, err?.message ?? "Unknown error");
  }
});

const panSchema = z.object({
  applicantId: z.number().int(),
});

router.post("/pan", requireUserOrAdmin, async (req, res) => {
  const parsed = panSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) {
    return void res.status(404).json({ error: "Applicant not found" });
  }

  const doc = await getOrCreateDoc(applicantId, "pan_verification");
  await setDocFetching(doc.id);

  res.json({ ok: true, docId: doc.id, message: "PAN verification initiated" });

  try {
    const response = await fetch(`${SUREPASS.BASE_URL}/pan/pan-comprehensive`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify({
        id_number: applicant.pan,
        masked_aadhaar_variant: "v2",
      }),
    });

    const data = await response.json() as Record<string, unknown>;
    const success = (data as any)?.success;

    if (!response.ok || success === false) {
      await setDocFailed(doc.id, JSON.stringify(data));
    } else {
      await setDocFetched(doc.id, data as object);
      await db.update(applicantsTable).set({
        panVerified: true,
        docsLastFetchedAt: new Date(),
      }).where(eq(applicantsTable.id, applicantId));
    }
  } catch (err: any) {
    await setDocFailed(doc.id, err?.message ?? "Unknown error");
  }
});

const mcaCreateSchema = z.object({
  applicantId: z.number().int(),
  cinNumber: z.string().min(1),
});

router.post("/mca/create-order", requireUserOrAdmin, async (req, res) => {
  const parsed = mcaCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId and cinNumber required" });
  }
  const { applicantId, cinNumber } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) {
    return void res.status(404).json({ error: "Applicant not found" });
  }

  const doc = await getOrCreateDoc(applicantId, "mca_data");
  await setDocFetching(doc.id);

  // Respond immediately — background processing below
  res.json({ ok: true, docId: doc.id, message: "MCA order creation initiated" });

  try {
    // ── Step 1: Create order ──────────────────────────────────────────────────
    const createResp = await fetch(`${SUREPASS.BASE_URL}/mca-api/create-order`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify({ entity_id: cinNumber }),
    });

    const createData = await createResp.json() as Record<string, unknown>;

    if (!createResp.ok || (createData as any)?.success === false) {
      await setDocFailed(doc.id, JSON.stringify(createData));
      return;
    }

    // Surepass returns client_id (not order_id) as the polling key
    const clientId: string | undefined =
      (createData as any)?.data?.client_id ??
      (createData as any)?.client_id;

    // Save order_created state with client_id
    await db.update(documentsTable).set({
      data: {
        stage: "order_created",
        clientId,
        cinNumber,
        createResponse: createData,
      },
    }).where(eq(documentsTable.id, doc.id));

    if (!clientId) {
      await setDocFailed(doc.id, "No client_id in create-order response");
      return;
    }

    // ── Step 2: Poll status until completed (max ~90s) ────────────────────────
    const MAX_POLLS = 15;
    const POLL_INTERVAL_MS = 6000;
    let statusData: any = null;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusResp = await fetch(`${SUREPASS.BASE_URL}/mca-api/status/${clientId}`, {
        headers: surepassHeaders(),
      });
      statusData = await statusResp.json();

      const orderStatus = statusData?.data?.status;

      // Update DB with current poll state
      await db.update(documentsTable).set({
        data: {
          stage: "polling",
          clientId,
          cinNumber,
          pollCount: i + 1,
          orderStatus,
          statusData,
        },
      }).where(eq(documentsTable.id, doc.id));

      if (orderStatus === "completed" || orderStatus === "failed" || orderStatus === "error") {
        break;
      }
    }

    // ── Step 3: Persist final result ──────────────────────────────────────────
    const sd = statusData?.data ?? {};
    const orderStatus: string = sd.status ?? "unknown";
    const zipUrl: string | undefined = sd.zip?.zip_url;
    const entityName: string | undefined = sd.entity_name;
    const totalDocs: number = sd.total_documents ?? 0;

    const finalData: Record<string, unknown> = {
      stage: "completed",
      clientId,
      cinNumber,
      orderStatus,
      entityName,
      totalDocuments: totalDocs,
      completedDocuments: sd.completed_documents ?? 0,
      documents: sd.documents ?? [],
      zipUrl,
      rawStatus: statusData,
    };

    if (zipUrl) {
      // Download and store zip as base64
      try {
        const zipResp = await fetch(zipUrl);
        if (zipResp.ok) {
          const buf = await zipResp.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          const fileName = `mca_${cinNumber}_${Date.now()}.zip`;
          await setDocFetched(doc.id, finalData, fileName, base64);
        } else {
          await setDocFetched(doc.id, finalData);
        }
      } catch {
        await setDocFetched(doc.id, finalData);
      }
    } else {
      await setDocFetched(doc.id, finalData);
    }

    await db.update(applicantsTable).set({
      mcaVerified: orderStatus === "completed",
      docsLastFetchedAt: new Date(),
    }).where(eq(applicantsTable.id, applicantId));

  } catch (err: any) {
    await setDocFailed(doc.id, err?.message ?? "Unknown error");
  }
});

router.get("/mca/status/:orderId", requireUserOrAdmin, async (req, res) => {
  const { orderId } = req.params;

  // Ownership: a non-admin caller may only poll an order that belongs to an
  // MCA document on an applicant of a loan they own. Vendor order ids are
  // opaque, so we resolve them through our own documents table rather than
  // proxying arbitrary caller-supplied ids to the vendor.
  if (!req.session.adminId) {
    const rows = await db
      .select({ data: documentsTable.data })
      .from(documentsTable)
      .innerJoin(applicantsTable, eq(documentsTable.applicantId, applicantsTable.id))
      .innerJoin(loansTable, eq(applicantsTable.loanId, loansTable.id))
      .where(and(
        eq(loansTable.userId, req.session.userId!),
        eq(documentsTable.docType, "mca_data"),
      ));
    const owned = rows.some((r) => (r.data as any)?.clientId === orderId);
    if (!owned) {
      return void res.status(404).json({ error: "Order not found" });
    }
  }

  try {
    const response = await fetch(`${SUREPASS.BASE_URL}/mca-api/status/${orderId}`, {
      headers: surepassHeaders(),
    });
    const data: any = await response.json();
    // Sanitize: return only the fields the client needs — never raw vendor
    // payloads, signature keys, or vendor-identifying metadata.
    return void res.json({
      orderId,
      status: data?.data?.status ?? data?.status ?? "unknown",
      completedAt: data?.data?.completed_at ?? null,
    });
  } catch (err: any) {
    return void res.status(500).json({ error: clientErrorMessage(err) });
  }
});

// Lists every MCA order across all applicants — admin-only.
router.get("/mca/order-list", requireAdmin, async (req, res) => {
  try {
    const response = await fetch(`${SUREPASS.BASE_URL}/mca-api/order-list`, {
      headers: surepassHeaders(),
    });
    const data: any = await response.json();
    // Sanitize: project each order down to client-relevant fields only.
    const rawOrders: any[] = Array.isArray(data?.data?.orders)
      ? data.data.orders
      : Array.isArray(data?.data) ? data.data : [];
    return void res.json({
      orders: rawOrders.map((o) => ({
        orderId: o?.order_id ?? o?.id ?? null,
        status: o?.status ?? "unknown",
        createdAt: o?.created_at ?? null,
      })),
    });
  } catch (err: any) {
    return void res.status(500).json({ error: clientErrorMessage(err) });
  }
});

router.get("/document/:docId/download", requireUserOrAdmin, async (req, res) => {
  const docId = Number(req.params.docId);
  if (isNaN(docId)) return void res.status(400).json({ error: "Invalid docId" });
  if (!(await assertDocumentAccess(req, res, docId))) return;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId))
    .limit(1);

  if (!doc) return void res.status(404).json({ error: "Document not found" });
  if (!doc.fileData) return void res.status(404).json({ error: "No file data available" });

  const buffer = Buffer.from(doc.fileData, "base64");
  const fileName = doc.fileName ?? "document.pdf";
  const isZip = fileName.endsWith(".zip");
  const contentType = isZip ? "application/zip" : "application/pdf";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return void res.send(buffer);
});

export default router;
