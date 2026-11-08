import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BankAnalysisReport, isBankAnalysis, type BankAnalysis } from "@/components/BankAnalysisReport";

const MAX_BYTES = 10 * 1024 * 1024;

export interface AnalyserResponse {
  ok: true;
  analysis: BankAnalysis;
  docId?: number;
  message?: string;
  xlsxBase64?: string;
  xlsxFileName?: string;
}

interface Props {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  /** Offer analysing a stored AA PDF (omits fileData) */
  storedLabel?: string;
  showReport?: boolean;
  disabled?: boolean;
  idPrefix: string;
  onComplete?: (res: AnalyserResponse) => void;
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

export function downloadXlsx(base64: string, name: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function BankStatementAnalyser({ endpoint, extraBody, storedLabel, showReport = false, disabled, idPrefix, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"file" | "stored" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyserResponse | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isPdf) { setError("Only text-based PDF bank statements are supported."); return; }
    if (f.size > MAX_BYTES) { setError("This PDF is larger than 10 MB. Upload a smaller statement."); return; }
    setFile(f); setError(null); setResult(null); setDone(null);
  }

  async function run(mode: "file" | "stored") {
    if (mode === "file" && !file) return;
    setBusy(mode); setError(null); setDone(null);
    if (mode === "file") setResult(null);
    try {
      const body: Record<string, unknown> = { ...(extraBody ?? {}) };
      if (mode === "file" && file) { body.fileData = await toBase64(file); body.fileName = file.name; }
      const resp = await fetch(endpoint, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: any = null;
      try { data = await resp.json(); } catch { /* non-json */ }
      if (!resp.ok || !data?.ok || !isBankAnalysis(data.analysis)) {
        setError(data?.error ?? (resp.status === 413 ? "The PDF is too large." : resp.status === 503 ? "The analyser is busy. Try again shortly." : "The statement could not be analysed."));
        return;
      }
      setResult(data as AnalyserResponse);
      setDone(`Analysed ${data.analysis.summary.transactionCount} transactions.`);
      onComplete?.(data as AnalyserResponse);
    } catch (e: any) {
      setError(e?.message ?? "Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const working = busy !== null;
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={working || disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-border rounded-xl p-5 text-center hover:bg-accent/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[88px]"
        data-testid={`button-${idPrefix}-choose-pdf`}
      >
        {file ? <FileText className="w-6 h-6 mx-auto mb-1.5 text-primary" /> : <Upload className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />}
        <span className="block text-sm font-medium truncate">{file ? file.name : "Choose a PDF statement"}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">
          {file ? `${(file.size / 1024).toFixed(0)} KB - tap to replace` : "Text-based, unlocked PDF up to 10 MB. No fixed page-count limit; up to 20,000 transactions. Scanned or password-protected files are not supported."}
        </span>
      </button>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={pick} data-testid={`input-${idPrefix}-file`} />

      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1 btn-flow" disabled={!file || working || disabled} onClick={() => run("file")} data-testid={`button-${idPrefix}-analyse`}>
          {busy === "file" ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing statement...</> : "Analyse statement"}
        </Button>
        {storedLabel && (
          <Button variant="outline" className="flex-1" disabled={working || disabled} onClick={() => run("stored")} data-testid={`button-${idPrefix}-analyse-stored`}>
            {busy === "stored" ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</> : storedLabel}
          </Button>
        )}
      </div>

      <div aria-live="polite">
        {working && <p className="text-xs text-muted-foreground">Reading the PDF and extracting transactions. Long statements can take several minutes; keep this page open.</p>}
        {error && !working && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300" data-testid={`text-${idPrefix}-error`}>
            <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {done && !working && !error && (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 dark:bg-cyan-900/10 p-3 text-xs text-cyan-800 dark:text-cyan-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {done}
          </div>
        )}
      </div>

      {showReport && result && !working && (
        <div className="pt-2 space-y-3">
          {result.xlsxBase64 && (
            <Button size="sm" variant="outline" onClick={() => downloadXlsx(result.xlsxBase64!, result.xlsxFileName ?? "bank_statement_analysis.xlsx")} data-testid={`button-${idPrefix}-xlsx`}>
              Download analysis (XLSX)
            </Button>
          )}
          <BankAnalysisReport analysis={result.analysis} />
        </div>
      )}
    </div>
  );
}

export default BankStatementAnalyser;
