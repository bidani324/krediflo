/**
 * @fileoverview Admin Quick Check — standalone API lookup routes.
 *
 * Lets admins fetch live KYC / credit data by entering basic details directly,
 * without needing an existing loan file or applicant record.
 *
 * All routes require admin authentication (`requireAdmin`).
 * Results are returned synchronously in the HTTP response — no fire-and-forget.
 *
 * Routes:
 *   POST /api/admin/quick-check/cibil             — CIBIL score + PDF (Surepass)
 *   POST /api/admin/quick-check/pan               — PAN Comprehensive (Surepass)
 *   POST /api/admin/quick-check/mca               — MCA company / director data (Surepass)
 *   POST /api/admin/quick-check/commercial-cibil  — Commercial CIBIL (FINpass)
 */

import { Router } from "express";
import { z } from "zod/v4";
import { requireAdmin } from "../middleware/auth";
import { clientErrorMessage } from "../lib/client-error";
import { SUREPASS, FINPASS } from "../config/constants";
import { analyseStatement, analysisWorkbook, BankAnalysisError } from "../lib/bank-analysis";

const router = Router();
router.use(requireAdmin);

/* ─── Header helpers ──────────────────────────────────────────────────────── */

function surepassHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`,
  };
}

function commCibilHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.COMM_CIBIL_API_KEY ?? "",
    "x-api-secret": process.env.COMM_CIBIL_API_SECRET ?? "",
  };
}

function finpassHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.FINPASS_API_KEY ?? "",
    "x-api-secret": process.env.FINPASS_API_SECRET ?? "",
  };
}


/* ─── CIBIL Quick Check ───────────────────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/cibil
 * Body: { pan, mobile, name, gender? }
 * Returns a minimal projection: { ok, score, pdfBase64?, fileName? }.
 * Raw vendor payloads are never returned to any API client.
 */
router.post("/cibil", async (req, res) => {
  const schema = z.object({
    pan:    z.string().min(10).max(10),
    mobile: z.string().min(10).max(10),
    name:   z.string().min(1),
    gender: z.enum(["male", "female", "other"]).optional().default("male"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "pan, mobile, and name are required" });
  }
  const { pan, mobile, name, gender } = parsed.data;

  const body = { mobile, pan, name, gender, consent: "Y" };

  try {
    // Score
    let scoreValue: number | null = null;
    try {
      const scoreResp = await fetch(`${SUREPASS.BASE_URL}/credit-report-cibil/score`, {
        method: "POST",
        headers: surepassHeaders(),
        body: JSON.stringify(body),
      });
      const scoreData = (await scoreResp.json()) as Record<string, unknown>;
      const sd = (scoreData as any)?.data;
      const raw = sd?.cibil_score ?? sd?.credit_score ?? sd?.score ?? null;
      if (raw != null) scoreValue = Number(raw);
    } catch { /* non-fatal */ }

    // PDF
    const pdfResp = await fetch(`${SUREPASS.BASE_URL}/credit-report-cibil/fetch-report-pdf`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify(body),
    });

    const ct = pdfResp.headers.get("content-type") ?? "";

    if (ct.includes("application/pdf") || ct.includes("application/octet-stream")) {
      const buf = await pdfResp.arrayBuffer();
      const pdfBase64 = Buffer.from(buf).toString("base64");
      const fileName = `cibil_${pan.toUpperCase()}_${Date.now()}.pdf`;
      return void res.json({ ok: true, score: scoreValue, pdfBase64, fileName });
    }

    const pdfData = (await pdfResp.json()) as Record<string, unknown>;
    const pd = (pdfData as any)?.data;
    if (!scoreValue) {
      const raw = pd?.cibil_score ?? pd?.credit_score ?? pd?.score ?? null;
      if (raw != null) scoreValue = Number(raw);
    }

    const pdfLink: string | undefined = pd?.credit_report_link ?? pd?.report_link;
    if (pdfLink) {
      try {
        const linked = await fetch(pdfLink);
        if (linked.ok) {
          const buf = await linked.arrayBuffer();
          const pdfBase64 = Buffer.from(buf).toString("base64");
          const fileName = `cibil_${pan.toUpperCase()}_${Date.now()}.pdf`;
          return void res.json({ ok: true, score: scoreValue, pdfBase64, fileName });
        }
      } catch { /* non-fatal */ }
    }

    if (!pdfResp.ok || (pdfData as any)?.success === false) {
      return void res.status(502).json({ ok: false, error: "CIBIL report is currently unavailable" });
    }
    return void res.json({ ok: true, score: scoreValue, pdfBase64: null, fileName: null });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/* ─── PAN Quick Check ─────────────────────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/pan
 * Body: { pan }
 * Returns a minimal projection: { ok, panStatus, registeredName, category, aadhaarLinked }.
 */
router.post("/pan", async (req, res) => {
  const schema = z.object({ pan: z.string().min(10).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "pan is required (10 characters)" });
  }
  try {
    const resp = await fetch(`${SUREPASS.BASE_URL}/pan/pan-comprehensive`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify({ id_number: parsed.data.pan.toUpperCase(), masked_aadhaar_variant: "v2" }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    if (!resp.ok || (data as any)?.success === false) {
      return void res.status(502).json({ ok: false, error: "PAN verification is currently unavailable" });
    }
    const pd = (data as any)?.data ?? {};
    return void res.json({
      ok: true,
      panStatus: pd.status ?? pd.pan_status ?? "unknown",
      registeredName: pd.full_name ?? pd.name ?? null,
      category: pd.category ?? null,
      aadhaarLinked: pd.aadhaar_linked ?? pd.aadhaar_seeding_status ?? null,
    });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/* ─── MCA Quick Check ─────────────────────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/mca
 * Body: { cinNumber }
 * Polls Surepass MCA until complete (max ~90 s). Returns a minimal projection
 * (status, entity, document counts, ZIP download) — never raw vendor payloads.
 */
router.post("/mca", async (req, res) => {
  const schema = z.object({ cinNumber: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "cinNumber is required" });
  }
  const { cinNumber } = parsed.data;

  try {
    const createResp = await fetch(`${SUREPASS.BASE_URL}/mca-api/create-order`, {
      method: "POST",
      headers: surepassHeaders(),
      body: JSON.stringify({ entity_id: cinNumber }),
    });
    const createData = (await createResp.json()) as Record<string, unknown>;
    if (!createResp.ok || (createData as any)?.success === false) {
      return void res.status(502).json({ ok: false, error: "MCA order creation failed" });
    }

    const clientId: string | undefined =
      (createData as any)?.data?.client_id ?? (createData as any)?.client_id;
    if (!clientId) {
      return void res.status(502).json({ ok: false, error: "MCA order creation failed" });
    }

    // Poll until complete
    const MAX_POLLS = 15;
    let statusData: any = null;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      const statusResp = await fetch(`${SUREPASS.BASE_URL}/mca-api/status/${clientId}`, {
        headers: surepassHeaders(),
      });
      statusData = await statusResp.json();
      const orderStatus = statusData?.data?.status;
      if (orderStatus === "completed" || orderStatus === "failed" || orderStatus === "error") break;
    }

    const sd = statusData?.data ?? {};
    const orderStatus: string = sd.status ?? "unknown";

    // Try to get ZIP if available
    const zipUrl: string | undefined = sd.zip?.zip_url;
    let zipBase64: string | null = null;
    let zipFileName: string | null = null;
    if (zipUrl) {
      try {
        const zr = await fetch(zipUrl);
        if (zr.ok) {
          zipBase64 = Buffer.from(await zr.arrayBuffer()).toString("base64");
          zipFileName = `mca_${cinNumber}_${Date.now()}.zip`;
        }
      } catch { /* non-fatal */ }
    }

    return void res.json({
      ok: true,
      orderStatus,
      entityName: sd.entity_name,
      cinNumber,
      clientId,
      totalDocuments: sd.total_documents ?? 0,
      completedDocuments: sd.completed_documents ?? 0,
      documents: Array.isArray(sd.documents)
        ? sd.documents.map((d: any) => ({
            name: d?.document_name ?? d?.name ?? null,
            status: d?.status ?? null,
          }))
        : [],
      zipBase64,
      zipFileName,
    });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/* ─── Commercial CIBIL Quick Check ───────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/commercial-cibil
 * Body: { pan, businessName, reportType? }
 * Returns a minimal projection: { ok, fileBase64?, fileName? } — the report file
 * the admin explicitly requested, never the raw vendor payload.
 */
router.post("/commercial-cibil", async (req, res) => {
  const schema = z.object({
    pan:          z.string().min(10).max(10),
    businessName: z.string().min(1),
    reportType:   z.enum(["html", "pdf", "json"]).optional().default("html"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "pan and businessName are required" });
  }
  const { pan, businessName, reportType } = parsed.data;

  try {
    const resp = await fetch(`${FINPASS.BASE_URL}/services/credit-report-commercial/fetch`, {
      method: "POST",
      headers: commCibilHeaders(),
      body: JSON.stringify({ business_name: businessName, pan: pan.toUpperCase(), consent: "Y", report_type: reportType }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    if (!resp.ok || (data as any)?.success === false) {
      return void res.status(502).json({ ok: false, error: "Commercial CIBIL report is currently unavailable" });
    }

    const reportLink: string | undefined =
      (data as any)?.data?.report_url ??
      (data as any)?.data?.html_report_url ??
      (data as any)?.data?.pdf_url ??
      (data as any)?.data?.credit_report_link;

    let fileBase64: string | null = null;
    let fileName: string | null = null;
    if (reportLink) {
      try {
        const fr = await fetch(reportLink);
        if (fr.ok) {
          fileBase64 = Buffer.from(await fr.arrayBuffer()).toString("base64");
          const ext = reportType === "pdf" ? "pdf" : "html";
          fileName = `commercial_cibil_${pan.toUpperCase()}.${ext}`;
        }
      } catch { /* non-fatal */ }
    }

    return void res.json({ ok: true, fileBase64, fileName });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: "Internal error" });
  }
});

/* ─── Account Aggregator Quick Check ──────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/aa
 * Body: { mobile, pan?, name?, consentType? }
 * Initiates an AA consent session directly (no applicant record needed).
 * Returns the consent redirect URL for the customer to complete.
 */
router.post("/aa", async (req, res) => {
  const schema = z.object({
    mobile:      z.string().min(10).max(10),
    pan:         z.string().min(10).max(10).optional(),
    name:        z.string().min(1).optional(),
    consentType: z.enum(["ONETIME", "PERIODIC"]).optional().default("ONETIME"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "mobile (10 digits) is required" });
  }
  const { mobile, pan, name, consentType } = parsed.data;

  try {
    const body: Record<string, string> = {
      mobile_number: mobile,
      consent_type:  consentType,
    };
    if (pan)  body.pan   = pan.toUpperCase();
    if (name) body.email = ""; // placeholder — some providers need it

    const resp = await fetch(`${FINPASS.BASE_URL}/services/account-aggregator/init`, {
      method:  "POST",
      headers: finpassHeaders(),
      body:    JSON.stringify(body),
    });

    const data = await resp.json() as Record<string, unknown>;

    if (!resp.ok || (data as any)?.success === false) {
      return void res.status(502).json({
        ok:    false,
        error: clientErrorMessage(
          new Error((data as any)?.message ?? "AA init failed"),
          "Banking gateway temporarily unavailable. Please try again shortly.",
        ),
      });
    }

    const d = (data as any)?.data ?? data;
    const clientId:    string | undefined = d?.client_id;
    const redirectUrl: string | undefined = d?.redirect_url ?? d?.url ?? d?.consent_url;

    // FINpass sometimes embeds requestId in the redirect URL hash fragment
    let requestId: string | undefined = d?.request_id;
    if (!requestId && redirectUrl) {
      try {
        const hashPart  = redirectUrl.split("#")[1] ?? "";
        const queryPart = hashPart.split("?")[1] ?? "";
        requestId = new URLSearchParams(queryPart).get("requestId") ?? undefined;
      } catch { /* leave undefined */ }
    }

    return void res.json({
      ok: true,
      clientId,
      requestId,
      redirectUrl,
      consentType,
      mobile,
    });
  } catch (err: any) {
    return void res.status(500).json({ ok: false, error: clientErrorMessage(err) });
  }
});

/* ─── BSA Quick Check ─────────────────────────────────────────────────────── */
/**
 * POST /api/admin/quick-check/bsa
 * Body: { fileData (base64 PDF), fileName }
 * Uploads the bank statement PDF, polls for analysis result (max 90 s),
 * and returns the result + XLSX base64 when available.
 */
router.post("/bsa", async (req, res) => {
  const schema = z.object({
    fileData: z.string().min(1),
    fileName: z.string().optional().default("bank_statement.pdf"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: "fileData (base64 PDF) is required" });
  }
  const { fileData: base64 } = parsed.data;

  try {
    const analysis = await analyseStatement(base64);
    const workbook = await analysisWorkbook(analysis);
    res.setHeader("Cache-Control", "no-store");
    return void res.json({
      ok: true, analysis, xlsxBase64: workbook.toString("base64"), xlsxFileName: "Bank_Analysis.xlsx",
    });
  } catch (err: any) {
    return void res.status(err instanceof BankAnalysisError ? err.status : 500).json({
      ok: false, error: err instanceof BankAnalysisError ? err.message : "Bank statement analysis is temporarily unavailable.",
    });
  }
});

export default router;
