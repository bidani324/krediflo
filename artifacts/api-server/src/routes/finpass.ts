/**
 * @fileoverview FINpass Account Aggregator proxy routes.
 *
 * Flow:
 *   1. POST /api/finpass/init              — Initiate AA consent for an applicant.
 *   2. POST /api/finpass/fetch-pdf         — Fetch the bank statement PDF (IDs read from DB).
 *   3. POST /api/finpass/fetch-json        — Fetch the JSON report (IDs read from DB).
 *   4. POST /api/finpass/refresh           — Refresh AA data (IDs read from DB).
 *   5. GET  /api/finpass/document/:docId/download      — Stream stored PDF.
 *   6. GET  /api/finpass/document/:docId/download-json — Send stored JSON report.
 *
 * clientId and requestId are stored in documents.data after init.
 * The frontend never needs to supply them.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable, applicantsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { clientErrorMessage } from "../lib/client-error";
import { z } from "zod/v4";
import { requireUserOrAdmin } from "../middleware/auth";
import { assertApplicantAccess, assertDocumentAccess } from "../middleware/ownership";
import { FINPASS } from "../config/constants";
import { analyseStatement, analysisWorkbook, BankAnalysisError, type BankAnalysis } from "../lib/bank-analysis";

const router = Router();

/* ─── FINpass HTTP Helpers ───────────────────────────────────────────────── */

function finpassHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.FINPASS_API_KEY ?? "",
    "x-api-secret": process.env.FINPASS_API_SECRET ?? "",
  };
}


/* ─── Document State Machine Helpers ─────────────────────────────────────── */

async function getOrCreateBankDoc(applicantId: number) {
  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.applicantId, applicantId),
        eq(documentsTable.docType, "bank_statement")
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(documentsTable)
    .values({ applicantId, docType: "bank_statement", status: "pending" })
    .returning();

  return created;
}

async function setFetching(docId: number) {
  await db
    .update(documentsTable)
    .set({ status: "fetching" })
    .where(eq(documentsTable.id, docId));
}

async function setFetched(
  docId: number,
  data: object,
  fileName?: string,
  fileData?: string
) {
  await db
    .update(documentsTable)
    .set({
      status: "fetched",
      data,
      fileName: fileName ?? null,
      fileData: fileData ?? null,
      fetchedAt: new Date(),
    })
    .where(eq(documentsTable.id, docId));
}

async function setFailed(docId: number, error: string) {
  await db
    .update(documentsTable)
    .set({ status: "failed", data: { error } })
    .where(eq(documentsTable.id, docId));
}

/** Read stored clientId + requestId from the bank_statement doc for an applicant. */
async function getStoredIds(applicantId: number): Promise<{ doc: typeof documentsTable.$inferSelect; clientId: string; requestId: string } | null> {
  const doc = await getOrCreateBankDoc(applicantId);
  const d = doc.data as Record<string, unknown> | null;
  const clientId = d?.clientId as string | undefined;
  const requestId = d?.requestId as string | undefined;
  if (!clientId || !requestId) return null;
  return { doc, clientId, requestId };
}

function isConsentPendingResponse(data: Record<string, unknown>): boolean {
  const messageCode: string = (data as any)?.data?.message_code ?? (data as any)?.message_code ?? "";
  return (
    messageCode === "consent_status_pending" ||
    ((data as any)?.message ?? "").toLowerCase().includes("consent status pending")
  );
}

/* ─── Schemas ─────────────────────────────────────────────────────────────── */

const initSchema = z.object({
  applicantId: z.number().int(),
  consentType: z.string().default("loan_underwriting"),
  redirectUrl: z.string().optional(),
  webhookUrl: z.string().optional(),
});

const applicantOnlySchema = z.object({
  applicantId: z.number().int(),
});

/* ─── Routes ──────────────────────────────────────────────────────────────── */

/**
 * POST /api/finpass/init
 * Initiate Account Aggregator consent for an applicant.
 */
router.post("/init", requireUserOrAdmin, async (req, res) => {
  const parsed = initSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId, consentType, redirectUrl, webhookUrl } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) {
    return void res.status(404).json({ error: "Applicant not found" });
  }

  try {
    const body: Record<string, string> = {
      mobile_number: applicant.mobile,
      consent_type: consentType,
    };
    if (applicant.pan) body.pan = applicant.pan;
    if (applicant.email) body.email = applicant.email;
    if (redirectUrl) body.redirect_url = redirectUrl;
    if (webhookUrl) body.webhook_url = webhookUrl;

    const resp = await fetch(`${FINPASS.BASE_URL}/services/account-aggregator/init`, {
      method: "POST",
      headers: finpassHeaders(),
      body: JSON.stringify(body),
    });

    const data = await resp.json() as Record<string, unknown>;

    if (!resp.ok || (data as any)?.success === false) {
      // Never forward raw vendor payloads or vendor names to the client.
      return void res.status(502).json({
        ok: false,
        error: clientErrorMessage(
          new Error((data as any)?.message ?? "Banking gateway initialization failed"),
          "Banking gateway temporarily unavailable. Please try again shortly.",
        ),
      });
    }

    const d = (data as any)?.data ?? data;
    const clientId: string | undefined = d?.client_id;
    const aaRedirectUrl: string | undefined = d?.redirect_url ?? d?.url ?? d?.consent_url;

    // FINpass embeds requestId inside the redirect URL hash fragment:
    // https://orch.crif.com/web-redirect/#/aa-webview?requestId=<value>
    let requestId: string | undefined = d?.request_id;
    if (!requestId && aaRedirectUrl) {
      try {
        const hashPart = aaRedirectUrl.split("#")[1] ?? "";
        const queryPart = hashPart.split("?")[1] ?? "";
        requestId = new URLSearchParams(queryPart).get("requestId") ?? undefined;
      } catch {
        // leave undefined
      }
    }

    const doc = await getOrCreateBankDoc(applicantId);
    await db.update(documentsTable).set({
      status: "pending",
      data: {
        stage: "consent_initiated",
        clientId,
        requestId,
        redirectUrl: aaRedirectUrl,
        initResponse: data,
      },
      fileName: null,
      fileData: null,
      fetchedAt: null,
    }).where(eq(documentsTable.id, doc.id));

    return void res.json({
      ok: true,
      docId: doc.id,
      clientId,
      requestId,
      redirectUrl: aaRedirectUrl,
    });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: clientErrorMessage(err, "Internal error") });
  }
});

/**
 * POST /api/finpass/fetch-pdf
 * Fetch the bank statement PDF after consent approval.
 * clientId and requestId are read from the stored document — not required from caller.
 */
router.post("/fetch-pdf", requireUserOrAdmin, async (req, res) => {
  const parsed = applicantOnlySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) return void res.status(404).json({ error: "Applicant not found" });

  const stored = await getStoredIds(applicantId);
  if (!stored) {
    return void res.status(422).json({
      ok: false,
      error: "Consent not yet initiated. Run /init first to generate a consent link.",
    });
  }
  const { doc, clientId, requestId } = stored;

  await setFetching(doc.id);
  res.json({ ok: true, docId: doc.id, message: "Bank statement fetch initiated" });

  try {
    const resp = await fetch(`${FINPASS.BASE_URL}/services/account-aggregator/fetch-statement-pdf`, {
      method: "POST",
      headers: finpassHeaders(),
      body: JSON.stringify({ client_id: clientId, request_id: requestId }),
    });

    const contentType = resp.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
      // Direct binary PDF
      const buf = await resp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const fileName = `bank_statement_${applicant.mobile}_${Date.now()}.pdf`;
      const prevData = doc.data as Record<string, unknown> | null ?? {};
      await setFetched(
        doc.id,
        { ...prevData, stage: "fetched", clientId, requestId, source: "finpass" },
        fileName,
        base64
      );
    } else {
      const data = await resp.json() as Record<string, unknown>;
      const d = (data as any)?.data ?? data;
      const success = (data as any)?.success;

      // Extract PDF URL — FINpass returns data.reports[].statement_report_link
      // Also fall back to legacy field names
      const reports: Array<Record<string, unknown>> = Array.isArray(d?.reports) ? d.reports : [];
      const reportLink: string | undefined = reports.find(r => r.statement_report_link)?.statement_report_link as string | undefined;
      const pdfUrl: string | undefined =
        reportLink ?? d?.pdf_url ?? d?.statement_url ?? d?.download_url ?? d?.pdf_link;

      if (!resp.ok || success === false) {
        if (isConsentPendingResponse(data)) {
          const prevData = doc.data as Record<string, unknown> | null ?? {};
          await db.update(documentsTable).set({
            status: "pending",
            data: {
              ...prevData,
              stage: "consent_initiated",
              clientId,
              requestId,
              awaitingConsent: true,
              message: "Customer has not yet approved consent on the AA portal. Share the redirect link and retry.",
            },
          }).where(eq(documentsTable.id, doc.id));
        } else {
          await setFailed(doc.id, JSON.stringify(data));
        }
      } else if (pdfUrl) {
        // Download the S3/signed PDF immediately (URL may expire quickly)
        try {
          const pdfResp = await fetch(pdfUrl);
          if (pdfResp.ok) {
            const buf = await pdfResp.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const fileName = `bank_statement_${applicant.mobile}_${Date.now()}.pdf`;
            const prevData = doc.data as Record<string, unknown> | null ?? {};
            await setFetched(
              doc.id,
              { ...prevData, stage: "fetched", clientId, requestId, source: "finpass", reports },
              fileName,
              base64
            );
          } else {
            // URL fetch failed — store metadata without file
            const prevData = doc.data as Record<string, unknown> | null ?? {};
            await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, pdfUrl, source: "finpass", reports });
          }
        } catch {
          const prevData = doc.data as Record<string, unknown> | null ?? {};
          await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, pdfUrl, source: "finpass", reports });
        }
      } else {
        // No PDF URL in response — store what we have
        const prevData = doc.data as Record<string, unknown> | null ?? {};
        await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, source: "finpass", raw: d });
      }
    }

    const [updated] = await db.select().from(documentsTable).where(eq(documentsTable.id, doc.id)).limit(1);
    if (updated?.status === "fetched") {
      await db.update(applicantsTable).set({
        bankStatementsStatus: "fetched",
        docsLastFetchedAt: new Date(),
      }).where(eq(applicantsTable.id, applicantId));
    }

  } catch (err: any) {
    await setFailed(doc.id, err?.message ?? "Unknown error");
  }
});

/**
 * POST /api/finpass/fetch-json
 * Fetch the bank statement JSON report after consent approval.
 * Stores the report in documents.data.jsonReport.
 */
router.post("/fetch-json", requireUserOrAdmin, async (req, res) => {
  const parsed = applicantOnlySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) return void res.status(404).json({ error: "Applicant not found" });

  const stored = await getStoredIds(applicantId);
  if (!stored) {
    return void res.status(422).json({
      ok: false,
      error: "Consent not yet initiated. Run /init first.",
    });
  }
  const { doc, clientId, requestId } = stored;

  res.json({ ok: true, docId: doc.id, message: "Bank statement JSON fetch initiated" });

  try {
    const resp = await fetch(`${FINPASS.BASE_URL}/services/account-aggregator/fetch-json-report`, {
      method: "POST",
      headers: finpassHeaders(),
      body: JSON.stringify({ client_id: clientId, request_id: requestId }),
    });

    const data = await resp.json() as Record<string, unknown>;
    const success = (data as any)?.success;

    if (!resp.ok || success === false) {
      if (isConsentPendingResponse(data)) {
        const prevData = doc.data as Record<string, unknown> | null ?? {};
        await db.update(documentsTable).set({
          status: doc.status === "fetched" ? "fetched" : "pending",
          data: {
            ...prevData,
            awaitingConsent: true,
            message: "Customer has not yet approved consent on the AA portal.",
          },
        }).where(eq(documentsTable.id, doc.id));
      }
      return;
    }

    const prevData = doc.data as Record<string, unknown> | null ?? {};
    const newData = {
      ...prevData,
      jsonReport: data,
      jsonFetchedAt: new Date().toISOString(),
    };

    const newStatus = doc.status === "fetched" ? "fetched" : "fetched";
    await db.update(documentsTable).set({
      status: newStatus,
      data: newData,
      fetchedAt: doc.fetchedAt ?? new Date(),
    }).where(eq(documentsTable.id, doc.id));

    await db.update(applicantsTable).set({
      bankStatementsStatus: "fetched",
      docsLastFetchedAt: new Date(),
    }).where(eq(applicantsTable.id, applicantId));

  } catch {
    // JSON fetch failure is silent — PDF may still be available
  }
});

/**
 * POST /api/finpass/refresh
 * Refresh AA data using stored consent IDs.
 */
router.post("/refresh", requireUserOrAdmin, async (req, res) => {
  const parsed = applicantOnlySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);

  if (!applicant) return void res.status(404).json({ error: "Applicant not found" });

  const stored = await getStoredIds(applicantId);
  if (!stored) {
    return void res.status(422).json({
      ok: false,
      error: "No consent IDs stored. Run /init first.",
    });
  }
  const { doc, clientId, requestId } = stored;

  await setFetching(doc.id);
  res.json({ ok: true, docId: doc.id, message: "Bank statement refresh initiated" });

  try {
    const resp = await fetch(`${FINPASS.BASE_URL}/services/account-aggregator/refresh-data`, {
      method: "POST",
      headers: finpassHeaders(),
      body: JSON.stringify({ client_id: clientId, request_id: requestId }),
    });

    const contentType = resp.headers.get("content-type") ?? "";

    if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
      const buf = await resp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const fileName = `bank_statement_${applicant.mobile}_${Date.now()}.pdf`;
      const prevData = doc.data as Record<string, unknown> | null ?? {};
      await setFetched(
        doc.id,
        { ...prevData, stage: "fetched", clientId, requestId, source: "finpass_refresh" },
        fileName,
        base64
      );
    } else {
      const data = await resp.json() as Record<string, unknown>;
      const d = (data as any)?.data ?? data;
      const success = (data as any)?.success;

      const reports: Array<Record<string, unknown>> = Array.isArray(d?.reports) ? d.reports : [];
      const reportLink: string | undefined = reports.find(r => r.statement_report_link)?.statement_report_link as string | undefined;
      const pdfUrl: string | undefined =
        reportLink ?? d?.pdf_url ?? d?.statement_url ?? d?.download_url ?? d?.pdf_link;

      if (!resp.ok || success === false) {
        if (isConsentPendingResponse(data)) {
          const prevData = doc.data as Record<string, unknown> | null ?? {};
          await db.update(documentsTable).set({
            status: "pending",
            data: {
              ...prevData,
              stage: "consent_initiated",
              clientId,
              requestId,
              awaitingConsent: true,
              message: "Customer has not yet approved consent on the AA portal.",
            },
          }).where(eq(documentsTable.id, doc.id));
        } else {
          await setFailed(doc.id, JSON.stringify(data));
        }
      } else if (pdfUrl) {
        try {
          const pdfResp = await fetch(pdfUrl);
          if (pdfResp.ok) {
            const buf = await pdfResp.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const fileName = `bank_statement_${applicant.mobile}_${Date.now()}.pdf`;
            const prevData = doc.data as Record<string, unknown> | null ?? {};
            await setFetched(
              doc.id,
              { ...prevData, stage: "fetched", clientId, requestId, source: "finpass_refresh", reports },
              fileName,
              base64
            );
          } else {
            const prevData = doc.data as Record<string, unknown> | null ?? {};
            await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, pdfUrl, source: "finpass_refresh", reports });
          }
        } catch {
          const prevData = doc.data as Record<string, unknown> | null ?? {};
          await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, pdfUrl, source: "finpass_refresh", reports });
        }
      } else {
        const prevData = doc.data as Record<string, unknown> | null ?? {};
        await setFetched(doc.id, { ...prevData, stage: "fetched", clientId, requestId, source: "finpass_refresh" });
      }
    }

    const [updated] = await db.select().from(documentsTable).where(eq(documentsTable.id, doc.id)).limit(1);
    if (updated?.status === "fetched") {
      await db.update(applicantsTable).set({
        bankStatementsStatus: "fetched",
        docsLastFetchedAt: new Date(),
      }).where(eq(applicantsTable.id, applicantId));
    }

  } catch (err: any) {
    await setFailed(doc.id, err?.message ?? "Unknown error");
  }
});

/**
 * GET /api/finpass/document/:docId/download
 * Stream the stored bank statement PDF.
 */
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
  if (!doc.fileData) return void res.status(404).json({ error: "No PDF stored yet" });

  const buffer = Buffer.from(doc.fileData, "base64");
  const fileName = doc.fileName ?? "bank_statement.pdf";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return void res.send(buffer);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * In-house bank statement analyser. Legacy route paths are preserved.
 * PDF bytes are transient; extracted structured data is stored and XLSX regenerated on download.
 * ═══════════════════════════════════════════════════════════════════════════ */

async function getOrCreateBsaDoc(applicantId: number) {
  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.applicantId, applicantId), eq(documentsTable.docType, "bsa_analysis")))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(documentsTable)
    .values({ applicantId, docType: "bsa_analysis", status: "pending" })
    .returning();
  return created;
}

/**
 * POST /api/finpass/bsa/upload
 * Analyse a bank-statement PDF locally, without external BSA credentials.
 * Body: { applicantId, fileData?: base64 string, fileName?: string }
 * If fileData is omitted the already-fetched AA bank statement is used.
 */
router.post("/bsa/upload", requireUserOrAdmin, async (req, res) => {
  const schema = z.object({
    applicantId: z.number().int().positive(),
    fileData: z.string().min(1).optional(),
    fileName: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId, fileData: bodyFileData, fileName: bodyFileName } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);
  if (!applicant) return void res.status(404).json({ error: "Applicant not found" });

  let base64: string | undefined = bodyFileData;
  let uploadName = bodyFileName ?? "bank_statement.pdf";

  // Fall back to stored AA bank statement if no file provided
  if (bodyFileData === undefined) {
    const [aaDoc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.applicantId, applicantId), eq(documentsTable.docType, "bank_statement")))
      .limit(1);
    if (aaDoc?.status === "fetched" && aaDoc.fileData) {
      base64 = aaDoc.fileData;
      uploadName = aaDoc.fileName ?? uploadName;
    }
  }

  if (!base64) {
    return void res.status(422).json({
      ok: false,
      error: "No file provided and no fetched bank statement found. Upload a PDF or fetch it via AA first.",
    });
  }

  try {
    const analysis = await analyseStatement(base64);
    const bsaDoc = await getOrCreateBsaDoc(applicantId);
    await db.update(documentsTable).set({
      status: "fetched",
      data: { source: "in_house", bsaResult: analysis, fileName: uploadName, warnings: analysis.warnings },
      fetchedAt: new Date(),
      fileName: "Bank_Analysis.xlsx",
      fileData: null,
    }).where(eq(documentsTable.id, bsaDoc.id));
    res.setHeader("Cache-Control", "no-store");
    return void res.json({ ok: true, docId: bsaDoc.id, analysis, message: "Bank statement analysis complete" });
  } catch (err) {
    return void res.status(err instanceof BankAnalysisError ? err.status : 500).json({
      ok: false, error: err instanceof BankAnalysisError ? err.message : "Analysis could not be saved. Please retry.",
    });
  }
});

/**
 * POST /api/finpass/bsa/result
 * Read a completed local result (compatibility endpoint; never calls the former BSA provider).
 * Body: { applicantId }
 */
router.post("/bsa/result", requireUserOrAdmin, async (req, res) => {
  const parsed = applicantOnlySchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [bsaDoc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.applicantId, applicantId), eq(documentsTable.docType, "bsa_analysis")))
    .limit(1);

  if (!bsaDoc) {
    return void res.status(422).json({ ok: false, error: "No BSA record found. Upload a statement first." });
  }

  const storedData = bsaDoc.data as Record<string, unknown> | null ?? {};
  if (storedData.source !== "in_house" || !storedData.bsaResult) {
    return void res.status(422).json({ ok: false, error: "Upload the statement again to generate an in-house analysis. Existing downloaded reports remain available." });
  }
  res.setHeader("Cache-Control", "no-store");
  return void res.json({ ok: true, docId: bsaDoc.id, analysis: storedData.bsaResult });
});

/**
 * GET /api/finpass/bsa/document/:docId/download-result
 * Stream the stored BSA analysis XLSX file.
 */
router.get("/bsa/document/:docId/download-result", requireUserOrAdmin, async (req, res) => {
  const docId = Number(req.params.docId);
  if (isNaN(docId)) return void res.status(400).json({ error: "Invalid docId" });
  if (!(await assertDocumentAccess(req, res, docId))) return;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId))
    .limit(1);

  if (!doc) return void res.status(404).json({ error: "Document not found" });

  const data = doc.data as Record<string, unknown> | null;
  if (!data?.bsaResult) return void res.status(404).json({ error: "No BSA result stored yet" });

  if (data.source === "in_house") {
    try {
      const buffer = await analysisWorkbook(data.bsaResult as BankAnalysis);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="Bank_Analysis.xlsx"');
      res.setHeader("Cache-Control", "no-store");
      return void res.send(buffer);
    } catch {
      return void res.status(500).json({ error: "The analysis workbook could not be generated." });
    }
  }
  if (!doc.fileData) {
    return void res.status(404).json({ error: "No stored spreadsheet is available. Upload the statement again for in-house analysis." });
  }

  const xlsxBuf = Buffer.from(doc.fileData, "base64");
  const rawName = doc.fileName ?? "bsa_analysis.xlsx";
  const fileName = rawName.endsWith(".xlsx") ? rawName : rawName.replace(/\.[^.]+$/, "") + ".xlsx";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", xlsxBuf.length);
  return void res.send(xlsxBuf);
});

/**
 * GET /api/finpass/document/:docId/download-json
 * Send the stored JSON report.
 */
router.get("/document/:docId/download-json", requireUserOrAdmin, async (req, res) => {
  const docId = Number(req.params.docId);
  if (isNaN(docId)) return void res.status(400).json({ error: "Invalid docId" });
  if (!(await assertDocumentAccess(req, res, docId))) return;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId))
    .limit(1);

  if (!doc) return void res.status(404).json({ error: "Document not found" });

  const data = doc.data as Record<string, unknown> | null;
  const jsonReport = data?.jsonReport;
  if (!jsonReport) return void res.status(404).json({ error: "No JSON report stored yet" });

  const fileName = (doc.fileName ?? "bank_statement").replace(/\.pdf$/i, "") + "_report.json";
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return void res.send(JSON.stringify(jsonReport, null, 2));
});

/* ═══════════════════════════════════════════════════════════════════════════
 * COMMERCIAL CIBIL — FINpass credit-report-commercial
 * POST /api/finpass/commercial-cibil
 * Body: { applicantId, businessName?, reportType? }
 * ═══════════════════════════════════════════════════════════════════════════ */

function commCibilHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.COMM_CIBIL_API_KEY ?? "",
    "x-api-secret": process.env.COMM_CIBIL_API_SECRET ?? "",
  };
}

async function getOrCreateCommCibilDoc(applicantId: number) {
  const [existing] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.applicantId, applicantId), eq(documentsTable.docType, "commercial_cibil")))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(documentsTable)
    .values({ applicantId, docType: "commercial_cibil", status: "pending" })
    .returning();
  return created;
}

/**
 * POST /api/finpass/commercial-cibil
 * Fetch commercial CIBIL report for a business applicant via FINpass.
 * Body: { applicantId, businessName?, reportType? }
 */
router.post("/commercial-cibil", requireUserOrAdmin, async (req, res) => {
  const schema = z.object({
    applicantId: z.number().int().positive(),
    businessName: z.string().optional(),
    reportType: z.enum(["html", "pdf", "json"]).optional().default("html"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "applicantId is required" });
  }
  const { applicantId, reportType } = parsed.data;
  if (!(await assertApplicantAccess(req, res, applicantId))) return;

  const [applicant] = await db
    .select()
    .from(applicantsTable)
    .where(eq(applicantsTable.id, applicantId))
    .limit(1);
  if (!applicant) return void res.status(404).json({ error: "Applicant not found" });

  const businessName = parsed.data.businessName
    ?? `${applicant.firstName} ${applicant.lastName}`.trim();

  const doc = await getOrCreateCommCibilDoc(applicantId);
  await setFetching(doc.id);
  res.json({ ok: true, docId: doc.id, message: "Commercial CIBIL fetch initiated" });

  try {
    const resp = await fetch(`${FINPASS.BASE_URL}/services/credit-report-commercial/fetch`, {
      method: "POST",
      headers: commCibilHeaders(),
      body: JSON.stringify({
        business_name: businessName,
        pan: applicant.pan,
        consent: "Y",
        report_type: reportType,
      }),
    });

    const data = await resp.json() as Record<string, unknown>;
    const success = (data as any)?.success;

    if (!resp.ok || success === false) {
      await setFailed(doc.id, JSON.stringify(data));
      return;
    }

    // Try to download HTML/PDF report if a link is returned
    const reportLink: string | undefined =
      (data as any)?.data?.report_url ??
      (data as any)?.data?.html_report_url ??
      (data as any)?.data?.pdf_url ??
      (data as any)?.data?.credit_report_link;

    let fileBase64: string | null = null;
    let fileName: string | null = null;

    if (reportLink) {
      try {
        const fileResp = await fetch(reportLink);
        if (fileResp.ok) {
          const buf = Buffer.from(await fileResp.arrayBuffer());
          fileBase64 = buf.toString("base64");
          const ext = reportType === "pdf" ? "pdf" : "html";
          fileName = `commercial_cibil_${applicant.pan}.${ext}`;
        }
      } catch {
        // non-fatal — JSON data still stored
      }
    }

    await db.update(documentsTable).set({
      status: "fetched",
      data,
      fetchedAt: new Date(),
      ...(fileBase64 ? { fileData: fileBase64, fileName } : {}),
    }).where(eq(documentsTable.id, doc.id));
  } catch (err) {
    await setFailed(doc.id, err instanceof Error ? err.message : String(err));
  }
});

/**
 * GET /api/finpass/commercial-cibil/:docId/download
 * Stream the stored commercial CIBIL report file.
 */
router.get("/commercial-cibil/:docId/download", requireUserOrAdmin, async (req, res) => {
  const docId = Number(req.params.docId);
  if (isNaN(docId)) return void res.status(400).json({ error: "Invalid docId" });
  if (!(await assertDocumentAccess(req, res, docId))) return;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, docId))
    .limit(1);

  if (!doc) return void res.status(404).json({ error: "Document not found" });
  if (!doc.fileData) return void res.status(404).json({ error: "No file stored for this document" });

  const buf = Buffer.from(doc.fileData, "base64");
  const fileName = doc.fileName ?? "commercial_cibil_report.html";
  const isHtml = fileName.endsWith(".html");
  const isPdf = fileName.endsWith(".pdf");
  const contentType = isPdf
    ? "application/pdf"
    : isHtml
    ? "text/html"
    : "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", buf.length);
  return void res.send(buf);
});

export default router;
