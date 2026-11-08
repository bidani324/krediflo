import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

export interface BankTxn { date: string; description: string; debit: number; credit: number; balance: number }
export interface BankAnalysis {
  version: 1;
  summary: { transactionCount: number; periodStart: string; periodEnd: string; totalCredit: number; totalDebit: number; emiCount: number };
  monthlyAnalysis: { month: string; totalCredit: number; totalDebit: number; averageBalance: number; creditCount: number; debitCount: number }[];
  emiDetails: BankTxn[];
  transactions: BankTxn[];
  warnings: string[];
}

export function isBankAnalysis(v: unknown): v is BankAnalysis {
  const a = v as BankAnalysis | null | undefined;
  return !!a && typeof a === "object" && a.version === 1 && !!a.summary && Array.isArray(a.monthlyAnalysis) && Array.isArray(a.transactions) && Array.isArray(a.emiDetails);
}

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function fmtDate(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMonth(m: string) {
  const d = new Date(`${m}-01T00:00:00`);
  return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function Stat({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-3 min-w-0" data-testid={id}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono mt-1 break-words">{value}</p>
    </div>
  );
}

function TxnTable({ rows, testid }: { rows: BankTxn[]; testid: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60" data-testid={testid}>
      <table className="w-full text-xs min-w-[560px]">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="text-left p-2 font-medium">Date</th>
            <th className="text-left p-2 font-medium">Narration</th>
            <th className="text-right p-2 font-medium">Debit</th>
            <th className="text-right p-2 font-medium">Credit</th>
            <th className="text-right p-2 font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="p-2 whitespace-nowrap">{fmtDate(t.date)}</td>
              <td className="p-2 max-w-[260px] break-words">{t.description}</td>
              <td className="p-2 text-right font-mono whitespace-nowrap">{t.debit ? inr(t.debit) : "-"}</td>
              <td className="p-2 text-right font-mono whitespace-nowrap">{t.credit ? inr(t.credit) : "-"}</td>
              <td className="p-2 text-right font-mono whitespace-nowrap">{inr(t.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BankAnalysisReport({ analysis, extraWarnings = [] }: { analysis: BankAnalysis; extraWarnings?: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const s = analysis.summary;
  const txns = showAll ? analysis.transactions : analysis.transactions.slice(0, 25);
  const warnings = Array.from(new Set([...(analysis.warnings ?? []), ...extraWarnings]));

  return (
    <div className="space-y-5" data-testid="bank-analysis-report">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat id="stat-period" label="Period" value={`${fmtDate(s.periodStart)} - ${fmtDate(s.periodEnd)}`} />
        <Stat id="stat-transactions" label="Transactions" value={String(s.transactionCount)} />
        <Stat id="stat-emi" label="EMI candidates" value={String(s.emiCount)} />
        <Stat id="stat-credit" label="Total credits" value={inr(s.totalCredit)} />
        <Stat id="stat-debit" label="Total debits" value={inr(s.totalDebit)} />
        <Stat id="stat-net" label="Net flow" value={inr(s.totalCredit - s.totalDebit)} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3" data-testid="bank-analysis-warnings" role="status">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Warnings
          </p>
          <ul className="list-disc pl-5 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <section>
        <h4 className="text-sm font-semibold mb-1">Monthly summary</h4>
        <p className="text-xs text-muted-foreground mb-2">Average balance is the mean of the closing balances on each transaction row, not an average daily balance.</p>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs min-w-[520px]" data-testid="table-monthly">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left p-2 font-medium">Month</th>
                <th className="text-right p-2 font-medium">Credits</th>
                <th className="text-right p-2 font-medium">Debits</th>
                <th className="text-right p-2 font-medium">Avg balance</th>
                <th className="text-right p-2 font-medium">Cr / Dr count</th>
              </tr>
            </thead>
            <tbody>
              {analysis.monthlyAnalysis.map((m) => (
                <tr key={m.month} className="border-t border-border/50">
                  <td className="p-2 whitespace-nowrap font-medium">{fmtMonth(m.month)}</td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{inr(m.totalCredit)}</td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{inr(m.totalDebit)}</td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{inr(m.averageBalance)}</td>
                  <td className="p-2 text-right font-mono whitespace-nowrap">{m.creditCount} / {m.debitCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-1">EMI candidates ({analysis.emiDetails.length})</h4>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>These rows are matched only by the keywords EMI, Loan or Finance in the narration. They are candidates, not confirmed liabilities; verify before use in obligations.</p>
        </div>
        {analysis.emiDetails.length === 0
          ? <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">No narration matched EMI, Loan or Finance.</p>
          : <TxnTable rows={analysis.emiDetails} testid="table-emi" />}
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-2">Transactions ({analysis.transactions.length})</h4>
        <TxnTable rows={txns} testid="table-transactions" />
        {analysis.transactions.length > 25 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-primary underline underline-offset-2 min-h-[44px] md:min-h-0" data-testid="button-toggle-transactions">
            {showAll ? "Show first 25" : `Show all ${analysis.transactions.length}`}
          </button>
        )}
      </section>
    </div>
  );
}

export default BankAnalysisReport;
