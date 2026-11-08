/**
 * @fileoverview Central constants registry for the Krediflo frontend.
 *
 * All hardcoded literals — API endpoints, numeric thresholds, domain-specific
 * values, and UI configuration — are declared here so that:
 *   1. Changes propagate automatically to every consumer.
 *   2. Developers understand *why* a value exists (see inline comments).
 *   3. TypeScript `as const` assertions provide narrow literal types throughout.
 *
 * Import pattern:
 *   import { API_ROUTES, LOAN_RATES, LOAN_STATUS } from "@/config/constants";
 */

/* ─── API Route Constants ─────────────────────────────────────────────────── */

/**
 * Canonical REST endpoint strings for all server routes consumed by the
 * frontend.  Keeping these in one place ensures no typos creep in and makes
 * mass-renames trivially safe.
 */
export const API_ROUTES = {
  /* User auth */
  USER_ME:       "/api/auth/me",
  USER_LOGIN:    "/api/auth/login",
  USER_REGISTER: "/api/auth/register",
  USER_LOGOUT:   "/api/auth/logout",

  /* Admin auth */
  ADMIN_ME:      "/api/admin/auth/me",
  ADMIN_LOGIN:   "/api/admin/auth/login",
  ADMIN_LOGOUT:  "/api/admin/auth/logout",

  /* Loan resources */
  LOANS:         "/api/loans",

  /* Surepass KYC proxies (server never exposes the token to the browser) */
  SUREPASS_CIBIL:     "/api/surepass/cibil",
  SUREPASS_PAN:       "/api/surepass/pan",
  SUREPASS_MCA_ORDER: "/api/surepass/mca/create-order",
} as const;

/* ─── Responsive Breakpoints ──────────────────────────────────────────────── */

/**
 * Pixel breakpoints that mirror the Tailwind CSS `screens` config.
 * Keeping them co-located prevents the classic bug where a JS media query
 * fires at a different width than the CSS breakpoint.
 *
 * Tailwind defaults (from tailwind.config.ts):
 *   sm → 640 px  |  md → 768 px  |  lg → 1024 px  |  xl → 1280 px
 */
export const BREAKPOINTS = {
  MOBILE:  768,   // Below this width → mobile layout (`useIsMobile`)
  TABLET:  1024,
  DESKTOP: 1280,
} as const;

/* ─── Toast UI Configuration ──────────────────────────────────────────────── */

/**
 * Global settings for the Sonner-compatible toast notification system.
 *
 * `REMOVE_DELAY_MS` is intentionally very long (~16 minutes).  The Shadcn UI
 * toast implementation uses an in-memory queue; toasts are dismissed manually
 * by the user or programmatically via `dismiss()`.  The delay is a safety net
 * to avoid stale entries accumulating in the listener array if a component
 * unmounts without cleaning up.
 */
export const TOAST_CONFIG = {
  /** Maximum number of toasts visible simultaneously. */
  LIMIT: 1,
  /** Milliseconds before a dismissed toast is fully removed from state. */
  REMOVE_DELAY_MS: 1_000_000,
} as const;

/* ─── Loan Product Interest Rates ────────────────────────────────────────── */

/**
 * Indicative starting interest rates (% per annum) for each loan product.
 * Used in product page heroes, EMI calculators, and balance-transfer tools.
 * Update here when bank partner rates change — all UI stays in sync.
 */
export const LOAN_RATES = {
  HOME:     8.40,   // Home Loan
  LAP:      9.00,   // Loan Against Property
  PERSONAL: 10.50,  // Personal Loan
  BUSINESS: 11.00,  // Business Loan
} as const;

/* ─── Loan Status Enum ────────────────────────────────────────────────────── */

/**
 * Mirrors the `loan_status` PostgreSQL enum defined in `lib/db/src/schema/loans.ts`.
 * Using this constant on the frontend prevents string-comparison bugs (e.g.
 * comparing "Under Review" to "under_review") and provides IntelliSense.
 */
export const LOAN_STATUS = {
  DRAFT:        "draft",
  SUBMITTED:    "submitted",
  DOCS_PROCURED:"docs_procured",
  UNDER_REVIEW: "under_review",
  SENT_TO_BANK: "sent_to_bank",
  APPROVED:     "approved",
  REJECTED:     "rejected",
} as const;

/** Union type of all possible loan status string values. */
export type LoanStatus = (typeof LOAN_STATUS)[keyof typeof LOAN_STATUS];

/**
 * Human-readable labels for each `LoanStatus` value.
 * Used in badge components, filter dropdowns, and admin tables.
 */
export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  draft:        "Draft",
  submitted:    "Submitted",
  docs_procured:"Docs Procured",
  under_review: "Under Review",
  sent_to_bank: "Sent to Bank",
  approved:     "Approved",
  rejected:     "Rejected",
};

/* ─── Loan Type Enum ──────────────────────────────────────────────────────── */

/**
 * Mirrors the `loan_type` PostgreSQL enum from the DB schema.
 * Prevents raw string comparisons scattered across components.
 */
export const LOAN_TYPE = {
  LAP:      "lap",
  HOME:     "home",
  PERSONAL: "personal",
  BUSINESS: "business",
} as const;

/** Union type of all possible loan type string values. */
export type LoanType = (typeof LOAN_TYPE)[keyof typeof LOAN_TYPE];

/* ─── Document Types ──────────────────────────────────────────────────────── */

/**
 * Mirrors the `doc_type` PostgreSQL enum from `lib/db/src/schema/documents.ts`.
 * Used when checking document fetch status in the Document Vault UI.
 */
export const DOC_TYPE = {
  CIBIL:         "cibil_report",
  PAN:           "pan_verification",
  MCA:           "mca_data",
  BANK_STATEMENT:"bank_statement",
  FORM_16:       "form_16",
  ITR:           "itr",
} as const;

/* ─── File Upload Constraints ─────────────────────────────────────────────── */

/**
 * Maximum allowed file size for the "Additional Documents" upload feature
 * on the Document Vault page.  Must match `MAX_FILE_BYTES` in the API server's
 * upload route validation schema to prevent client/server disagreements.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB

/**
 * MIME types accepted by the document upload input.
 * Displayed as a hint in the file picker dialog.
 */
export const UPLOAD_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
