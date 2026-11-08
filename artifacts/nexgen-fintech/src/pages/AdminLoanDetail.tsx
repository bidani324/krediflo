import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  useGetLoan,
  useUpdateLoanStatus,
  getGetLoanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Download, RefreshCw, CheckCircle2, XCircle, Clock,
  Loader2, User, FileText, Shield, Building2, CreditCard, Banknote,
  ChevronDown, ChevronUp, Phone, Mail, MapPin, Calendar, Hash,
  Paperclip, Trash2, Upload, ExternalLink, Landmark, Info, BarChart2,
} from "lucide-react";
import { BankStatementAnalyser } from "@/components/BankStatementAnalyser";
import { BankAnalysisReport, isBankAnalysis, type BankAnalysis } from "@/components/BankAnalysisReport";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  docs_procured: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  sent_to_bank: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  approved: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  cibil_report: CreditCard,
  pan_verification: Shield,
  mca_data: Building2,
  bank_statement: Banknote,
  form_16: FileText,
  itr: FileText,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  cibil_report: "CIBIL Report",
  pan_verification: "PAN Comprehensive",
  mca_data: "MCA Company Docs",
  bank_statement: "Bank Statement",
  form_16: "Form 16",
  itr: "ITR",
};

function formatCurrency(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function resolveAddress(addr: any): string | undefined {
  if (!addr) return undefined;
  if (typeof addr === "string") return addr || undefined;
  if (typeof addr === "object") {
    const joined = [addr.line_1, addr.line_2, addr.city, addr.state, addr.zip, addr.country]
      .filter(Boolean).join(", ");
    return (addr.full || joined) || undefined;
  }
  return undefined;
}

function stringifyValue(val: any): string | undefined {
  if (val == null) return undefined;
  if (typeof val === "string") return val || undefined;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") return resolveAddress(val) ?? JSON.stringify(val);
  return undefined;
}

function DocStatusBadge({ status }: { status: string }) {
  const classes =
    status === "fetched" ? "border-cyan-300 text-cyan-700" :
    status === "fetching" ? "border-blue-300 text-blue-700" :
    status === "failed" ? "border-red-300 text-red-700" :
    "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-xs capitalize ${classes}`}>
      {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
      {status === "fetched" ? <CheckCircle2 className="w-3 h-3 mr-1 inline" /> :
       status === "failed" ? <XCircle className="w-3 h-3 mr-1 inline" /> :
       status === "pending" ? <Clock className="w-3 h-3 mr-1 inline" /> : null}
      {status}
    </Badge>
  );
}

function VerificationDetail({ data, docType }: { data: any; docType: string }) {
  const d = data?.data ?? data;
  if (!d || typeof d !== "object") return null;

  if (docType === "pan_verification") {
    const fields: [string, string | undefined][] = [
      ["Full Name", d.full_name ?? d.name],
      ["Date of Birth", d.dob],
      ["Father's Name", d.father_name],
      ["Gender", d.gender],
      ["Address", resolveAddress(d.address)],
      ["Category", d.category],
      ["PAN Status", d.pan_status ?? (d.pan_active ? "Active" : undefined)],
      ["Aadhaar Seeded", d.aadhaar_seeding_status ?? (d.masked_aadhaar ? "Yes" : undefined)],
      ["Mobile", d.mobile],
      ["Email", d.email],
    ];
    const visible = fields.filter(([, v]) => v);
    if (!visible.length) return null;
    return (
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs">
        {visible.map(([label, value]) => (
          <div key={label}>
            <p className="text-muted-foreground">{label}</p>
            <p className="font-medium break-all">{value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (docType === "cibil_report") {
    const rd = data?.raw?.data ?? data?.data ?? data;
    const score = rd?.cibil_score ?? rd?.credit_score ?? data?.cibilScore;
    const scoreNum = score ? Number(score) : null;
    const scoreColor = scoreNum
      ? scoreNum >= 750 ? "text-cyan-600" : scoreNum >= 650 ? "text-amber-600" : "text-red-600"
      : "";
    const fields: [string, string | undefined][] = [
      ["Report Date", rd?.report_date ?? rd?.creditReportDate],
      ["Score Type", rd?.score_type ?? rd?.credit_score_name],
      ["Total Accounts", rd?.total_accounts != null ? String(rd.total_accounts) : undefined],
      ["Active Accounts", rd?.active_accounts != null ? String(rd.active_accounts) : undefined],
      ["Total Enquiries", rd?.total_enquiries != null ? String(rd.total_enquiries) : undefined],
    ];
    const visible = fields.filter(([, v]) => v);
    return (
      <div className="mt-3 p-3 bg-cyan-50/60 dark:bg-cyan-950/20 rounded-lg border border-cyan-100 dark:border-cyan-900/30 text-xs">
        {scoreNum && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyan-100 dark:border-cyan-900/30">
            <span className="text-muted-foreground font-medium">Credit Score</span>
            <span className={`text-3xl font-bold font-mono ${scoreColor}`}>{scoreNum}</span>
          </div>
        )}
        {visible.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {visible.map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (docType === "mca_data") {
    const stage = data?.stage ?? "unknown";
    const isPolling = stage === "polling";
    const isCompleted = stage === "completed";
    const fields: [string, string | undefined][] = [
      ["Order ID (client_id)", data?.clientId],
      ["CIN", data?.cinNumber],
      ["Company Name", data?.entityName],
      ["Order Status", data?.orderStatus],
      ["Stage", stage],
      ["Total Documents", data?.totalDocuments != null ? String(data.totalDocuments) : undefined],
      ["Completed Docs", data?.completedDocuments != null ? String(data.completedDocuments) : undefined],
      ["ZIP URL", data?.zipUrl],
    ];
    const visible = fields.filter(([, v]) => v);
    return (
      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-border text-xs space-y-2">
        {isPolling && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Verifying… poll #{data?.pollCount}</span>
          </div>
        )}
        {visible.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {visible.map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground">{label}</p>
                <p className="font-medium font-mono break-all">{value}</p>
              </div>
            ))}
          </div>
        )}
        {isCompleted && data?.documents?.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-muted-foreground mb-1.5 font-medium">Documents</p>
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
        {isCompleted && !data?.zipUrl && (data?.totalDocuments ?? 0) === 0 && (
          <p className="text-amber-600 dark:text-amber-400 pt-1 border-t border-border">
            Order completed — no documents found for this CIN. Verify the CIN is correct.
          </p>
        )}
        {isCompleted && data?.zipUrl && (
          <p className="text-cyan-600 dark:text-cyan-400 pt-1 border-t border-border">
            ✓ ZIP archive stored — use the download button to retrieve it.
          </p>
        )}
      </div>
    );
  }

  return null;
}

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
  "Bank Statement", "Property Papers", "IT Returns", "Salary Slips",
  "Form 16", "Balance Sheet", "P&L Statement", "Photograph",
  "NOC / No Objection Certificate", "Sanction Letter", "Other",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({ doc, onDownload }: { doc: DocRecord; onDownload: (id: number, name: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = DOC_TYPE_ICONS[doc.docType] ?? FileText;
  const label = DOC_TYPE_LABELS[doc.docType] ?? doc.docType;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-card">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {doc.fetchedAt && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(doc.fetchedAt), "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DocStatusBadge status={doc.status} />
          {doc.status === "fetched" && doc.hasFile && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => onDownload(doc.id, doc.fileName ?? `${doc.docType}.pdf`)}
            >
              <Download className="w-3 h-3" />
              {doc.fileName?.endsWith(".zip") ? "ZIP" : "PDF"}
            </Button>
          )}
          {doc.status === "fetched" && !doc.hasFile && (doc.data?.pdfLink ?? doc.data?.credit_report_link ?? doc.data?.report_link) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => window.open(doc.data.pdfLink ?? doc.data.credit_report_link ?? doc.data.report_link, "_blank")}
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </Button>
          )}
          {doc.status === "fetched" && doc.data && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => setExpanded((p) => !p)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>
      {expanded && doc.data && (
        <div className="px-3 pb-3">
          <VerificationDetail data={doc.data} docType={doc.docType} />
        </div>
      )}
    </div>
  );
}

export default function AdminLoanDetail() {
  const { loanId } = useParams<{ loanId: string }>();
  const id = parseInt(loanId!, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [cinInputs, setCinInputs] = useState<Record<number, string>>({});
  const [aaStage, setAaStage] = useState<Record<number, "idle" | "consent" | "fetching" | "done">>({});
  const [commCibilFetching, setCommCibilFetching] = useState<Record<number, boolean>>({});
  const [commCibilBusinessName, setCommCibilBusinessName] = useState<Record<number, string>>({});
  const [uploadLabel, setUploadLabel] = useState("Bank Statement");
  const [uploading, setUploading] = useState(false);
  const [deletingUpload, setDeletingUpload] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: loan, isLoading, refetch } = useGetLoan(id, {
    query: { queryKey: getGetLoanQueryKey(id), refetchInterval: 8000 },
  });

  const updateStatusMutation = useUpdateLoanStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getGetLoanQueryKey(id) });
      },
      onError: () => toast({ title: "Error", description: "Could not update status.", variant: "destructive" }),
    },
  });

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

  function handleDownloadCommCibil(docId: number, fileName: string) {
    downloadFile(`/api/finpass/commercial-cibil/${docId}/download`, fileName);
  }

  async function handleFetch(applicantId: number, docType: "cibil_report" | "pan_verification" | "mca_data") {
    const key = `${applicantId}-${docType}`;
    setFetching((p) => ({ ...p, [key]: true }));
    try {
      let result: any;
      if (docType === "cibil_report") {
        const res = await fetch("/api/surepass/cibil", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId }),
        });
        result = await res.json();
      } else if (docType === "pan_verification") {
        const res = await fetch("/api/surepass/pan", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId }),
        });
        result = await res.json();
      } else if (docType === "mca_data") {
        const cin = cinInputs[applicantId];
        if (!cin?.trim()) {
          toast({ title: "CIN / LLPIN required", description: "Enter the company CIN or LLP's LLPIN first.", variant: "destructive" });
          setFetching((p) => ({ ...p, [key]: false }));
          return;
        }
        const res = await fetch("/api/surepass/mca/create-order", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId, cinNumber: cin.trim() }),
        });
        result = await res.json();
      }
      if (result?.ok) {
        toast({ title: "Request sent", description: "Document will update shortly." });
        setTimeout(() => refetch(), 3000);
        setTimeout(() => refetch(), 8000);
      } else {
        toast({ title: "Fetch failed", description: result?.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setFetching((p) => ({ ...p, [key]: false }));
    }
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
      const res = await fetch(`/api/loans/${id}/uploads`, {
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
      toast({ title: "Document uploaded", description: `${file.name} saved.` });
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
      const res = await fetch(`/api/loans/${id}/uploads/${uploadId}`, {
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
    a.href = `/api/loans/${id}/uploads/${uploadId}/download`;
    a.download = fileName;
    a.click();
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <Skeleton className="h-8 w-1/3 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl text-center">
        <p className="text-muted-foreground">Loan application not found.</p>
        <Link href="/admin/loans"><Button variant="outline" className="mt-4">Back to All Loans</Button></Link>
      </div>
    );
  }

  const allDocs: DocRecord[] = (loan as any).documents ?? [];
  const LOAN_TYPE_LABELS: Record<string, string> = {
    lap: "LAP",
    home: "Home Loan",
    personal: "Personal Loan",
    business: "Business Loan",
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/admin/loans">
              <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> All Applications
              </Button>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Case #{loan.id} — {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
              </h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[loan.status]}`}>
                {loan.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(loan.createdAt), "dd MMM yyyy, h:mm a")}
            </p>
          </div>
        </div>

        {/* Status control */}
        <Card className="border border-border mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Update Status:</p>
              <Select
                value={loan.status}
                onValueChange={(val) => updateStatusMutation.mutate({ id: loan.id, data: { status: val as any } })}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="docs_procured">Docs Ready</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="sent_to_bank">Sent to Bank</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />}
            </div>
          </CardContent>
        </Card>

        {/* Loan Details */}
        <Card className="border border-border mb-6">
          <CardHeader>
            <CardTitle className="text-base">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Amount</p>
                <p className="font-semibold">{formatCurrency(loan.loanAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Tenure</p>
                <p className="font-semibold">{loan.tenure} months</p>
              </div>
              {loan.interestRate != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Interest Rate</p>
                  <p className="font-semibold">{loan.interestRate}% p.a.</p>
                </div>
              )}
              {loan.annualIncome != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Annual Income</p>
                  <p className="font-semibold">{formatCurrency(loan.annualIncome)}</p>
                </div>
              )}
              {loan.employmentType && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Employment</p>
                  <p className="font-semibold capitalize">{loan.employmentType}</p>
                </div>
              )}
              {loan.companyName && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Company</p>
                  <p className="font-semibold">{loan.companyName}</p>
                </div>
              )}
              {(loan as any).propertyValue && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Property Value</p>
                  <p className="font-semibold">{formatCurrency((loan as any).propertyValue)}</p>
                </div>
              )}
              {(loan as any).propertyAddress && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Property Address</p>
                  <p className="font-semibold">{(loan as any).propertyAddress}</p>
                </div>
              )}
              {loan.purpose && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Purpose</p>
                  <p className="font-semibold">{loan.purpose}</p>
                </div>
              )}
              {loan.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-muted-foreground text-xs mb-0.5">Notes</p>
                  <p className="font-semibold">{loan.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Applicants */}
        <div className="space-y-6">
          {loan.applicants.map((applicant) => {
            const applicantDocs = allDocs.filter((d) => d.applicantId === applicant.id);

            function getDoc(docType: string) {
              return applicantDocs.find((d) => d.docType === docType);
            }

            function AdminDocCard({
              docType, label, icon: Icon,
            }: { docType: "cibil_report" | "pan_verification"; label: string; icon: React.ElementType }) {
              const doc = getDoc(docType);
              const key = `${applicant.id}-${docType}`;
              const isLoading = fetching[key] || doc?.status === "fetching";
              const status = doc?.status ?? "pending";
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
              const [exp, setExp] = useState(false);
              return (
                <div className="p-4 border border-border/50 rounded-xl bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${iconClass}`}><Icon className="w-5 h-5" /></div>
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {status === "fetched" && doc?.fetchedAt ? `Fetched ${format(new Date(doc.fetchedAt), "MMM dd, HH:mm")}` :
                           status === "fetching" ? "Processing…" :
                           status === "failed" ? "Failed — retry" : "Not yet fetched"}
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
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => handleDownload(doc.id, doc.fileName ?? `${docType}.pdf`)}>
                            <Download className="w-3 h-3" />{doc.fileName?.endsWith(".zip") ? "ZIP" : "PDF"}
                          </Button>
                        )}
                        {status === "fetched" && !doc?.hasFile && (doc?.data?.pdfLink ?? doc?.data?.credit_report_link ?? doc?.data?.report_link) && (
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => window.open(doc.data.pdfLink ?? doc.data.credit_report_link ?? doc.data.report_link, "_blank")}>
                            <ExternalLink className="w-3 h-3" />Open
                          </Button>
                        )}
                        {status === "fetched" && doc?.data && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                            onClick={() => setExp((p) => !p)}>
                            {exp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {exp && doc?.data && (
                    <div className="px-1 pt-2">
                      <VerificationDetail data={doc.data} docType={docType} />
                    </div>
                  )}
                  {!isLoading ? (
                    <Button size="sm"
                      variant={status === "fetched" ? "outline" : "default"}
                      className="mt-3 w-full h-9 text-xs gap-1.5"
                      onClick={() => handleFetch(applicant.id, docType)}>
                      {status === "fetched" ? <RefreshCw className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      {status === "fetched" ? "Re-fetch" : `Fetch ${label}`}
                    </Button>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />Fetching via Krediflo Verification Engine…
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Card key={applicant.id} className="border border-border">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-cyan-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <Badge
                            className={`text-xs capitalize ${
                              applicant.applicantType === "primary"
                                ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {applicant.applicantType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Full applicant details — no redaction */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Personal Information
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium">{applicant.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Mobile</p>
                          <p className="font-medium font-mono">{applicant.mobile}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Hash className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">PAN Number</p>
                          <p className="font-medium font-mono tracking-widest">
                            {applicant.pan}
                            {applicant.panVerified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 inline ml-2" />
                            )}
                          </p>
                        </div>
                      </div>
                      {(applicant as any).dateOfBirth && (
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Date of Birth</p>
                            <p className="font-medium">{(applicant as any).dateOfBirth}</p>
                          </div>
                        </div>
                      )}
                      {(applicant as any).address && (
                        <div className="flex items-start gap-2 sm:col-span-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Address</p>
                            <p className="font-medium">{(applicant as any).address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Verification scores */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Verification Status
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border text-center">
                        <p className="text-xs text-muted-foreground mb-1">CIBIL Score</p>
                        {applicant.cibilScore ? (
                          <p className={`text-xl font-bold font-mono ${
                            applicant.cibilScore >= 750 ? "text-cyan-600" :
                            applicant.cibilScore >= 650 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {applicant.cibilScore}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${
                        applicant.panVerified
                          ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200"
                          : "bg-slate-50 dark:bg-slate-800/50 border-border"
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">PAN</p>
                        <p className={`text-sm font-semibold ${applicant.panVerified ? "text-cyan-600" : "text-slate-500"}`}>
                          {applicant.panVerified ? "✓ Verified" : "Pending"}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border text-center ${
                        applicant.mcaVerified
                          ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200"
                          : "bg-slate-50 dark:bg-slate-800/50 border-border"
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">MCA</p>
                        <p className={`text-sm font-semibold ${applicant.mcaVerified ? "text-cyan-600" : "text-slate-500"}`}>
                          {applicant.mcaVerified ? "✓ Verified" : "Pending"}
                        </p>
                      </div>
                      {applicant.docsLastFetchedAt && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border text-center">
                          <p className="text-xs text-muted-foreground mb-1">Last Fetch</p>
                          <p className="text-xs font-medium">
                            {format(new Date(applicant.docsLastFetchedAt), "dd MMM, HH:mm")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Document Vault — individual fetch per doc type */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Document Vault
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminDocCard docType="cibil_report" label="CIBIL Credit Report" icon={CreditCard} />

                      {/* Commercial CIBIL — FINpass */}
                      {(() => {
                        const ccDoc = allDocs.find(
                          (d) => d.applicantId === applicant.id && d.docType === "commercial_cibil"
                        );
                        const status = ccDoc?.status ?? "pending";
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
                                    {status === "fetched" && ccDoc?.fetchedAt
                                      ? `Fetched ${format(new Date(ccDoc.fetchedAt), "MMM dd, HH:mm")}`
                                      : status === "fetching" ? "Processing…"
                                      : status === "failed" ? "Failed — retry"
                                      : "Not yet fetched"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {ccDoc && (
                                  <Badge variant="outline" className={`text-xs capitalize ${badgeClass}`}>
                                    {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                                    {status}
                                  </Badge>
                                )}
                                {status === "fetched" && ccDoc?.hasFile && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    onClick={() => handleDownloadCommCibil(ccDoc.id, ccDoc.fileName ?? "commercial_cibil.html")}>
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
                              className="w-full h-9 text-xs gap-1.5"
                              disabled={isWorking}
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

                      <AdminDocCard docType="pan_verification" label="PAN Comprehensive" icon={Shield} />

                      {/* Bank Statement via FINpass AA — full width */}
                      {(() => {
                        const doc = allDocs.find(
                          (d) => d.applicantId === applicant.id && d.docType === "bank_statement"
                        );
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
                          <div className="md:col-span-2 p-4 border border-border/50 rounded-xl bg-card">
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
                                  Generates a consent link using the applicant's mobile. Customer clicks it to approve bank data sharing.
                                </p>
                                <Button
                                  size="sm"
                                  className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
                                  disabled={isWorking}
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
                                    className="h-9 gap-1.5 bg-cyan-600 hover:bg-cyan-700"
                                    disabled={isWorking}
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
                                    disabled={isWorking}
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
                                      disabled={isWorking}
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
                                      onClick={() => handleDownloadBankStatement(doc!.id, doc?.fileName ?? "bank_statement.pdf")}
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
                        const aadoc = allDocs.find((d) => d.applicantId === applicant.id && d.docType === "bank_statement");
                        const hasFetchedPdf = aadoc?.status === "fetched" && aadoc?.hasFile;
                        const bsaDoc = allDocs.find((d) => d.applicantId === applicant.id && d.docType === "bsa_analysis");
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

                      {/* MCA — full width, needs CIN/LLPIN input */}
                      {(() => {
                        const doc = getDoc("mca_data");
                        const key = `${applicant.id}-mca_data`;
                        const isLoading = fetching[key] || doc?.status === "fetching";
                        const status = doc?.status ?? "pending";
                        const badgeClass =
                          status === "fetched" ? "border-cyan-300 text-cyan-700" :
                          status === "fetching" ? "border-blue-300 text-blue-700" :
                          status === "failed" ? "border-red-300 text-red-700" :
                          "border-border text-muted-foreground";
                        return (
                          <div className="md:col-span-2 p-4 border border-border/50 rounded-xl bg-card">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2.5 rounded-lg ${
                                status === "fetched" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" :
                                status === "fetching" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-slate-100 text-slate-500 dark:bg-slate-800"
                              }`}>
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">MCA Company Documents</p>
                                <p className="text-xs text-muted-foreground">For business / LAP loans — enter CIN or LLPIN</p>
                              </div>
                              {status !== "pending" && (
                                <Badge variant="outline" className={`text-xs capitalize shrink-0 ${badgeClass}`}>
                                  {status === "fetching" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                                  {status}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 mb-3">
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">
                                  CIN / LLPIN Number
                                  <span className="ml-1 font-normal text-muted-foreground/70">(companies or LLPs)</span>
                                </Label>
                                <Input
                                  placeholder="Company CIN: U72200MH2010PTC123456  |  LLP: AAA-0001"
                                  value={cinInputs[applicant.id] ?? ""}
                                  onChange={(e) => setCinInputs((p) => ({ ...p, [applicant.id]: e.target.value }))}
                                  className="font-mono text-sm"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Enter CIN for registered companies or LLPIN for Limited Liability Partnerships.
                                </p>
                              </div>
                              {!isLoading ? (
                                <Button
                                  size="sm"
                                  className="self-end h-9 gap-1.5 bg-cyan-600 hover:bg-cyan-700 shrink-0"
                                  onClick={() => handleFetch(applicant.id, "mca_data")}
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                  {status === "fetched" ? "Re-fetch" : "Create Order"}
                                </Button>
                              ) : (
                                <div className="self-end flex items-center gap-2 text-xs text-muted-foreground pb-2">
                                  <Loader2 className="w-3 h-3 animate-spin" />Fetching…
                                </div>
                              )}
                            </div>

                            {doc && doc.status !== "pending" && (
                              <div className="pt-2 border-t border-border/50">
                                {doc.hasFile && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50 mb-2"
                                    onClick={() => handleDownload(doc.id, doc.fileName ?? "mca_data.zip")}>
                                    <Download className="w-3 h-3" />
                                    {doc.fileName?.endsWith(".zip") ? "Download ZIP" : "Download"}
                                  </Button>
                                )}
                                <VerificationDetail data={doc.data} docType="mca_data" />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Additional Documents (Loan-level uploads) ── */}
        {(() => {
          const loanUploads: UploadRecord[] = (loan as any).uploads ?? [];
          return (
            <Card className="border border-border mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-cyan-500" />
                  Additional Documents
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — applicant-uploaded files
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Admin upload form */}
                <div className="p-4 rounded-xl border border-dashed border-cyan-300 dark:border-cyan-700 bg-cyan-50/30 dark:bg-cyan-900/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Upload Document (Admin)
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <select
                        value={uploadLabel}
                        onChange={(e) => setUploadLabel(e.target.value)}
                        className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {UPLOAD_LABELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
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
                        size="sm"
                        variant="outline"
                        className="h-9 gap-2 border-cyan-400 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
                      >
                        {uploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {uploading ? "Uploading…" : "Choose & Upload"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Accepted: PDF, JPG, PNG, Excel, Word · Max 10 MB
                  </p>
                </div>

                {/* Upload list */}
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
                            {up.uploadedByUserId && (
                              <span className="ml-1 text-slate-400">
                                (User #{up.uploadedByUserId})
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400"
                            onClick={() => handleDownloadUpload(up.id, up.fileName)}
                          >
                            <Download className="w-3 h-3" /> Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            disabled={deletingUpload === up.id}
                            onClick={() => handleDeleteUpload(up.id)}
                          >
                            {deletingUpload === up.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </motion.div>
    </div>
  );
}
