import { useState, useRef } from "react";
import { useGetLoan, getGetLoanQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, Loader2, Download,
  RefreshCw, CreditCard, Building2, ChevronDown, ChevronUp,
  User, Calendar, Home, Phone, Paperclip, Trash2, Upload as UploadIcon,
  ExternalLink, Mail, Users, MapPin, Hash, Shield, Info, Landmark, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankStatementAnalyser } from "@/components/BankStatementAnalyser";
import { BankAnalysisReport, isBankAnalysis, type BankAnalysis } from "@/components/BankAnalysisReport";
import { useAuth } from "@/contexts/AuthContext";

type DocType = "cibil_report" | "pan_verification" | "mca_data";

interface DocRecord {
  id: number;
  applicantId: number;
  docType: string;
  status: string;
  data: any;
  fileName: string | null;
  hasFile: boolean;
  fetchedAt: string | null;
}

interface UploadRecord {
  id: number;
  loanId: number;
  docLabel: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByUserId: number | null;
  uploadedAt: string;
}

const UPLOAD_LABELS = [
  "Bank Statement",
  "Property Papers",
  "IT Returns",
  "Salary Slips",
  "Form 16",
  "Balance Sheet",
  "P&L Statement",
  "Photograph",
  "NOC / No Objection Certificate",
  "Sanction Letter",
  "Other",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function callSurepass(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return res.json();
}

function resolveAddress(addr: any): string | undefined {
  if (!addr) return undefined;
  if (typeof addr === "string") return addr || undefined;
  if (typeof addr === "object") {
    const parts = [addr.line_1, addr.line_2, addr.city, addr.state, addr.zip, addr.country];
    const joined = parts
      .filter((v) => v && typeof v === "string")
      .join(", ");
    const full = typeof addr.full === "string" ? addr.full : undefined;
    return (full || joined) || undefined;
  }
  return undefined;
}

function safeStr(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v || undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function PANDetails({ data }: { data: any }) {
  // Surepass wraps response in a `data` envelope
  const d = data?.data ?? data;
  if (!d) return null;

  // Priority fields shown first with icons
  const SKIP_KEYS = new Set([
    "success", "message", "status_code", "response_code",
    "client_id", "task_id", "request_id",
  ]);

  type PanField = { label: string; value: string; icon: React.ElementType };
  const rows: PanField[] = [];

  function addField(label: string, value: any, icon: React.ElementType) {
    const s = safeStr(value);
    if (s) rows.push({ label, value: s, icon });
  }

  addField("Full Name", d.full_name ?? d.name, User);
  addField("Date of Birth", d.dob, Calendar);
  addField("Gender", d.gender, Users);
  addField("Father's Name", d.father_name, User);
  addField("Category", d.category, FileText);
  addField("PAN Status", d.pan_status ?? (d.pan_active != null ? (d.pan_active ? "Active" : "Inactive") : undefined), Shield);
  addField("Mobile", d.mobile, Phone);
  addField("Email", d.email, Mail);
  addField("Masked Aadhaar", d.masked_aadhaar, Hash);
  addField("Aadhaar Seeded", d.aadhaar_seeding_status ?? (d.masked_aadhaar ? "Yes" : undefined), CheckCircle2);
  addField("Is Individual", d.is_individual != null ? (d.is_individual ? "Yes" : "No") : undefined, User);
  addField("Registered Name", d.registered_name, FileText);
  addField("Address", resolveAddress(d.address), MapPin);
  addField("City", d.address?.city ?? d.city, MapPin);
  addField("State", d.address?.state ?? d.state, MapPin);
  addField("Zip Code", d.address?.zip ?? d.zip, MapPin);
  addField("Country", d.address?.country ?? d.country, MapPin);
  addField("Last Updated", d.last_updated ?? d.updated_at, Calendar);

  // Catch-all: any remaining scalar fields not already covered
  const coveredLabels = new Set(rows.map((r) => r.label.toLowerCase()));
  for (const [key, val] of Object.entries(d)) {
    if (SKIP_KEYS.has(key) || typeof val === "object" || val == null || val === "") continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (!coveredLabels.has(label.toLowerCase())) {
      rows.push({ label, value: String(val), icon: Info });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 p-3 bg-muted/40 rounded-lg border border-border/40">
      {rows.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-start gap-2 text-xs">
          <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground w-28 shrink-0">{label}</span>
          <span className="font-medium text-foreground break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

function CIBILDetails({ data }: { data: any }) {
  const d = data?.data ?? data?.raw?.data ?? data;
  if (!d) return null;

  const score = d.cibil_score ?? d.credit_score;
  const fields: { label: string; value: string | undefined }[] = [
    { label: "Score", value: score ? String(score) : undefined },
    { label: "Score Type", value: d.score_type ?? d.credit_score_name },
    { label: "Report Date", value: d.report_date ?? d.creditReportDate },
    { label: "Accounts", value: d.total_accounts ?? d.number_of_accounts ? String(d.total_accounts ?? d.number_of_accounts) : undefined },
    { label: "Active Accounts", value: d.active_accounts ? String(d.active_accounts) : undefined },
    { label: "Enquiries", value: d.total_enquiries != null ? String(d.total_enquiries) : undefined },
  ];

  const visible = fields.filter((f) => f.value);
  if (visible.length === 0) return null;

  const scoreNum = score ? Number(score) : null;
  const scoreColor = scoreNum
    ? scoreNum >= 750 ? "text-cyan-600" : scoreNum >= 650 ? "text-amber-600" : "text-red-600"
    : "text-foreground";

  return (
    <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border/40">
      {scoreNum && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Credit Score</span>
          <span className={`text-2xl font-bold font-mono ${scoreColor}`}>{scoreNum}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {visible.filter((f) => f.label !== "Score").map(({ label, value }) => (
          <div key={label} className="text-xs">
            <span className="text-muted-foreground block">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MCADetails({ data }: { data: any }) {
  if (!data) return null;

  const stage = data.stage ?? "unknown";
  const isPolling = stage === "polling";
  const isCompleted = stage === "completed";

  const fields: { label: string; value: string | undefined }[] = [
    { label: "Order ID", value: data.clientId },
    { label: "CIN", value: data.cinNumber },
    { label: "Company Name", value: data.entityName },
    { label: "Order Status", value: data.orderStatus },
    { label: "Total Docs", value: data.totalDocuments != null ? String(data.totalDocuments) : undefined },
    { label: "Completed", value: data.completedDocuments != null ? String(data.completedDocuments) : undefined },
    { label: "Stage", value: stage },
    ...(!isCompleted && !isPolling ? [
      { label: "Order ID", value: data.createResponse?.data?.client_id },
    ] : []),
  ];

  const visible = fields.filter((f) => f.value);

  return (
    <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border/40 text-xs space-y-2">
      {isPolling && (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Verifying… poll #{data.pollCount}</span>
        </div>
      )}
      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-1.5">
          {visible.map(({ label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">{label}</span>
              <span className="font-medium font-mono break-all">{value}</span>
            </div>
          ))}
        </div>
      )}
      {isCompleted && data.documents?.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <p className="text-muted-foreground mb-1">Documents</p>
          {data.documents.map((doc: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="font-medium">{doc.document_type ?? doc.type ?? `Doc ${i + 1}`}</span>
              <span className={`capitalize ${doc.status === "completed" ? "text-cyan-600" : "text-muted-foreground"}`}>
                — {doc.status}
              </span>
            </div>
          ))}
        </div>
      )}
      {isCompleted && data.zipUrl && (
        <p className="text-cyan-600 dark:text-cyan-400 pt-1 border-t border-border/40">
          ✓ ZIP archive available — use the download button above
        </p>
      )}
      {isCompleted && !data.zipUrl && data.totalDocuments === 0 && (
        <p className="text-amber-600 dark:text-amber-400 pt-1 border-t border-border/40">
          Order completed — no documents found for this CIN. Verify the CIN is correct.
        </p>
      )}
    </div>
  );
}

export default function LoanDetail() {
  const params = useParams();
  const loanId = parseInt(params.loanId || "0");
  const { toast } = useToast();
  const { user } = useAuth();
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [cinInputs, setCinInputs] = useState<Record<number, string>>({});
  // FINpass AA stage state — keyed by applicantId
  const [aaStage, setAaStage] = useState<Record<number, "idle" | "consent" | "fetching" | "done">>({});
  const [commCibilFetching, setCommCibilFetching] = useState<Record<number, boolean>>({});
  const [commCibilBusinessName, setCommCibilBusinessName] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploadLabel, setUploadLabel] = useState("Bank Statement");
  const [uploading, setUploading] = useState(false);
  const [deletingUpload, setDeletingUpload] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: loan, isLoading, refetch } = useGetLoan(loanId, {
    query: { queryKey: getGetLoanQueryKey(loanId), enabled: !!loanId, refetchInterval: 6000 },
  });

  async function handleFetch(applicantId: number, docType: DocType) {
    const key = `${applicantId}-${docType}`;
    setFetching((p) => ({ ...p, [key]: true }));
    try {
      let result: any;
      if (docType === "cibil_report") {
        result = await callSurepass("/api/surepass/cibil", { applicantId });
      } else if (docType === "pan_verification") {
        result = await callSurepass("/api/surepass/pan", { applicantId });
      } else if (docType === "mca_data") {
        const cin = cinInputs[applicantId];
        if (!cin) {
          toast({ title: "CIN required", description: "Enter the Company Identification Number first", variant: "destructive" });
          setFetching((p) => ({ ...p, [key]: false }));
          return;
        }
        result = await callSurepass("/api/surepass/mca/create-order", { applicantId, cinNumber: cin });
      }
      if (result?.ok) {
        toast({ title: "Request sent", description: "Document will update shortly." });
        setTimeout(() => refetch(), 3000);
        setTimeout(() => refetch(), 7000);
      } else {
        toast({ title: "Failed", description: result?.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setFetching((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleCommCibil(applicantId: number, businessName?: string) {
    setCommCibilFetching((p) => ({ ...p, [applicantId]: true }));
    try {
      const res = await fetch("/api/finpass/commercial-cibil", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, businessName: businessName?.trim() || undefined }),
      });
      const result = await res.json();
      if (result?.ok) {
        toast({ title: "Commercial CIBIL requested", description: "Report will appear shortly." });
        setTimeout(() => refetch(), 4000);
        setTimeout(() => refetch(), 9000);
      } else {
        toast({ title: "Failed", description: result?.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCommCibilFetching((p) => ({ ...p, [applicantId]: false }));
    }
  }

  async function downloadFile(url: string, fileName: string) {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        let errMsg = `Server error ${resp.status}`;
        try { const j = await resp.json(); errMsg = j?.error ?? errMsg; } catch { /* ignore */ }
        toast({ title: "Download failed", description: errMsg, variant: "destructive" });
        return;
      }
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch {
      toast({ title: "Download failed", description: "Network error — please try again.", variant: "destructive" });
    }
  }

  function handleDownloadCommCibil(docId: number, fileName: string) {
    downloadFile(`/api/finpass/commercial-cibil/${docId}/download`, fileName);
  }

  function handleDownload(docId: number, fileName: string) {
    downloadFile(`/api/surepass/document/${docId}/download`, fileName);
  }

  function handleDownloadBankStatement(docId: number, fileName: string) {
    downloadFile(`/api/finpass/document/${docId}/download`, fileName);
  }

  async function handleAAInit(applicantId: number) {
    setAaStage((p) => ({ ...p, [applicantId]: "consent" }));
    try {
      const res = await fetch("/api/finpass/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, consentType: "loan_underwriting" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "AA Init failed", description: data.error ?? "Could not initiate consent", variant: "destructive" });
        setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
        return;
      }
      const { redirectUrl } = data;
      toast({ title: "Consent link generated", description: "Share the link with the customer to approve bank data sharing." });
      if (redirectUrl) window.open(redirectUrl, "_blank");
      setTimeout(() => refetch(), 3000);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
    }
  }

  async function handleAAFetchPdf(applicantId: number) {
    setAaStage((p) => ({ ...p, [applicantId]: "fetching" }));
    try {
      const res = await fetch("/api/finpass/fetch-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "Fetch failed", description: data.error ?? "Could not fetch bank statement", variant: "destructive" });
        setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
        return;
      }
      toast({ title: "Bank statement fetch initiated", description: "PDF will appear shortly." });
      setAaStage((p) => ({ ...p, [applicantId]: "done" }));
      setTimeout(() => refetch(), 4000);
      setTimeout(() => refetch(), 9000);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
    }
  }

  async function handleAAFetchJson(applicantId: number) {
    setAaStage((p) => ({ ...p, [applicantId]: "fetching" }));
    try {
      const res = await fetch("/api/finpass/fetch-json", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "JSON fetch failed", description: data.error ?? "Could not fetch JSON report", variant: "destructive" });
        setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
        return;
      }
      toast({ title: "JSON report fetch initiated", description: "Report will appear shortly." });
      setAaStage((p) => ({ ...p, [applicantId]: "done" }));
      setTimeout(() => refetch(), 4000);
      setTimeout(() => refetch(), 9000);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
    }
  }

  async function handleAARefresh(applicantId: number) {
    setAaStage((p) => ({ ...p, [applicantId]: "fetching" }));
    try {
      const res = await fetch("/api/finpass/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast({ title: "Refresh failed", description: data.error ?? "Unknown error", variant: "destructive" });
        setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
        return;
      }
      toast({ title: "Refresh initiated", description: "Updated statement will appear shortly." });
      setAaStage((p) => ({ ...p, [applicantId]: "done" }));
      setTimeout(() => refetch(), 4000);
      setTimeout(() => refetch(), 9000);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setAaStage((p) => ({ ...p, [applicantId]: "idle" }));
    }
  }

  function handleDownloadJson(docId: number, baseName?: string) {
    const fileName = (baseName ?? "bank_statement").replace(/\.pdf$/i, "") + "_report.json";
    downloadFile(`/api/finpass/document/${docId}/download-json`, fileName);
  }

  function handleDownloadBsaResult(docId: number, baseName?: string) {
    const fileName = baseName?.endsWith(".xlsx") ? baseName : "Bank_Analysis.xlsx";
    downloadFile(`/api/finpass/bsa/document/${docId}/download-result`, fileName);
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/loans/${loanId}/uploads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docLabel: uploadLabel,
          fileName: file.name,
          fileData: base64,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast({ title: "Document uploaded", description: `${file.name} saved successfully.` });
      refetch();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteUpload(uploadId: number) {
    setDeletingUpload(uploadId);
    try {
      const res = await fetch(`/api/loans/${loanId}/uploads/${uploadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Document removed" });
      refetch();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingUpload(null);
    }
  }

  function handleDownloadUpload(uploadId: number, fileName: string) {
    const a = document.createElement("a");
    a.href = `/api/loans/${loanId}/uploads/${uploadId}/download`;
    a.download = fileName;
    a.click();
  }

  const maskPan = (pan: string) => {
    if (!pan || pan.length < 10) return pan;
    return `XXXXX${pan.substring(5, 9)}${pan.substring(9)}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-24 w-full mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold">Loan not found</h2>
        <Link href="/dashboard">
          <Button variant="link" className="mt-4">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const docs: DocRecord[] = (loan as any).documents ?? [];

  function getDoc(applicantId: number, docType: DocType): DocRecord | undefined {
    return docs.find((d) => d.applicantId === applicantId && d.docType === docType);
  }

  function DocCard({
    applicantId,
    docType,
    label,
    icon: Icon,
    children,
  }: {
    applicantId: number;
    docType: DocType;
    label: string;
    icon: React.ElementType;
    children?: React.ReactNode;
  }) {
    const doc = getDoc(applicantId, docType);
    const key = `${applicantId}-${docType}`;
    const isProcessing = fetching[key] || doc?.status === "fetching";
    const status = doc?.status ?? "pending";
    const expandKey = `${applicantId}-${docType}-details`;
    const isExpanded = expanded[expandKey];

    const badgeClass =
      status === "fetched" ? "border-cyan-300 text-cyan-700" :
      status === "fetching" ? "border-blue-300 text-blue-700" :
      status === "failed" ? "border-red-300 text-red-700" :
      "border-border text-muted-foreground";

    const iconClass =
      status === "fetched" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" :
      status === "fetching" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
      status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
      "bg-slate-100 text-slate-500 dark:bg-slate-800";

    return (
      <div className="p-4 border border-border/50 rounded-xl bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${iconClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status === "fetched" && doc?.fetchedAt
                  ? `Fetched ${format(new Date(doc.fetchedAt), "MMM dd, HH:mm")}`
                  : status === "fetching" ? "Processing…"
                  : status === "failed" ? "Failed — retry below"
                  : "Not yet fetched"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="outline" className={`text-xs capitalize ${badgeClass}`}>
              {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
              {status}
            </Badge>
            <div className="flex gap-1.5">
              {status === "fetched" && doc?.hasFile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 min-w-[44px] text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                  onClick={() => handleDownload(doc.id, doc.fileName ?? "report.pdf")}
                >
                  <Download className="w-3 h-3" />
                  {doc.fileName?.endsWith(".zip") ? "ZIP" : "PDF"}
                </Button>
              )}
              {status === "fetched" && !doc?.hasFile && (doc?.data?.pdfLink ?? doc?.data?.credit_report_link ?? doc?.data?.report_link) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 min-w-[44px] text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                  onClick={() => window.open(doc.data.pdfLink ?? doc.data.credit_report_link ?? doc.data.report_link, "_blank")}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </Button>
              )}
              {status === "fetched" && doc?.data && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 min-w-[44px] text-xs gap-1"
                  onClick={() => setExpanded((p) => ({ ...p, [expandKey]: !p[expandKey] }))}
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Details
                </Button>
              )}
            </div>
          </div>
        </div>

        {status === "fetched" && isExpanded && (
          docType === "pan_verification" ? <PANDetails data={doc?.data} /> :
          docType === "cibil_report" ? <CIBILDetails data={doc?.data} /> :
          null
        )}

        {children}

        {!isProcessing && (
          <Button
            size="sm"
            variant={status === "fetched" ? "outline" : "default"}
            className="mt-3 w-full h-11 text-xs gap-1.5"
            onClick={() => handleFetch(applicantId, docType)}
          >
            {status === "fetched" ? <RefreshCw className="w-3 h-3" /> : <Download className="w-3 h-3" />}
            {status === "fetched" ? "Re-fetch" : `Fetch ${label}`}
          </Button>
        )}
        {isProcessing && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Fetching via Krediflo Instant Verification Engine…
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Link href="/dashboard">
        <Button variant="ghost" className="mb-6 pl-0 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white uppercase">
              {loan.loanType} LOAN
            </h1>
            <Badge variant="outline" className="text-sm bg-slate-100 dark:bg-slate-800">
              {loan.status.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Application #{loan.id} • Created {format(new Date(loan.createdAt), "MMM dd, yyyy")}
          </p>
        </div>
        <div className="text-left md:text-right p-4 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-100 dark:border-cyan-900/30">
          <p className="text-sm font-medium text-cyan-800 dark:text-cyan-400 mb-1">Requested Amount</p>
          <p className="text-3xl font-bold font-mono text-cyan-700 dark:text-cyan-300">
            ₹{Number(loan.loanAmount).toLocaleString("en-IN")}
          </p>
          <p className="text-sm text-cyan-600 dark:text-cyan-500 mt-1">{loan.tenure} Months Tenure</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 bg-slate-100 dark:bg-slate-900 w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">Overview & Applicants</TabsTrigger>
          <TabsTrigger value="vault" className="flex-1 sm:flex-none">Document Vault</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6">
            {loan.applicants.map((applicant) => (
              <Card key={applicant.id} className="border-border/50">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-border/50 pb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {applicant.firstName} {applicant.lastName}
                        {applicant.applicantType === "primary" && (
                          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white">Primary</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {applicant.email} • {applicant.mobile}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">PAN Number</p>
                      <p className="font-mono font-medium flex items-center gap-2">
                        {maskPan(applicant.pan)}
                        {applicant.panVerified && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">CIBIL Score</p>
                      <p className="font-medium">
                        {applicant.cibilScore ? (
                          <span className={applicant.cibilScore > 750 ? "text-cyan-600" : applicant.cibilScore > 650 ? "text-amber-600" : "text-red-600"}>
                            {applicant.cibilScore}
                          </span>
                        ) : "Pending"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">PAN Verified</p>
                      <p className="font-medium flex items-center gap-2">
                        {applicant.panVerified ? (
                          <><CheckCircle2 className="w-4 h-4 text-cyan-500" /> Yes</>
                        ) : (
                          <><XCircle className="w-4 h-4 text-muted-foreground" /> No</>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">MCA Status</p>
                      <p className="font-medium flex items-center gap-2">
                        {applicant.mcaVerified ? (
                          <><CheckCircle2 className="w-4 h-4 text-cyan-500" /> Verified</>
                        ) : "Pending"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vault">
          {!user && (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-8 text-center mb-6">
              <p className="text-muted-foreground">
                <Link href="/login" className="text-primary underline">Sign in</Link> to fetch and manage documents via the Krediflo Instant Verification Engine.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-10">
            {loan.applicants.map((applicant) => (
              <div key={applicant.id}>
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  {applicant.firstName} {applicant.lastName}
                  {applicant.applicantType === "primary" && (
                    <Badge variant="outline" className="text-xs">Primary</Badge>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocCard
                    applicantId={applicant.id}
                    docType="cibil_report"
                    label="CIBIL Credit Report"
                    icon={CreditCard}
                  />

                  {/* Commercial CIBIL — FINpass */}
                  {(() => {
                    const doc = docs.find((d) => d.applicantId === applicant.id && d.docType === "commercial_cibil");
                    const status = doc?.status ?? "pending";
                    const isWorking = commCibilFetching[applicant.id] || status === "fetching";
                    const badgeClass =
                      status === "fetched" ? "border-indigo-300 text-indigo-700" :
                      status === "fetching" ? "border-blue-300 text-blue-700" :
                      status === "failed" ? "border-red-300 text-red-700" :
                      "border-border text-muted-foreground";
                    const iconClass =
                      status === "fetched" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
                      status === "fetching" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-slate-100 text-slate-500 dark:bg-slate-800";
                    return (
                      <div className="p-4 border border-border/50 rounded-xl bg-card">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-lg shrink-0 ${iconClass}`}>
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Commercial CIBIL</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {status === "fetched" && doc?.fetchedAt
                                  ? `Fetched ${format(new Date(doc.fetchedAt), "MMM dd, HH:mm")}`
                                  : status === "fetching" ? "Processing…"
                                  : status === "failed" ? "Failed — retry"
                                  : "Not yet fetched"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {doc && (
                              <Badge variant="outline" className={`text-xs capitalize ${badgeClass}`}>
                                {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                                {status}
                              </Badge>
                            )}
                            {status === "fetched" && doc?.hasFile && (
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => handleDownloadCommCibil(doc.id, doc.fileName ?? "commercial_cibil.html")}>
                                <Download className="w-3 h-3" />Report
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mb-3">
                          <Label className="text-xs text-muted-foreground mb-1 block">Business / Company Name</Label>
                          <Input
                            className="h-8 text-xs"
                            placeholder={`${applicant.firstName} ${applicant.lastName}`}
                            value={commCibilBusinessName[applicant.id] ?? ""}
                            onChange={(e) => setCommCibilBusinessName((p) => ({ ...p, [applicant.id]: e.target.value }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant={status === "fetched" ? "outline" : "default"}
                          className="w-full h-11 text-xs gap-1.5"
                          disabled={isWorking || !user}
                          onClick={() => handleCommCibil(applicant.id, commCibilBusinessName[applicant.id])}
                        >
                          {isWorking
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : status === "fetched" ? <RefreshCw className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                          {isWorking ? "Fetching…" : status === "fetched" ? "Re-fetch" : "Fetch Commercial CIBIL"}
                        </Button>
                      </div>
                    );
                  })()}

                  <DocCard
                    applicantId={applicant.id}
                    docType="pan_verification"
                    label="PAN Comprehensive"
                    icon={FileText}
                  />

                  {/* Bank Statement via FINpass AA — full width */}
                  {(() => {
                    const doc = docs.find((d) => d.applicantId === applicant.id && d.docType === "bank_statement");
                    const stage = aaStage[applicant.id] ?? "idle";
                    const storedData = doc?.data as Record<string, unknown> | undefined;
                    const hasConsent = !!(storedData?.clientId);
                    const awaitingConsent = !!(storedData?.awaitingConsent);
                    const storedRedirectUrl = storedData?.redirectUrl as string | undefined;
                    const docStatus = doc?.status ?? "pending";
                    const hasPdf = docStatus === "fetched" && doc?.hasFile;
                    const hasJson = !!(storedData?.jsonReport);
                    const isWorking = stage === "consent" || stage === "fetching" || docStatus === "fetching";
                    const badgeClass =
                      docStatus === "fetched" ? "border-cyan-300 text-cyan-700" :
                      docStatus === "fetching" ? "border-blue-300 text-blue-700" :
                      docStatus === "failed" ? "border-red-300 text-red-700" :
                      awaitingConsent ? "border-amber-300 text-amber-700" :
                      "border-border text-muted-foreground";

                    return (
                      <div className="p-4 border border-border/50 rounded-xl bg-card md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2.5 rounded-lg ${
                            docStatus === "fetched" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" :
                            docStatus === "fetching" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            docStatus === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          }`}>
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">Bank Statement</p>
                            <p className="text-xs text-muted-foreground">
                              Via Krediflo Secure Banking Gateway — RBI-regulated, customer-consented
                            </p>
                          </div>
                          {(docStatus !== "pending" || awaitingConsent) && (
                            <Badge variant="outline" className={`text-xs shrink-0 ${badgeClass}`}>
                              {docStatus === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                              {awaitingConsent && docStatus === "pending" ? "Awaiting Consent" : docStatus}
                            </Badge>
                          )}
                        </div>

                        {/* Awaiting consent banner */}
                        {awaitingConsent && docStatus !== "fetched" && (
                          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Awaiting customer consent</p>
                              <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                                The customer must approve data sharing on the AA portal. Once approved, click Fetch PDF or Fetch JSON below.
                              </p>
                              {storedRedirectUrl && (
                                <button
                                  className="mt-1.5 text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  onClick={() => window.open(storedRedirectUrl, "_blank")}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open consent link
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Step 1 — Initiate consent */}
                        {docStatus !== "fetched" && (
                          <div className="mb-3 p-3 bg-muted/40 rounded-lg border border-border/40">
                            <p className="text-xs font-medium mb-2 text-slate-700 dark:text-slate-300">
                              Step 1 — Initiate consent request
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Generates a consent link using the applicant's mobile number. The customer clicks it to approve sharing their bank data.
                            </p>
                            <Button
                              size="sm"
                              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
                              disabled={isWorking || !user}
                              onClick={() => handleAAInit(applicant.id)}
                            >
                              {stage === "consent" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="w-3.5 h-3.5" />
                              )}
                              {hasConsent ? "Re-initiate Consent" : "Initiate Consent"}
                            </Button>
                          </div>
                        )}

                        {/* Step 2 — Fetch PDF / JSON */}
                        {hasConsent && (
                          <div className="mb-3 p-3 bg-muted/40 rounded-lg border border-border/40">
                            <p className="text-xs font-medium mb-2 text-slate-700 dark:text-slate-300">
                              Step 2 — Fetch bank statement
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              After the customer approves consent, fetch the PDF and/or JSON report.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                                disabled={isWorking || !user}
                                onClick={() => handleAAFetchPdf(applicant.id)}
                              >
                                {stage === "fetching" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                Fetch PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                disabled={isWorking || !user}
                                onClick={() => handleAAFetchJson(applicant.id)}
                              >
                                {stage === "fetching" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5" />
                                )}
                                Fetch JSON
                              </Button>
                              {(hasPdf || hasJson) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                                  disabled={isWorking || !user}
                                  onClick={() => handleAARefresh(applicant.id)}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Refresh
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Downloads row */}
                        {(hasPdf || hasJson) && (
                          <div className="flex items-center gap-3 p-3 bg-cyan-50/60 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800">
                            <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-cyan-700 dark:text-cyan-400">Bank statement saved</p>
                              {doc?.fileName && <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>}
                              {doc?.fetchedAt && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(doc.fetchedAt), "dd MMM yyyy, HH:mm")}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {hasPdf && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                  onClick={() => handleDownloadBankStatement(doc!.id, doc!.fileName ?? "bank_statement.pdf")}
                                >
                                  <Download className="w-3 h-3" />
                                  PDF
                                </Button>
                              )}
                              {hasJson && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleDownloadJson(doc!.id, doc?.fileName ?? undefined)}
                                >
                                  <FileText className="w-3 h-3" />
                                  JSON
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        {docStatus === "failed" && !awaitingConsent && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                            Fetch failed — please retry or contact support.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* BSA Analyser — full width */}
                  {(() => {
                    const aadoc = docs.find((d) => d.applicantId === applicant.id && d.docType === "bank_statement");
                    const hasFetchedPdf = aadoc?.status === "fetched" && aadoc?.hasFile;
                    const bsaDoc = docs.find((d) => d.applicantId === applicant.id && d.docType === "bsa_analysis");
                    const bsaData = bsaDoc?.data as Record<string, any> | undefined;
                    const bsaResult = bsaData?.bsaResult;
                    const hasAnalysis = isBankAnalysis(bsaResult);
                    const bsaStatus = bsaDoc?.status ?? "pending";
                    return (
                      <div className="p-4 border border-border/50 rounded-xl bg-card md:col-span-2" data-testid={`block-bsa-${applicant.id}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2.5 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"><BarChart2 className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">Statement Analysis</p>
                            <p className="text-xs text-muted-foreground">Upload a PDF bank statement{hasFetchedPdf ? " or analyse the fetched AA statement" : ""}.</p>
                          </div>
                          {bsaDoc && <Badge variant="outline" className="ml-auto text-xs capitalize">{bsaStatus}</Badge>}
                        </div>
                        <BankStatementAnalyser
                          idPrefix={`bsa-${applicant.id}`}
                          endpoint="/api/finpass/bsa/upload"
                          extraBody={{ applicantId: applicant.id }}
                          storedLabel={hasFetchedPdf ? "Analyse AA statement" : undefined}
                          disabled={!user}
                          onComplete={() => { refetch(); }}
                        />
                        {bsaStatus === "failed" && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-3" role="alert">Last analysis failed{bsaData?.error ? `: ${bsaData.error}` : ""}. Upload the statement again.</p>
                        )}
                        {bsaDoc && bsaStatus === "fetched" && !hasAnalysis && bsaDoc.hasFile && (
                          <div className="mt-3 flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/40">
                            <p className="text-xs flex-1">An earlier result is available as a spreadsheet. Re-upload the statement for the new in-house analysis.</p>
                            <Button size="sm" variant="outline" onClick={() => handleDownloadBsaResult(bsaDoc.id, bsaDoc.fileName ?? undefined)}>Download XLSX</Button>
                          </div>
                        )}
                        {hasAnalysis && bsaDoc && (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                              <p className="text-xs text-muted-foreground">
                                {bsaData?.fileName ? `${bsaData.fileName} - ` : ""}{bsaDoc.fetchedAt ? format(new Date(bsaDoc.fetchedAt), "dd MMM yyyy, HH:mm") : ""}
                              </p>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadBsaResult(bsaDoc.id, bsaDoc.fileName ?? undefined)}>Download XLSX</Button>
                            </div>
                            <BankAnalysisReport analysis={bsaResult as BankAnalysis} extraWarnings={Array.isArray(bsaData?.warnings) ? bsaData.warnings : []} />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* MCA — full-width, custom layout */}
                  <div className="p-4 border border-border/50 rounded-xl bg-card md:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">MCA Company Documents</p>
                        <p className="text-xs text-muted-foreground">For business / LAP loans — enter Company CIN</p>
                      </div>
                      {(() => {
                        const doc = getDoc(applicant.id, "mca_data");
                        const status = doc?.status ?? "pending";
                        const badgeClass =
                          status === "fetched" ? "border-cyan-300 text-cyan-700" :
                          status === "fetching" ? "border-blue-300 text-blue-700" :
                          status === "failed" ? "border-red-300 text-red-700" :
                          "border-border text-muted-foreground";
                        return status !== "pending" ? (
                          <Badge variant="outline" className={`ml-auto text-xs capitalize ${badgeClass}`}>
                            {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                            {status}
                          </Badge>
                        ) : null;
                      })()}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          CIN / LLPIN Number
                          <span className="ml-1 font-normal text-muted-foreground/70">(companies or LLPs)</span>
                        </Label>
                        <Input
                          placeholder="Company CIN: U72200MH2010PTC123456  |  LLP: AAA-0001"
                          value={cinInputs[applicant.id] ?? ""}
                          onChange={(e) => setCinInputs((p) => ({ ...p, [applicant.id]: e.target.value }))}
                          className="h-11 text-sm font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Enter CIN for registered companies or LLPIN for Limited Liability Partnerships.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="self-end h-11 gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                        disabled={fetching[`${applicant.id}-mca_data`] || !user}
                        onClick={() => handleFetch(applicant.id, "mca_data")}
                      >
                        {fetching[`${applicant.id}-mca_data`] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5" />
                        )}
                        Create Order
                      </Button>
                    </div>

                    {(() => {
                      const doc = getDoc(applicant.id, "mca_data");
                      if (!doc || doc.status === "pending") return null;
                      return <MCADetails data={doc.data} />;
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Additional Documents Upload ── */}
          {(() => {
            const loanUploads: UploadRecord[] = (loan as any).uploads ?? [];
            return (
              <div className="mt-10 border-t border-border/40 pt-8">
                <div className="flex items-center gap-2 mb-5">
                  <Paperclip className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Additional Documents
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    — bank / NBFC requested files
                  </span>
                </div>

                {user ? (
                  <div className="p-4 rounded-xl border border-dashed border-cyan-300 dark:border-cyan-700 bg-cyan-50/30 dark:bg-cyan-900/10 mb-5">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Document Category
                        </Label>
                        <select
                          value={uploadLabel}
                          onChange={(e) => setUploadLabel(e.target.value)}
                          className="h-11 w-full px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          {UPLOAD_LABELS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.doc,.docx,.csv"
                          onChange={handleUploadFile}
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          variant="outline"
                          className="h-11 gap-2 border-cyan-400 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
                        >
                          {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UploadIcon className="w-4 h-4" />
                          )}
                          {uploading ? "Uploading…" : "Choose & Upload"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Accepted: PDF, JPG, PNG, Excel, Word · Max 10 MB per file
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center mb-5">
                    <p className="text-sm text-muted-foreground">
                      <Link href="/login" className="text-primary underline">Sign in</Link> to upload additional documents.
                    </p>
                  </div>
                )}

                {loanUploads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-1">
                    No additional documents uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {loanUploads.map((up) => (
                      <div
                        key={up.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                      >
                        <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{up.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {up.docLabel} · {formatFileSize(up.fileSize)} ·{" "}
                            {format(new Date(up.uploadedAt), "dd MMM yyyy, HH:mm")}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11 min-w-[44px] text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400"
                            onClick={() => handleDownloadUpload(up.id, up.fileName)}
                          >
                            <Download className="w-3 h-3" /> Download
                          </Button>
                          {user && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-11 w-11 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              disabled={deletingUpload === up.id}
                              onClick={() => handleDeleteUpload(up.id)}
                            >
                              {deletingUpload === up.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
