import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

export interface BankTransaction {
  date: string; description: string; debit: number; credit: number; balance: number;
}
export interface BankAnalysis {
  version: 1;
  summary: { transactionCount: number; periodStart: string; periodEnd: string; totalCredit: number; totalDebit: number; emiCount: number };
  monthlyAnalysis: { month: string; totalCredit: number; totalDebit: number; averageBalance: number; creditCount: number; debitCount: number }[];
  emiDetails: BankTransaction[];
  transactions: BankTransaction[];
  warnings: string[];
}

export class BankAnalysisError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
const MAX_BYTES = 10 * 1024 * 1024;
let activeWorkers = 0;
const bundleDirectory = path.dirname(fileURLToPath(import.meta.url));
const artifactDirectory = bundleDirectory.endsWith(`${path.sep}dist`)
  ? bundleDirectory
  : path.resolve(bundleDirectory, "../../");

export function decodeStatement(base64: string): Buffer {
  if (base64.length > Math.ceil(MAX_BYTES / 3) * 4) throw new BankAnalysisError("PDF exceeds the 10 MB limit.", 413);
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new BankAnalysisError("Upload a valid PDF file.", 400);
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_BYTES) throw new BankAnalysisError("PDF exceeds the 10 MB limit.", 413);
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new BankAnalysisError("The uploaded file is not a PDF.", 400);
  return bytes;
}

export function analyseTransactions(transactions: BankTransaction[], warnings: string[] = []): BankAnalysis {
  if (!transactions.length) throw new BankAnalysisError("No transactions were extracted.");
  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const cents = (amount: number) => Math.round(amount * 100);
  const monthly = new Map<string, { credit: number; debit: number; balance: number; count: number; creditCount: number; debitCount: number }>();
  let totalCredit = 0, totalDebit = 0;
  for (const row of ordered) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || [row.debit, row.credit, row.balance].some(v => !Number.isFinite(v))) {
      throw new BankAnalysisError("The extracted transaction data is invalid.");
    }
    const month = row.date.slice(0, 7);
    const stats = monthly.get(month) ?? { credit: 0, debit: 0, balance: 0, count: 0, creditCount: 0, debitCount: 0 };
    stats.credit += cents(row.credit); stats.debit += cents(row.debit); stats.balance += cents(row.balance);
    stats.count++; stats.creditCount += row.credit > 0 ? 1 : 0; stats.debitCount += row.debit > 0 ? 1 : 0;
    totalCredit += cents(row.credit); totalDebit += cents(row.debit);
    monthly.set(month, stats);
  }
  const emiDetails = ordered.filter(row => /EMI|Loan|Finance/i.test(row.description));
  return {
    version: 1,
    summary: { transactionCount: ordered.length, periodStart: ordered[0].date, periodEnd: ordered[ordered.length - 1].date, totalCredit: totalCredit / 100, totalDebit: totalDebit / 100, emiCount: emiDetails.length },
    monthlyAnalysis: [...monthly].map(([month, stats]) => ({
      month, totalCredit: stats.credit / 100, totalDebit: stats.debit / 100,
      averageBalance: Math.round(stats.balance / stats.count) / 100,
      creditCount: stats.creditCount, debitCount: stats.debitCount,
    })),
    emiDetails, transactions: ordered, warnings,
  };
}

export async function analyseStatement(base64: string): Promise<BankAnalysis> {
  const bytes = decodeStatement(base64);
  if (activeWorkers >= 2) throw new BankAnalysisError("The analyser is busy. Please retry shortly.", 503);
  activeWorkers++;
  try {
    const extracted = await new Promise<{ transactions: BankTransaction[]; warnings: string[] }>((resolve, reject) => {
      const worker = spawn("python", [path.join(artifactDirectory, "python/bank_statement.py")], {
        env: { PATH: process.env.PATH, LANG: "C.UTF-8", PYTHONPATH: path.join(artifactDirectory, "python-packages"), PYTHONDONTWRITEBYTECODE: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      let length = 0;
      const timer = setTimeout(() => {
        worker.kill("SIGKILL");
        reject(new BankAnalysisError("Analysis reached the five-minute processing limit. Split the statement into smaller periods and retry."));
      }, 300000);
      worker.stdout.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 20 * 1024 * 1024) {
          worker.kill("SIGKILL");
          reject(new BankAnalysisError("Statement has too much extracted data. Try a shorter statement."));
        } else chunks.push(chunk);
      });
      worker.stderr.resume(); // Never log statement content or process environment.
      worker.stdin.on("error", () => {});
      worker.on("error", () => {
        clearTimeout(timer);
        reject(new BankAnalysisError("The analyser is unavailable. Please try again later.", 503));
      });
      worker.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new BankAnalysisError("The analyser could not finish. Try a smaller supported PDF."));
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (!data.ok) return reject(new BankAnalysisError(data.error));
          if (!Array.isArray(data.transactions)) throw new Error("Invalid output");
          resolve(data);
        } catch { reject(new BankAnalysisError("The analyser returned an unreadable result.")); }
      });
      worker.stdin.end(bytes);
    });
    return analyseTransactions(extracted.transactions, extracted.warnings);
  } finally { activeWorkers--; }
}

export async function analysisWorkbook(analysis: BankAnalysis): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Krediflo";
  const monthly = workbook.addWorksheet("Monthly Analysis");
  monthly.columns = [
    { header: "Month", key: "month", width: 14 },
    { header: "Total_Credit", key: "totalCredit", width: 20 },
    { header: "Total_Debit", key: "totalDebit", width: 20 },
    { header: "Average_Balance", key: "averageBalance", width: 22 },
    { header: "Credit_Count", key: "creditCount", width: 18 },
    { header: "Debit_Count", key: "debitCount", width: 18 },
  ];
  monthly.addRows(analysis.monthlyAnalysis);
  [2, 3, 4].forEach(index => { monthly.getColumn(index).numFmt = '#,##0.00;[Red]-#,##0.00'; });
  const emi = workbook.addWorksheet("EMI Details");
  emi.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Description", key: "description", width: 65 },
    { header: "Debit", key: "debit", width: 20 },
    { header: "Credit", key: "credit", width: 20 },
    { header: "Balance", key: "balance", width: 22 },
  ];
  emi.addRows(analysis.emiDetails); // Strings remain strings, never executable spreadsheet formulas.
  [3, 4, 5].forEach(index => { emi.getColumn(index).numFmt = '#,##0.00;[Red]-#,##0.00'; });
  for (const sheet of [monthly, emi]) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1830" } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  }
  monthly.getCell("D1").note = "Mean transaction closing balance; not an average daily balance.";
  emi.getCell("B1").note = "EMI, Loan or Finance narration matches are candidates, not confirmed obligations.";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
