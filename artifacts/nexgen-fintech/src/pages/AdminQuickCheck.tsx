import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard,
  User,
  Building2,
  Briefcase,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Link2,
  FileBarChart2,
  Upload,
  Copy,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BankStatementAnalyser } from "@/components/BankStatementAnalyser";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function downloadBase64(base64: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    html: "text/html",
  };
  const mime = mimeMap[ext ?? ""] ?? "application/octet-stream";
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (data === null || data === undefined) return <span className="text-slate-400">null</span>;
  if (typeof data === "boolean") return <span className="text-amber-500">{String(data)}</span>;
  if (typeof data === "number") return <span className="text-blue-500">{data}</span>;
  if (typeof data === "string") return <span className="text-cyan-600 dark:text-cyan-400 break-all">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <span>
        <button onClick={() => setOpen(v => !v)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-0.5 text-xs">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          [{data.length}]
        </button>
        {open && (
          <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-3 mt-1 space-y-1">
            {data.map((item, i) => (
              <div key={i} className="text-xs">
                <span className="text-slate-400 mr-1">{i}:</span>
                <JsonTree data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-400">{"{}"}</span>;
    return (
      <span>
        <button onClick={() => setOpen(v => !v)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-0.5 text-xs">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {"{"}…{"}"} ({entries.length})
        </button>
        {open && (
          <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-3 mt-1 space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-purple-600 dark:text-purple-400 font-medium mr-1">{k}:</span>
                <JsonTree data={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

/* ─── Result panel ────────────────────────────────────────────────────────── */

interface ResultPanelProps {
  result: Record<string, unknown> | null;
  loading: boolean;
  label?: string;
}

function ResultPanel({ result, loading, label = "Result" }: ResultPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-cyan-500" />
        <p className="text-sm">Fetching from API — this may take a few seconds…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2 text-muted-foreground">
        <Zap className="w-8 h-8 text-slate-300" />
        <p className="text-sm">Fill the form and click Fetch to see results here.</p>
      </div>
    );
  }

  const ok = result.ok as boolean;

  return (
    <AnimatePresence mode="wait">
      <motion.div key={ok ? "ok" : "err"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {/* Status banner */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 text-sm font-medium ${ok ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"}`}>
          {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {ok ? `${label} fetched successfully` : `${label} fetch failed`}
        </div>

        {/* Quick-summary chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {typeof result.score === "number" && (
            <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-400 text-sm font-semibold px-3 py-1">
              CIBIL Score: {result.score}
            </Badge>
          )}
          {typeof result.orderStatus === "string" && (
            <Badge variant="outline" className="border-slate-300 text-slate-700 dark:text-slate-300 px-3 py-1">
              MCA Status: {result.orderStatus}
            </Badge>
          )}
          {typeof result.entityName === "string" && (
            <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-400 px-3 py-1">
              {result.entityName}
            </Badge>
          )}
          {typeof result.totalDocuments === "number" && (
            <Badge variant="outline" className="border-slate-300 px-3 py-1">
              {result.completedDocuments as number}/{result.totalDocuments} docs
            </Badge>
          )}
          {typeof result.error === "string" && (
            <Badge variant="destructive" className="px-3 py-1">{result.error}</Badge>
          )}
        </div>

        {/* Download buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {typeof result.pdfBase64 === "string" && typeof result.fileName === "string" && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => downloadBase64(result.pdfBase64 as string, result.fileName as string)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PDF
            </Button>
          )}
          {typeof result.fileBase64 === "string" && typeof result.fileName === "string" && (
            <Button
              size="sm"
              variant="outline"
              className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
              onClick={() => downloadBase64(result.fileBase64 as string, result.fileName as string)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Report
            </Button>
          )}
          {typeof result.zipBase64 === "string" && typeof result.zipFileName === "string" && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={() => downloadBase64(result.zipBase64 as string, result.zipFileName as string)}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download ZIP
            </Button>
          )}
        </div>

        {/* JSON tree */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-xs font-mono overflow-auto max-h-[520px]">
          <JsonTree data={result} depth={0} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Result panel: extra chip types ─────────────────────────────────────── */
// (chips for AA clientId / BSA processing are rendered inline in those tabs)

/* ─── Individual tab forms ────────────────────────────────────────────────── */

function CibilTab() {
  const [pan, setPan] = useState("");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/admin/quick-check/cibil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pan: pan.toUpperCase().trim(), mobile: mobile.trim(), name: name.trim(), gender }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const disabled = !pan.trim() || !mobile.trim() || !name.trim() || loading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-500" /> CIBIL Credit Report
          </CardTitle>
          <CardDescription>Fetch individual CIBIL score and PDF report via the Krediflo Instant Verification Engine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cibil-pan">PAN Number <span className="text-red-500">*</span></Label>
            <Input id="cibil-pan" placeholder="ABCDE1234F" maxLength={10} value={pan} onChange={e => setPan(e.target.value.toUpperCase())} className="mt-1 font-mono tracking-widest" />
          </div>
          <div>
            <Label htmlFor="cibil-mobile">Mobile Number <span className="text-red-500">*</span></Label>
            <Input id="cibil-mobile" placeholder="9876543210" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ""))} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cibil-name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="cibil-name" placeholder="As on PAN card" value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cibil-gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="cibil-gender" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={disabled} onClick={handleFetch}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching…</> : <><Zap className="w-4 h-4 mr-2" /> Fetch CIBIL Report</>}
          </Button>
        </CardContent>
      </Card>
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultPanel result={result} loading={loading} label="CIBIL Report" />
        </CardContent>
      </Card>
    </div>
  );
}

function PanTab() {
  const [pan, setPan] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/admin/quick-check/pan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pan: pan.toUpperCase().trim() }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const disabled = pan.trim().length !== 10 || loading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-500" /> PAN Comprehensive
          </CardTitle>
          <CardDescription>Full PAN verification — name, DOB, Aadhaar linkage, category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pan-number">PAN Number <span className="text-red-500">*</span></Label>
            <Input id="pan-number" placeholder="ABCDE1234F" maxLength={10} value={pan} onChange={e => setPan(e.target.value.toUpperCase())} className="mt-1 font-mono tracking-widest" />
            <p className="text-xs text-muted-foreground mt-1">Enter the 10-character PAN</p>
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" disabled={disabled} onClick={handleFetch}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…</> : <><Zap className="w-4 h-4 mr-2" /> Verify PAN</>}
          </Button>
        </CardContent>
      </Card>
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultPanel result={result} loading={loading} label="PAN Verification" />
        </CardContent>
      </Card>
    </div>
  );
}

function McaTab() {
  const [cin, setCin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/admin/quick-check/mca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cinNumber: cin.trim().toUpperCase() }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const disabled = !cin.trim() || loading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" /> MCA Company Data
          </CardTitle>
          <CardDescription>Fetch company details, director info, and registered documents via the Krediflo Instant Verification Engine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="mca-cin">CIN / Company Number <span className="text-red-500">*</span></Label>
            <Input id="mca-cin" placeholder="U74999MH2020PTC123456" value={cin} onChange={e => setCin(e.target.value)} className="mt-1 font-mono" />
            <p className="text-xs text-muted-foreground mt-1">21-character Corporate Identification Number</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            MCA orders typically take 30–90 seconds to process. The page will wait for the result.
          </div>
          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={disabled} onClick={handleFetch}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching — please wait…</> : <><Zap className="w-4 h-4 mr-2" /> Fetch MCA Data</>}
          </Button>
        </CardContent>
      </Card>
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultPanel result={result} loading={loading} label="MCA Data" />
        </CardContent>
      </Card>
    </div>
  );
}

function CommCibilTab() {
  const [pan, setPan] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [reportType, setReportType] = useState<"html" | "pdf" | "json">("html");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/admin/quick-check/commercial-cibil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pan: pan.toUpperCase().trim(), businessName: businessName.trim(), reportType }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const disabled = pan.trim().length !== 10 || !businessName.trim() || loading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-orange-500" /> Commercial CIBIL
          </CardTitle>
          <CardDescription>Business credit report via the Krediflo Secure Banking Gateway</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cc-pan">Business PAN <span className="text-red-500">*</span></Label>
            <Input id="cc-pan" placeholder="AABCC1234D" maxLength={10} value={pan} onChange={e => setPan(e.target.value.toUpperCase())} className="mt-1 font-mono tracking-widest" />
          </div>
          <div>
            <Label htmlFor="cc-bizname">Business / Firm Name <span className="text-red-500">*</span></Label>
            <Input id="cc-bizname" placeholder="As registered" value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cc-rtype">Report Format</Label>
            <Select value={reportType} onValueChange={v => setReportType(v as "html" | "pdf" | "json")}>
              <SelectTrigger id="cc-rtype" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="html">HTML (recommended)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="json">JSON only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" disabled={disabled} onClick={handleFetch}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching…</> : <><Zap className="w-4 h-4 mr-2" /> Fetch Commercial CIBIL</>}
          </Button>
        </CardContent>
      </Card>
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultPanel result={result} loading={loading} label="Commercial CIBIL" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Account Aggregator Tab ──────────────────────────────────────────────── */

function AaTab() {
  const [mobile, setMobile] = useState("");
  const [pan, setPan] = useState("");
  const [consentType, setConsentType] = useState<"ONETIME" | "PERIODIC">("ONETIME");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleInit() {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${BASE}/api/admin/quick-check/aa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile: mobile.trim(), pan: pan.trim().toUpperCase() || undefined, consentType }),
      });
      setResult(await resp.json());
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    const url = result?.redirectUrl as string | undefined;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const disabled = mobile.trim().length !== 10 || loading;
  // Typed derivations — avoids propagating `unknown` from Record<string,unknown> into JSX
  const aaOk = !!result?.ok;
  const redirectUrl: string | null = typeof result?.redirectUrl === "string" ? result.redirectUrl : null;
  const aaClientId: string | null = typeof result?.clientId === "string" ? result.clientId : null;
  const aaRequestId: string | null = typeof result?.requestId === "string" ? result.requestId : null;
  const aaError: string | null = typeof result?.error === "string" ? result.error : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-500" /> Account Aggregator Consent
          </CardTitle>
          <CardDescription>
            Initiate an RBI-regulated AA consent session via the Krediflo Secure Banking Gateway.
            Returns a consent link to share with the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="aa-mobile">Customer Mobile <span className="text-red-500">*</span></Label>
            <Input
              id="aa-mobile"
              placeholder="9876543210"
              maxLength={10}
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, ""))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">10-digit mobile linked to the customer's AA handle</p>
          </div>
          <div>
            <Label htmlFor="aa-pan">PAN Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="aa-pan"
              placeholder="ABCDE1234F"
              maxLength={10}
              value={pan}
              onChange={e => setPan(e.target.value.toUpperCase())}
              className="mt-1 font-mono tracking-widest"
            />
          </div>
          <div>
            <Label htmlFor="aa-consent">Consent Type</Label>
            <Select value={consentType} onValueChange={v => setConsentType(v as "ONETIME" | "PERIODIC")}>
              <SelectTrigger id="aa-consent" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONETIME">One-time (single fetch)</SelectItem>
                <SelectItem value="PERIODIC">Periodic (recurring access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={disabled}
            onClick={handleInit}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Initiating…</>
              : <><Link2 className="w-4 h-4 mr-2" /> Generate Consent Link</>}
          </Button>
        </CardContent>
      </Card>

      {/* Result card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Consent Session</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
              <p className="text-sm">Generating consent session…</p>
            </div>
          )}
          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-muted-foreground">
              <Link2 className="w-8 h-8 text-slate-300" />
              <p className="text-sm">Enter a mobile number and click Generate.</p>
            </div>
          )}
          {!loading && !!result && (
            <div className="space-y-4">
              {/* Status */}
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                aaOk
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
              }`}>
                {aaOk
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertCircle className="w-4 h-4 shrink-0" />}
                {aaOk ? "Consent session created" : "Failed to create session"}
              </div>

              {/* Consent URL box */}
              {redirectUrl ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consent Link (share with customer)</p>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-start gap-2">
                    <p className="text-xs font-mono break-all flex-1 text-slate-700 dark:text-slate-300">{redirectUrl}</p>
                    <button
                      onClick={copyUrl}
                      className="shrink-0 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                      title="Copy link"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The customer must open this link on their phone and approve the consent request in their AA app.
                  </p>
                </div>
              ) : null}

              {/* IDs */}
              {(aaClientId || aaRequestId) ? (
                <div className="flex flex-wrap gap-2">
                  {aaClientId ? (
                    <div className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 font-mono">
                      <span className="text-muted-foreground mr-1">clientId:</span>{aaClientId}
                    </div>
                  ) : null}
                  {aaRequestId ? (
                    <div className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 font-mono">
                      <span className="text-muted-foreground mr-1">requestId:</span>{aaRequestId}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Error */}
              {!aaOk && aaError ? (
                <div className="text-sm text-red-600 dark:text-red-400">{aaError}</div>
              ) : null}

              {/* Raw JSON */}
              {aaOk ? (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64">
                  <JsonTree data={result} depth={0} />
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── BSA Tab ─────────────────────────────────────────────────────────────── */

function BsaTab() {
  return (
    <div className="max-w-3xl">
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-violet-500" /> Statement Analysis
          </CardTitle>
          <CardDescription>
            Upload a text-based PDF bank statement to get monthly credits, debits, balances and EMI candidates. Analysis runs inside Krediflo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankStatementAnalyser idPrefix="quick-bsa" endpoint={`${BASE}/api/admin/quick-check/bsa`} showReport />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function AdminQuickCheck() {
  const { admin } = useAuth();
  const [, navigate] = useLocation();

  if (!admin) {
    navigate("/admin/login");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Zap className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Quick Check</h1>
            <p className="text-sm text-muted-foreground">Instant document and credit checks — no loan file required</p>
          </div>
        </div>

        {/* Info strip */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { icon: CreditCard,    label: "CIBIL Score + PDF",    color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" },
            { icon: User,          label: "PAN Comprehensive",     color: "text-cyan-500",   bg: "bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800" },
            { icon: Building2,     label: "MCA Data + ZIP",        color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800" },
            { icon: Briefcase,     label: "Commercial CIBIL",      color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800" },
            { icon: Link2,         label: "Account Aggregator AA", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" },
            { icon: FileBarChart2, label: "Statement Analysis",    color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800" },
          ].map(({ icon: Icon, label, color, bg }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${bg}`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="cibil">
          <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="cibil" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="w-3.5 h-3.5" /> CIBIL
            </TabsTrigger>
            <TabsTrigger value="pan" className="gap-1.5 text-xs sm:text-sm">
              <User className="w-3.5 h-3.5" /> PAN
            </TabsTrigger>
            <TabsTrigger value="mca" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="w-3.5 h-3.5" /> MCA
            </TabsTrigger>
            <TabsTrigger value="commercial-cibil" className="gap-1.5 text-xs sm:text-sm">
              <Briefcase className="w-3.5 h-3.5" /> Commercial CIBIL
            </TabsTrigger>
            <TabsTrigger value="aa" className="gap-1.5 text-xs sm:text-sm">
              <Link2 className="w-3.5 h-3.5" /> Account Aggregator
            </TabsTrigger>
            <TabsTrigger value="bsa" className="gap-1.5 text-xs sm:text-sm">
              <FileBarChart2 className="w-3.5 h-3.5" /> Statement Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cibil"><CibilTab /></TabsContent>
          <TabsContent value="pan"><PanTab /></TabsContent>
          <TabsContent value="mca"><McaTab /></TabsContent>
          <TabsContent value="commercial-cibil"><CommCibilTab /></TabsContent>
          <TabsContent value="aa"><AaTab /></TabsContent>
          <TabsContent value="bsa"><BsaTab /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
