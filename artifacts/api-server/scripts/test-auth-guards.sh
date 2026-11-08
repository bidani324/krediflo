#!/usr/bin/env bash
# Automated authorization-guard tests for the loan API.
#
# Registers two throwaway users against the running dev server and asserts:
#   - anonymous callers get 401 on every guarded customer/admin route
#   - a regular user gets 401 on admin routes
#   - a user cannot read another user's loan/applicant records (404)
#   - the owner can read their own records (200)
#
# Usage: BASE_URL=https://<dev-domain>/api ./scripts/test-auth-guards.sh
set -u

BASE="${BASE_URL:-https://$REPLIT_DEV_DOMAIN/api}"
JA=$(mktemp); JB=$(mktemp)
PASS=0; FAIL=0

check() { # desc expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($3)";
  else FAIL=$((FAIL+1)); echo "FAIL  $1 (expected $2, got $3)"; fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

rand9() { printf '%09d' $(( (RANDOM * 32768 + RANDOM) % 1000000000 )); }
randpan() { # PAN is unique per user — generate a random valid-format one
  tr -dc 'A-Z' </dev/urandom | head -c 5
  printf '%04d' $((RANDOM % 10000))
  tr -dc 'A-Z' </dev/urandom | head -c 1
}

# ── Register two users ────────────────────────────────────────────────────
curl -s -c "$JA" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"firstName\":\"Guard\",\"lastName\":\"TestA\",\"mobile\":\"9$(rand9)\",\"pan\":\"$(randpan)\",\"password\":\"password123\"}" >/dev/null
curl -s -c "$JB" -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"firstName\":\"Guard\",\"lastName\":\"TestB\",\"mobile\":\"8$(rand9)\",\"pan\":\"$(randpan)\",\"password\":\"password123\"}" >/dev/null

# ── User A creates a loan ─────────────────────────────────────────────────
LOAN=$(curl -s -b "$JA" -X POST "$BASE/loans" -H 'Content-Type: application/json' \
  -d '{"loanType":"home","loanAmount":5000000,"tenure":240,"primaryApplicant":{"applicantType":"primary","firstName":"Guard","lastName":"TestA","email":"a@test.com","mobile":"9876543210","pan":"ABCDE1234F"}}')
LID=$(echo "$LOAN" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
AID=$(curl -s -b "$JA" "$BASE/loans/$LID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["applicants"][0]["id"])')
[ -n "$LID" ] || { echo "FATAL: could not create loan"; exit 1; }

# ── Anonymous: all guarded routes must 401 ────────────────────────────────
check "anon GET /loans"                       401 "$(code "$BASE/loans")"
check "anon GET /loans/:id"                   401 "$(code "$BASE/loans/$LID")"
check "anon POST /loans"                      401 "$(code -X POST "$BASE/loans" -H 'Content-Type: application/json' -d '{}')"
check "anon GET /applicants/:id/documents"    401 "$(code "$BASE/applicants/$AID/documents")"
check "anon POST /applicants/:id/fetch-docs"  401 "$(code -X POST "$BASE/applicants/$AID/fetch-docs")"
check "anon GET /admin/dashboard"             401 "$(code "$BASE/admin/dashboard")"
check "anon GET /admin/loans"                 401 "$(code "$BASE/admin/loans")"
check "anon POST /admin/create-application"   401 "$(code -X POST "$BASE/admin/create-application" -H 'Content-Type: application/json' -d '{}')"
check "anon GET /stats/overview"              401 "$(code "$BASE/stats/overview")"

# ── Regular user: admin routes must 401 ──────────────────────────────────
check "user GET /admin/dashboard"             401 "$(code -b "$JA" "$BASE/admin/dashboard")"
check "user GET /admin/loans"                 401 "$(code -b "$JA" "$BASE/admin/loans")"
check "user POST /admin/create-application"   401 "$(code -b "$JA" -X POST "$BASE/admin/create-application" -H 'Content-Type: application/json' -d '{}')"

# ── Cross-user isolation: B must not see A's records ─────────────────────
# (helpers respond 403 for foreign records that exist, 404 for missing ones)
check "user B GET A's loan"                   403 "$(code -b "$JB" "$BASE/loans/$LID")"
check "user B fetch-docs A's applicant"       403 "$(code -b "$JB" -X POST "$BASE/applicants/$AID/fetch-docs")"
check "user B GET A's documents"              403 "$(code -b "$JB" "$BASE/applicants/$AID/documents")"

# ── Vendor verification routes must enforce ownership too ────────────────
check "anon POST surepass/cibil"              401 "$(code -X POST "$BASE/surepass/cibil" -H 'Content-Type: application/json' -d "{\"applicantId\":$AID}")"
check "user B POST surepass/cibil A's applicant" 403 "$(code -b "$JB" -X POST "$BASE/surepass/cibil" -H 'Content-Type: application/json' -d "{\"applicantId\":$AID}")"
check "user B POST surepass/pan A's applicant"   403 "$(code -b "$JB" -X POST "$BASE/surepass/pan" -H 'Content-Type: application/json' -d "{\"applicantId\":$AID}")"
check "user B POST finpass/init A's applicant"   403 "$(code -b "$JB" -X POST "$BASE/finpass/init" -H 'Content-Type: application/json' -d "{\"applicantId\":$AID}")"
check "user B POST finpass/bsa/result A's applicant" 403 "$(code -b "$JB" -X POST "$BASE/finpass/bsa/result" -H 'Content-Type: application/json' -d "{\"applicantId\":$AID}")"
check "user GET surepass/mca/order-list"      401 "$(code -b "$JA" "$BASE/surepass/mca/order-list")"
check "anon POST admin/quick-check/cibil"     401 "$(code -X POST "$BASE/admin/quick-check/cibil")"
check "user POST admin/quick-check/cibil"     401 "$(code -b "$JB" -X POST "$BASE/admin/quick-check/cibil")"

# Response contract: quick-check handlers must never serialize raw vendor payloads.
if grep -q 'raw' "$(dirname "$0")/../src/routes/admin-quick-check.ts" | grep -q 'res\.' 2>/dev/null || \
   grep -E 'res\.(json|send)\(.*raw' "$(dirname "$0")/../src/routes/admin-quick-check.ts" >/dev/null 2>&1; then
  check "quick-check responses contain no raw vendor payloads" clean dirty
else
  check "quick-check responses contain no raw vendor payloads" clean clean
fi
check "anon GET surepass/mca/status"          401 "$(code "$BASE/surepass/mca/status/some-order-id")"
check "user GET surepass/mca/status foreign order" 404 "$(code -b "$JB" "$BASE/surepass/mca/status/some-order-id")"

# Create a document row for A (fetch-docs), then assert download isolation.
curl -s -b "$JA" -X POST "$BASE/applicants/$AID/fetch-docs" >/dev/null
DOCID=$(curl -s -b "$JA" "$BASE/applicants/$AID/documents" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")')
if [ -n "$DOCID" ]; then
  check "anon surepass doc download"          401 "$(code "$BASE/surepass/document/$DOCID/download")"
  check "user B surepass doc download A's doc" 403 "$(code -b "$JB" "$BASE/surepass/document/$DOCID/download")"
  check "user B finpass doc download A's doc"  403 "$(code -b "$JB" "$BASE/finpass/document/$DOCID/download")"
fi

# ── Owner access still works ──────────────────────────────────────────────
check "owner GET own loan"                    200 "$(code -b "$JA" "$BASE/loans/$LID")"
check "owner GET own documents"               200 "$(code -b "$JA" "$BASE/applicants/$AID/documents")"

# Data minimization: customer-facing loan/document reads must not carry raw
# vendor payloads (document `data`) or file blobs.
LOAN_MIN=$(curl -s -b "$JA" "$BASE/loans/$LID" | python3 -c '
import sys, json
body = json.load(sys.stdin)
docs = body.get("documents", [])
bad = [d for d in docs if d.get("data") not in (None, {}) or "fileData" in d]
print("dirty" if bad else "clean")')
check "owner loan read carries no raw vendor doc data" clean "$LOAN_MIN"
DOCS_MIN=$(curl -s -b "$JA" "$BASE/applicants/$AID/documents" | python3 -c '
import sys, json
docs = json.load(sys.stdin)
bad = [d for d in docs if d.get("data") not in (None, {}) or "fileData" in d]
print("dirty" if bad else "clean")')
check "owner documents read carries no raw vendor doc data" clean "$DOCS_MIN"

rm -f "$JA" "$JB"
echo "----------------------------------------"
echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
