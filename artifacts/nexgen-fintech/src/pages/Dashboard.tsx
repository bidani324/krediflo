import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus, ArrowRight, FileCheck, CheckCircle2,
  CreditCard, Shield, Building2, Loader2, RefreshCw,
  ChevronDown, ChevronUp, User, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { LoanStatus } from "@workspace/api-client-react";

function maskPan(pan: string) {
  if (!pan) return "";
  return pan.slice(0, 5).replace(/./g, "X") + pan.slice(5);
}

const STATUS_DETAILS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
  docs_procured: { label: "Docs Ready", color: "bg-indigo-100 text-indigo-700" },
  under_review: { label: "Under Review", color: "bg-amber-100 text-amber-700" },
  sent_to_bank: { label: "Sent to Bank", color: "bg-purple-100 text-purple-700" },
  approved: { label: "Approved", color: "bg-cyan-100 text-cyan-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  lap: "Loan Against Property",
  home: "Home Loan",
  personal: "Personal Loan",
  business: "Business Loan",
};

type Applicant = {
  id: number;
  firstName: string;
  lastName: string;
  pan: string;
  mobile: string;
  email: string;
  applicantType: string;
  cibilScore: number | null;
  cibilStatus: string | null;
  panVerified: boolean;
  mcaVerified: boolean;
};

type LoanWithApplicants = {
  id: number;
  loanType: string;
  loanAmount: number;
  tenure: number;
  status: LoanStatus;
  createdAt: string;
  interestRate?: number | null;
  purpose?: string | null;
  applicants: Applicant[];
};

function ApplicantDocCard({ applicant, onRefresh }: {
  applicant: Applicant;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [cin, setCin] = useState("");
  const [showCin, setShowCin] = useState(false);

  async function callApi(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchCibil() {
    setFetching((p) => ({ ...p, cibil: true }));
    try {
      const result = await callApi("/api/surepass/cibil", { applicantId: applicant.id });
      if (result?.ok || !result?.error) {
        toast({ title: "CIBIL Fetch Initiated", description: "Report will appear in a few seconds." });
      } else {
        toast({ title: "CIBIL", description: result?.error ?? "Fetch initiated.", variant: "destructive" });
      }
      setTimeout(onRefresh, 5000);
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setFetching((p) => ({ ...p, cibil: false }));
    }
  }

  async function fetchPan() {
    setFetching((p) => ({ ...p, pan: true }));
    try {
      const result = await callApi("/api/surepass/pan", { applicantId: applicant.id });
      if (result?.ok || !result?.error) {
        toast({ title: "PAN Verified", description: "PAN comprehensive check complete." });
      } else {
        toast({ title: "PAN", description: result?.error ?? "Verification initiated.", variant: "destructive" });
      }
      setTimeout(onRefresh, 2000);
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setFetching((p) => ({ ...p, pan: false }));
    }
  }

  async function fetchMca() {
    if (!cin.trim()) {
      toast({ title: "CIN Required", description: "Enter the Company Identification Number first.", variant: "destructive" });
      return;
    }
    setFetching((p) => ({ ...p, mca: true }));
    try {
      const result = await callApi("/api/surepass/mca/create-order", { applicantId: applicant.id, cinNumber: cin.trim() });
      if (result?.ok || !result?.error) {
        toast({ title: "MCA Order Created", description: "Documents will be fetched shortly." });
        setShowCin(false);
        setTimeout(onRefresh, 4000);
      } else {
        toast({ title: "MCA", description: result?.error ?? "Order placed.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setFetching((p) => ({ ...p, mca: false }));
    }
  }

  const cibilFetched = applicant.cibilStatus === "fetched";
  const panVerified = applicant.panVerified;

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-background space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{applicant.firstName} {applicant.lastName}</p>
            <Badge variant="outline" className="text-xs capitalize py-0">
              {applicant.applicantType.replace("-", " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{maskPan(applicant.pan)} • {applicant.mobile}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className={`p-2 rounded-lg ${cibilFetched ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700" : "bg-muted text-muted-foreground"}`}>
          <CreditCard className="w-4 h-4 mx-auto mb-1" />
          <p className="font-semibold">{cibilFetched ? (applicant.cibilScore ?? "Fetched") : "Pending"}</p>
          <p className="opacity-70">CIBIL</p>
        </div>
        <div className={`p-2 rounded-lg ${panVerified ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700" : "bg-muted text-muted-foreground"}`}>
          <Shield className="w-4 h-4 mx-auto mb-1" />
          <p className="font-semibold">{panVerified ? "Verified" : "Pending"}</p>
          <p className="opacity-70">PAN</p>
        </div>
        <div className={`p-2 rounded-lg ${applicant.mcaVerified ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700" : "bg-muted text-muted-foreground"}`}>
          <Building2 className="w-4 h-4 mx-auto mb-1" />
          <p className="font-semibold">{applicant.mcaVerified ? "Done" : "Pending"}</p>
          <p className="opacity-70">MCA</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={cibilFetched ? "outline" : "default"}
          className={`flex-1 min-w-[100px] text-xs h-11 ${!cibilFetched ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0" : ""}`}
          onClick={fetchCibil}
          disabled={fetching.cibil}
        >
          {fetching.cibil ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
          {cibilFetched ? "Re-fetch CIBIL" : "Fetch CIBIL Report"}
        </Button>

        <Button
          size="sm"
          variant={panVerified ? "outline" : "default"}
          className={`flex-1 min-w-[100px] text-xs h-11 ${!panVerified ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
          onClick={fetchPan}
          disabled={fetching.pan}
        >
          {fetching.pan ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
          {panVerified ? "Re-verify PAN" : "Verify PAN"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="flex-1 min-w-[100px] text-xs h-11"
          onClick={() => setShowCin((v) => !v)}
          disabled={fetching.mca}
        >
          {fetching.mca ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Building2 className="w-3 h-3 mr-1" />}
          Request MCA Docs
        </Button>
      </div>

      {showCin && (
        <div className="flex gap-2">
          <Input
            placeholder="Company CIN (e.g. U12345MH2020PTC123456)"
            value={cin}
            onChange={(e) => setCin(e.target.value.toUpperCase())}
            className="text-xs font-mono h-9"
          />
          <Button size="sm" onClick={fetchMca} disabled={fetching.mca} className="whitespace-nowrap text-xs h-9">
            {fetching.mca ? <Loader2 className="w-3 h-3 animate-spin" /> : "Request"}
          </Button>
        </div>
      )}
    </div>
  );
}

function LoanCard({ loan }: { loan: LoanWithApplicants }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const statusInfo = STATUS_DETAILS[loan.status] ?? { label: loan.status, color: "bg-slate-100 text-slate-700" };
  const stages = ["draft", "submitted", "docs_procured", "under_review", "sent_to_bank", "approved"];
  const currentIndex = stages.indexOf(loan.status);
  const progress = currentIndex === -1 ? 0 : Math.min(100, (currentIndex / (stages.length - 1)) * 100);

  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: ["loans", "my"] });
  }

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-lg uppercase tracking-tight">
                {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
              </h3>
              <Badge variant="secondary" className={`font-medium text-xs ${statusInfo.color}`}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Application #{loan.id} • {format(new Date(loan.createdAt), "dd MMM yyyy")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-cyan-700 dark:text-cyan-400">
              ₹{loan.loanAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-muted-foreground">{loan.tenure} months tenure</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-4">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Submitted</span>
            <span>Docs Ready</span>
            <span>Review</span>
            <span>Bank</span>
            <span>Approved</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {(loan.applicants?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2 px-3 rounded-lg hover:bg-muted/50"
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>
                {loan.applicants?.length ?? 0} Applicant{(loan.applicants?.length ?? 0) !== 1 ? "s" : ""} — Verify Documents
              </span>
              {expanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                {(loan.applicants ?? []).map((applicant) => (
                  <ApplicantDocCard
                    key={applicant.id}
                    applicant={applicant}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 pb-4 flex gap-2">
        <Link href={`/dashboard/${loan.id}`} className="flex-1">
          <Button variant="outline" className="w-full text-sm">
            View Full Case File <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["loans", "my"],
    queryFn: async () => {
      const res = await fetch("/api/loans/my", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json() as Promise<{ loans: LoanWithApplicants[]; total: number }>;
    },
    refetchInterval: 20000,
  });

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {user?.firstName}'s Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Track status and fetch CIBIL / PAN / MCA verification documents
          </p>
        </div>
        <Link href="/apply">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0">
            <Plus className="w-4 h-4 mr-2" /> New Application
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-1/4" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (data?.loans ?? []).length > 0 ? (
        <div className="space-y-4">
          {(data?.loans ?? []).map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Applications Yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              You haven't submitted any loan applications. Start one now — it takes under 2 minutes.
            </p>
            <Link href="/apply">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0">
                Start New Application
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
