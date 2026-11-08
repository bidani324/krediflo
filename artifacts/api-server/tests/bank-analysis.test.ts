import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { analyseStatement, analyseTransactions, analysisWorkbook, decodeStatement } from "../src/lib/bank-analysis";
import { customerDocumentData } from "../src/lib/customer-document-data";

const rows = [
  { date: "2026-01-01", description: "Salary", credit: 50000, debit: 0, balance: 60000 },
  { date: "2026-01-05", description: "Home Loan EMI", credit: 0, debit: 12500, balance: 47500 },
  { date: "2026-01-25", description: "Groceries", credit: 0, debit: 1250.5, balance: 46249.5 },
  { date: "2026-02-01", description: "Salary", credit: 50000, debit: 0, balance: 96249.5 },
  { date: "2026-02-02", description: "Finance EMI", credit: 0, debit: 2000, balance: 94249.5 },
];

test("monthly totals, positive counts and transaction-balance averages match reference", () => {
  const analysis = analyseTransactions(rows);
  assert.deepEqual(analysis.monthlyAnalysis, [
    { month: "2026-01", totalCredit: 50000, totalDebit: 13750.5, averageBalance: 51249.83, creditCount: 1, debitCount: 2 },
    { month: "2026-02", totalCredit: 50000, totalDebit: 2000, averageBalance: 95249.5, creditCount: 1, debitCount: 1 },
  ]);
  assert.equal(analysis.summary.emiCount, 2);
  assert.equal(analysis.summary.totalCredit, 100000);
  assert.equal(analysis.summary.totalDebit, 15750.5);
});

test("owned customer report metadata is available without exposing raw verification/vendor data", () => {
  const report = analyseTransactions(rows);
  const value = { source: "in_house", bsaResult: report, fileName: "Statement.pdf", warnings: [], raw: { secret: "not public" } };
  assert.equal(customerDocumentData("bsa_analysis", value)?.bsaResult, report);
  assert.equal(customerDocumentData("bsa_analysis", value)?.raw, undefined);
  assert.equal(customerDocumentData("bank_statement", value), null);
  assert.equal(customerDocumentData("cibil_report", value), null);
  assert.equal(customerDocumentData("bsa_analysis", { source: "vendor", raw: "private" }), null);
});
test("case-insensitive EMI/Loan/Finance matches retain credit candidates as in reference", () => {
  const analysis = analyseTransactions([{ date: "2026-01-01", description: "loan DISBURSEMENT", credit: 0.3, debit: 0.1, balance: -10 }]);
  assert.equal(analysis.emiDetails.length, 1);
  assert.equal(analysis.monthlyAnalysis[0].averageBalance, -10);
});

test("invalid and oversized uploads fail explicitly", () => {
  assert.throws(() => decodeStatement("not-base64"), /valid PDF/);
  assert.throws(() => decodeStatement(Buffer.from("not a PDF").toString("base64")), /not a PDF/);
  assert.throws(() => decodeStatement("A".repeat(14 * 1024 * 1024)), /10 MB/);
});

test("workbook has exact reference sheets, numeric values, safe string narrations", async () => {
  const analysis = analyseTransactions([...rows, { date: "2026-02-03", description: "=EMI()", debit: 10, credit: 0, balance: 94239.5 }]);
  const buffer = await analysisWorkbook(analysis);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  assert.deepEqual(workbook.worksheets.map(s => s.name), ["Monthly Analysis", "EMI Details"]);
  assert.equal(workbook.getWorksheet("Monthly Analysis")!.getCell("B2").value, 50000);
  assert.equal(workbook.getWorksheet("Monthly Analysis")!.getCell("D2").value, 51249.83);
  assert.equal(workbook.getWorksheet("EMI Details")!.getCell("B4").value, "=EMI()");
});

test("real PDF subprocess extraction produces expected completed report", async () => {
  const pdf = await readFile("/tmp/bank-statement-tests/synthetic-statement.pdf");
  const analysis = await analyseStatement(pdf.toString("base64"));
  assert.deepEqual(analysis.transactions, rows);
  assert.equal(analysis.summary.emiCount, 2);
});

test("signed Debit/Credit header-only grid works through the production worker", async () => {
  const pdf = await readFile("/tmp/bank-statement-tests/synthetic-signed.pdf");
  const analysis = await analyseStatement(pdf.toString("base64"));
  assert.equal(analysis.summary.transactionCount, 2);
  assert.equal(analysis.summary.totalDebit, 3500);
  assert.equal(analysis.summary.totalCredit, 1000);
  assert.equal(analysis.transactions[0].description, "Synthetic transfer continued narration");
});

test("150-page statement includes the final transaction through the production worker", async () => {
  const pdf = await readFile("/tmp/bank-statement-tests/synthetic-long.pdf");
  const analysis = await analyseStatement(pdf.toString("base64"));
  assert.equal(analysis.summary.transactionCount, 150);
  assert.equal(analysis.summary.totalDebit, 150);
  assert.equal(analysis.transactions.at(-1)?.balance, 850);
  assert.equal(analysis.monthlyAnalysis[0].averageBalance, 924.5);
});

test("vertical-only transaction grid preserves same-day rows, narration and printed balances", async () => {
  const pdf = await readFile("/tmp/bank-statement-tests/synthetic-vertical.pdf");
  const analysis = await analyseStatement(pdf.toString("base64"));
  assert.equal(analysis.summary.transactionCount, 3);
  assert.equal(analysis.summary.totalDebit, 110);
  assert.equal(analysis.summary.totalCredit, 50);
  assert.equal(analysis.summary.emiCount, 1);
  assert.equal(analysis.transactions[0].description, "Loan repayment continued reference");
  assert.equal(analysis.transactions.at(-1)?.balance, 940);
});

test("scanned PDFs return a clear error rather than an empty workbook", async () => {
  const pdf = await readFile("/tmp/bank-statement-tests/scanned-statement.pdf");
  await assert.rejects(analyseStatement(pdf.toString("base64")), /Scanned/);
});
