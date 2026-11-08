# NexGen Fintech — API-First Loan Aggregator

## Overview

A high-end fintech platform for LAP, Home, Personal, and Business loan applications with automated document procurement via Surepass APIs. Supports user accounts, multiple co-applicants per loan file, and one-click document fetching (CIBIL PDF, PAN Comprehensive, MCA data). Separate admin portal with its own login.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Sessions**: express-session + connect-pg-simple (stored in `user_sessions` table)
- **Auth**: bcryptjs password hashing, HTTP-only session cookies
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Charts**: Recharts
- **Icons**: Lucide React

## Architecture

- `lib/api-spec/openapi.yaml` — OpenAPI contract
- `lib/db/src/schema/` — Drizzle schema (users, admins, loans, applicants, documents)
- `artifacts/api-server/src/routes/` — all backend route handlers
- `artifacts/api-server/src/middleware/auth.ts` — requireUser / requireAdmin middleware
- `artifacts/nexgen-fintech/src/contexts/AuthContext.tsx` — user + admin auth state
- `artifacts/nexgen-fintech/src/pages/` — all frontend pages

## Auth

### User Auth
- `POST /api/auth/register` — register with name, mobile, PAN, address, password
- `POST /api/auth/login` — login with mobile + password
- `POST /api/auth/logout`
- `GET /api/auth/me` — get current user profile

### Admin Auth
- Default credentials: `admin@nexgen.in` / `admin@nexgen123`
- `POST /api/admin/auth/login` — admin login with email + password
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

## Surepass API Proxy (server-side, API key never exposed to browser)

- `POST /api/surepass/cibil` — Fetch CIBIL PDF report (requires `applicantId`)
- `POST /api/surepass/pan` — PAN Comprehensive verification (requires `applicantId`)
- `POST /api/surepass/mca/create-order` — Create MCA document order (requires `applicantId`, `cinNumber`)
- `GET /api/surepass/mca/status/:orderId` — Check MCA order status
- `GET /api/surepass/mca/order-list` — List all MCA orders
- `GET /api/surepass/document/:docId/download` — Download saved PDF (base64 stored in DB)

All Surepass proxy routes require user auth (`requireUser` middleware). The `SUREPASS_TOKEN` secret is only accessible server-side.

## Key Routes (Frontend)

### User-facing
- `/` — Home with EMI calculator, Balance Transfer calculator
- `/login` — Sign in / Create Account (tabs)
- `/apply` — 4-step loan wizard
- `/dashboard` — Shows logged-in user's loans (or all loans if not authenticated)
- `/dashboard/:loanId` — Document Vault with CIBIL / PAN / MCA fetch buttons

### Product Pages (public, no auth required)
- `/home-loan` — Hero + API Status Bar + LBT Calculator (`#balance-transfer` anchor) + Doc Checklist + CTA
- `/lap` — Hero + API Status Bar (MCA highlighted) + LTV Estimator + BT Calculator + Property Types + Doc Checklist + CTA
- `/business-loan` — Hero + API Status Bar + Eligibility Meter (revenue/vintage) + MCA feature cards + Doc Checklist + CTA
- `/personal-loan` — Hero + API Status Bar + Sync & Go 3-step flow + EMI Calculator + Eligibility Meter (salary/employment) + Doc Checklist + CTA

Shared modular blocks: `src/pages/products/ProductBlocks.tsx` exports `ApiStatusBar`, `DocChecklist`, `LBTCalculator`, `LTVEstimator`, `EligibilityMeter`, `SyncProfileCTA`.
Navbar: "Products" dropdown links to all 4 product pages. Home.tsx loan cards now link to product pages instead of /apply.

### Admin
- `/admin/login` — Admin portal login
- `/admin` — Dashboard: stats, charts, recent activity
- `/admin/loans` — Master case file with search + status filter
- `/admin/loans/:loanId` — Full case view with doc status, status updater, export
- `/admin/create` — Manual application creation

## Additional Document Upload (Loan-level)

- `POST /api/loans/:id/uploads` — Upload a file for a loan (user must own loan, or admin; base64 JSON body)
- `GET /api/loans/:id/uploads` — List uploads for a loan (no fileData, metadata only)
- `DELETE /api/loans/:id/uploads/:uploadId` — Delete an upload
- `GET /api/loans/:id/uploads/:uploadId/download` — Download the file (streams as binary)

The `GET /api/loans/:id` response includes an `uploads` array (no fileData).

Frontend: "Additional Documents" section at the bottom of the Document Vault tab in `/loans/:id` and `/admin/loans/:id`. Supports PDF, JPG, PNG, Excel, Word up to 10 MB. Category labels: Bank Statement, Property Papers, IT Returns, Salary Slips, Form 16, Balance Sheet, P&L Statement, Photograph, NOC, Sanction Letter, Other.

## Database Schema

- `users` — portal accounts (name, mobile, pan, address, password_hash)
- `admins` — admin accounts (name, email, password_hash)
- `user_sessions` — PostgreSQL session store (managed by connect-pg-simple)
- `loans` — loan applications linked to userId (nullable for admin-created)
- `applicants` — one or more per loan (primary + co-applicants)
- `loan_uploads` — user/admin-uploaded files per loan (base64 stored in file_data TEXT column)
- `documents` — doc vault: status (pending/fetching/fetched/failed), jsonb data, base64 fileData, fileName

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-server run build` — build API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Important Notes

- Session table (`user_sessions`) must exist in PostgreSQL — created manually, NOT auto-created (connect-pg-simple `createTableIfMissing` doesn't work with esbuild bundling)
- PAN numbers are masked in all user-facing views (e.g. `XXXXX1234F`)
- Documents store the full Surepass API response in `data` (jsonb) and optionally the PDF as base64 in `file_data`
- Surepass CIBIL endpoint: if API returns a `credit_report_link` S3 URL even in error response, the server downloads and stores the PDF automatically
