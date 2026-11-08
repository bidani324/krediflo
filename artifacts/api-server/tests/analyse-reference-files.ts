/**
 * Local, explicit analysis/export of PDFs supplied as command-line arguments.
 * Does not write to customer records or log transaction narrations/account data.
 */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { analyseStatement, analysisWorkbook } from "../src/lib/bank-analysis";

const [outputDirectory, ...files] = process.argv.slice(2);
if (!outputDirectory || !files.length) throw new Error("Usage: analyse-reference-files <output-directory> <pdf>...");
await mkdir(outputDirectory, { recursive: true });
for (const [index, filename] of files.entries()) {
  const analysis = await analyseStatement((await readFile(filename)).toString("base64"));
  const first = analysis.transactions[0], last = analysis.transactions.at(-1)!;
  const openingBalance = Math.round((first.balance - first.credit + first.debit) * 100) / 100;
  assert.equal(
    Math.round((openingBalance + analysis.summary.totalCredit - analysis.summary.totalDebit) * 100),
    Math.round(last.balance * 100),
    "Opening balance + credits - debits must equal the final balance",
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await analysisWorkbook(analysis) as any);
  // Reference exports add a traceable full ledger, without changing website exports.
  const transactions = workbook.addWorksheet("Transactions");
  transactions.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Description", key: "description", width: 80 },
    { header: "Debit", key: "debit", width: 20 },
    { header: "Credit", key: "credit", width: 20 },
    { header: "Balance", key: "balance", width: 22 },
  ];
  transactions.addRows(analysis.transactions);
  [3, 4, 5].forEach(column => { transactions.getColumn(column).numFmt = "#,##0.00;[Red]-#,##0.00"; });
  transactions.getRow(1).font = { bold: true };
  transactions.views = [{ state: "frozen", ySplit: 1 }];
  transactions.autoFilter = `A1:E${transactions.rowCount}`;
  const output = path.join(outputDirectory, `Statement_${index + 1}_Analysis.xlsx`);
  await writeFile(output, Buffer.from(await workbook.xlsx.writeBuffer()));
  console.log(JSON.stringify({
    statement: index + 1, output, ...analysis.summary, openingBalance, closingBalance: last.balance,
    warnings: analysis.warnings,
  }));
}
