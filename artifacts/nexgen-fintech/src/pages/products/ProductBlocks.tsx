import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CheckCircle2, Database, Zap, Building2, ShieldCheck,
  CreditCard, FileText, ArrowRight, TrendingDown, Percent, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalculateEmi, useCalculateBalanceTransfer } from "@workspace/api-client-react";

/* ────────────────────────────────────────────────────────────────────────────
   API Status Bar
   ──────────────────────────────────────────────────────────────────────────── */

const API_ITEMS = [
  { key: "cibil",   label: "CIBIL Credit",    sub: "Instant Verify",       Icon: CreditCard },
  { key: "banking", label: "Bank Statements",  sub: "via AA Framework",   Icon: Database   },
  { key: "mca",     label: "MCA Company",      sub: "Instant Verify",       Icon: Building2  },
];

export function ApiStatusBar({ highlightMca = false }: { highlightMca?: boolean }) {
  return (
    <section className="bg-[#040f1f] border-y border-cyan-900/30 py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 flex-wrap">
          {API_ITEMS.map(({ key, label, sub, Icon }) => {
            const hi = key === "mca" && highlightMca;
            return (
              <div key={key} className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hi ? "bg-amber-400" : "bg-cyan-400"}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hi ? "bg-amber-400" : "bg-cyan-500"}`} />
                </span>
                <Icon className={`w-3.5 h-3.5 ${hi ? "text-amber-400" : "text-cyan-400"}`} />
                <div className="text-xs">
                  <span className={`font-semibold ${hi ? "text-amber-300" : "text-cyan-300"}`}>{label}</span>
                  <span className="text-slate-500 ml-1">{sub}</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${hi ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"}`}>
                  LIVE
                </span>
              </div>
            );
          })}
          <span className="hidden sm:block w-px h-4 bg-slate-700" />
          <p className="text-[10px] text-slate-500 tracking-wider uppercase">Real-time Verification</p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Document Checklist
   ──────────────────────────────────────────────────────────────────────────── */

type LoanProductType = "home" | "lap" | "business" | "personal";

const DOC_DATA: Record<LoanProductType, {
  apiDocs: { label: string; source: string }[];
  physicalDocs: { label: string; note?: string }[];
}> = {
  home: {
    apiDocs: [
      { label: "CIBIL Credit Report",           source: "Krediflo Verification Engine"      },
      { label: "PAN Verification",               source: "Krediflo Verification Engine"      },
      { label: "Bank Statements — 6 months",     source: "Account Aggregator"},
    ],
    physicalDocs: [
      { label: "Property Sale Deed / Agreement"                              },
      { label: "Property Chain Documents",       note: "Link docs / title search" },
      { label: "Demand Letter",                  note: "From builder for under-construction" },
    ],
  },
  lap: {
    apiDocs: [
      { label: "CIBIL Credit Report",           source: "Krediflo Verification Engine"      },
      { label: "PAN Verification",               source: "Krediflo Verification Engine"      },
      { label: "Bank Statements — 6 months",     source: "Account Aggregator"},
      { label: "MCA Company & Director Data",    source: "Krediflo Verification Engine"      },
    ],
    physicalDocs: [
      { label: "Original Title Deed"                                          },
      { label: "Property Chain / Link Documents", note: "Last 30 years"      },
      { label: "Valuation Report",               note: "From approved valuer" },
    ],
  },
  business: {
    apiDocs: [
      { label: "MCA Director & Company Data",    source: "Krediflo Verification Engine"      },
      { label: "CIBIL Credit Report",           source: "Krediflo Verification Engine"      },
      { label: "Bank Statements — 6 months",     source: "Account Aggregator"},
    ],
    physicalDocs: [
      { label: "GST Returns (Last 2 years)"                                   },
      { label: "Audited Financials",             note: "Only if turnover > ₹40L" },
    ],
  },
  personal: {
    apiDocs: [
      { label: "CIBIL Credit Report",           source: "Krediflo Verification Engine"      },
      { label: "PAN Verification",               source: "Krediflo Verification Engine"      },
      { label: "Bank Statements — 6 months",     source: "Account Aggregator"},
    ],
    physicalDocs: [
      { label: "Employment Offer Letter",        note: "First-time borrowers only" },
    ],
  },
};

export function DocChecklist({ type }: { type: LoanProductType }) {
  const { apiDocs, physicalDocs } = DOC_DATA[type];
  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900/20">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-500 mb-3">
            Document Intelligence
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Checklist, Simplified</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            The heavy lifting is done by APIs. You only bring what machines can't access.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API-verified column */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-900/10 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-cyan-700 dark:text-cyan-400 flex items-center gap-2 flex-wrap">
                  <ShieldCheck className="w-4 h-4" />
                  Verified via API
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-700 font-bold">
                    AUTO-FETCHED
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {apiDocs.map((doc) => (
                  <div key={doc.label} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-through decoration-cyan-400 decoration-2">
                        {doc.label}
                      </p>
                      <p className="text-[10px] text-cyan-600 dark:text-cyan-500 font-medium mt-0.5">
                        ✓ {doc.source}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Physical docs column */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 flex-wrap">
                  <FileText className="w-4 h-4" />
                  Physical Documents
                  <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-bold">
                    BRING ORIGINALS
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {physicalDocs.map((doc) => (
                  <div key={doc.label} className="flex items-start gap-3">
                    <div className="w-4 h-4 shrink-0 mt-0.5 border-2 border-amber-400 rounded-sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{doc.label}</p>
                      {doc.note && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">{doc.note}</p>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground pt-2 border-t border-amber-200 dark:border-amber-800/50 mt-2">
                  Doorstep pickup available — no bank branch visits.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Balance Transfer Calculator (Side-by-Side)
   ──────────────────────────────────────────────────────────────────────────── */

export function LBTCalculator({
  defaultNewRate = "8.5",
  anchor = "balance-transfer",
  focusLabel = "Tenure Reduction",
}: {
  defaultNewRate?: string;
  anchor?: string;
  focusLabel?: string;
}) {
  const [principal, setPrincipal]     = useState("5000000");
  const [currentRate, setCurrentRate] = useState("10.5");
  const [newRate, setNewRate]         = useState(defaultNewRate);
  const [tenure, setTenure]           = useState("180");
  const calculateBt = useCalculateBalanceTransfer();

  const handleCalc = () => {
    calculateBt.mutate({
      data: {
        currentPrincipal:      Number(principal),
        currentRate:           Number(currentRate),
        newRate:               Number(newRate),
        remainingTenureMonths: Number(tenure),
        processingFee:         10000,
      },
    });
  };

  const saved = calculateBt.data;

  return (
    <section id={anchor} className="py-24 bg-background scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-500 mb-3">
            Smart Savings Suite
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Balance Transfer Calculator</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Focused on <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{focusLabel}</span>. See exactly
            how much you save switching to a Krediflo partner bank.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-border shadow-xl">
            {/* Left: Current Loan */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-8 border-b md:border-b-0 md:border-r border-border">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Current Loan</p>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Outstanding Principal (₹)</Label>
                  <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} className="h-11 font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Current Interest Rate (% p.a.)</Label>
                  <Input type="number" step="0.1" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)}
                    className="h-11 border-red-200 dark:border-red-900/40 focus-visible:ring-red-400 font-mono" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Remaining Tenure (Months)</Label>
                  <Input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} className="h-11 font-mono" />
                </div>
              </div>
            </div>

            {/* Right: Krediflo Offer */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-500">Krediflo Offer</p>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">New Interest Rate (% p.a.)</Label>
                  <Input type="number" step="0.1" value={newRate} onChange={(e) => setNewRate(e.target.value)}
                    className="h-11 border-cyan-300 dark:border-cyan-700 focus-visible:ring-cyan-500 font-mono" />
                  <p className="text-[10px] text-cyan-500 mt-1.5 font-semibold">
                    ★ Best rate from 40+ partner banks
                  </p>
                </div>

                <Button
                  onClick={handleCalc}
                  disabled={calculateBt.isPending}
                  className="w-full h-11 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 border-0"
                >
                  {calculateBt.isPending ? "Analyzing…" : "Calculate My Savings →"}
                </Button>

                {saved && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">Total Interest Saved</span>
                        <span className={`text-xl font-bold font-mono ${saved.worthTransferring ? "text-cyan-600 dark:text-cyan-400" : "text-red-500"}`}>
                          ₹{Math.abs(saved.netSavingsAfterFees).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Break-even</span>
                        <span className="font-semibold">{saved.breakEvenMonths} months</span>
                      </div>
                    </div>
                    <div className={`text-center text-sm font-bold py-2.5 rounded-xl ${saved.worthTransferring ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800" : "bg-red-500/10 text-red-600 border border-red-200 dark:border-red-900"}`}>
                      {saved.worthTransferring ? "✓ Transfer Recommended" : "✗ Not Recommended at This Rate"}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            ₹10,000 processing fee included in calculations. Actual rate subject to credit profile.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LTV Estimator (LAP)
   ──────────────────────────────────────────────────────────────────────────── */

export function LTVEstimator() {
  const [propertyValue, setPropertyValue] = useState("8000000");
  const [propType, setPropType]           = useState<"residential" | "commercial">("residential");
  const [tenure, setTenure]               = useState("120");
  const calculateEmi = useCalculateEmi();

  const ltv     = propType === "residential" ? 0.70 : 0.60;
  const maxLoan = Math.floor(Number(propertyValue) * ltv);

  const fmt = (v: number) => {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  const handleEstimate = () => {
    if (maxLoan > 0 && Number(tenure) > 0) {
      calculateEmi.mutate({ data: { principal: maxLoan, interestRate: 9.5, tenureMonths: Number(tenure) } });
    }
  };

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-500 mb-3">
            Capital Unlock Estimator
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How Much Can Your Property Unlock?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Residential up to <strong className="text-cyan-600 dark:text-cyan-400">70% LTV</strong>, commercial
            up to <strong className="text-amber-600 dark:text-amber-400">60% LTV</strong>. Enter your property value below.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl border-border/60">
            <CardContent className="p-4 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Property Market Value (₹)</Label>
                  <Input type="number" value={propertyValue} onChange={(e) => setPropertyValue(e.target.value)}
                    className="h-11 text-lg font-mono" placeholder="e.g. 8000000" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Property Type</Label>
                  <div className="flex gap-2 h-11">
                    {(["residential", "commercial"] as const).map((t) => (
                      <button key={t} onClick={() => setPropType(t)}
                        className={`flex-1 rounded-lg border text-xs font-semibold capitalize transition-all ${propType === t ? "bg-cyan-500 text-slate-950 border-cyan-500" : "border-border text-muted-foreground hover:border-cyan-400"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LTV Gauge */}
              <div className="mb-7 p-6 rounded-2xl bg-[#030d1a] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/10" />
                <div className="relative z-10">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Maximum Loan Eligibility</p>
                      <p className="text-4xl font-bold text-cyan-400 font-mono">{fmt(maxLoan)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 mb-1">LTV Ratio</p>
                      <p className="text-2xl font-bold text-amber-400">{(ltv * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3">
                    <div className="h-3 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-700"
                      style={{ width: `${ltv * 100}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {propType === "residential" ? "Up to 70% LTV for residential" : "Up to 60% LTV for commercial"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Desired Tenure (Months)</Label>
                  <Input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} className="h-11" />
                </div>
                <Button onClick={handleEstimate} disabled={calculateEmi.isPending}
                  className="h-11 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold border-0">
                  {calculateEmi.isPending ? "Calculating…" : "Estimate EMI"}
                </Button>
              </div>

              {calculateEmi.data && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Monthly EMI</p>
                    <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                      ₹{calculateEmi.data.emi.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Interest</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                      ₹{calculateEmi.data.totalInterest.toLocaleString("en-IN")}
                    </p>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Eligibility Meter (Business & Personal)
   ──────────────────────────────────────────────────────────────────────────── */

export function EligibilityMeter({ type }: { type: "business" | "personal" }) {
  const isBusiness = type === "business";
  const [income,  setIncome]  = useState(isBusiness ? "200000" : "75000");
  const [empType, setEmpType] = useState<"salaried" | "self-employed">("salaried");
  const [vintage, setVintage] = useState("3");
  const [score,   setScore]   = useState<number | null>(null);
  const [maxLoan, setMaxLoan] = useState<number | null>(null);

  const handleCheck = () => {
    const inc = Number(income);
    if (!inc) return;
    let pct = 60;
    if (isBusiness) {
      const v = Number(vintage);
      pct = v >= 5 ? 90 : v >= 3 ? 75 : v >= 1 ? 55 : 30;
      if (inc >= 500000) pct = Math.min(100, pct + 10);
      setMaxLoan(Math.floor((inc * (v >= 3 ? 12 : 8) * pct) / 100));
    } else {
      if (empType === "salaried") {
        pct = inc >= 150000 ? 92 : inc >= 75000 ? 80 : inc >= 40000 ? 65 : 45;
      } else {
        pct = inc >= 200000 ? 85 : inc >= 100000 ? 70 : 50;
      }
      setMaxLoan(Math.floor((inc * 24 * pct) / 100));
    }
    setScore(pct);
  };

  const sc = score ?? 0;
  const col = sc >= 80 ? "cyan" : sc >= 55 ? "amber" : "red";
  const styles = {
    cyan:  { bar: "from-cyan-600 to-cyan-400",   text: "text-cyan-400",  ring: "bg-cyan-500/10 border-cyan-500/30" },
    amber: { bar: "from-amber-600 to-amber-400", text: "text-amber-400", ring: "bg-amber-500/10 border-amber-500/30" },
    red:   { bar: "from-red-700 to-red-500",     text: "text-red-400",   ring: "bg-red-500/10 border-red-500/30"    },
  }[col];

  const fmt = (v: number) => {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)} L`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  return (
    <section className="py-24 bg-[#030d1a]">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-400 mb-3">Eligibility Engine</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {isBusiness ? "Check Your Business Loan Eligibility" : "Instant Eligibility Check"}
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            {isBusiness
              ? "Monthly revenue + business vintage — our engine models your max loan in seconds."
              : "Enter your income. We calculate your eligibility instantly — no CIBIL pull required."}
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <Card className="border-slate-800 bg-slate-900/60 shadow-2xl">
            <CardContent className="p-4 md:p-8">
              <div className="space-y-5 mb-6">
                {isBusiness ? (
                  <>
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Monthly Revenue (₹)</Label>
                      <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)}
                        className="h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Business Vintage (years)</Label>
                      <div className="flex gap-2">
                        {[["1","1"], ["2","2"], ["3","3"], ["5","5"], ["7+","7"]].map(([label, val]) => (
                          <button key={val} onClick={() => setVintage(val)}
                            className={`flex-1 h-11 rounded-lg border text-sm font-semibold transition-all ${vintage === val ? "bg-cyan-500 text-slate-950 border-cyan-500" : "border-slate-700 text-slate-400 hover:border-cyan-600"}`}>
                            {label}y
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Monthly Net Income (₹)</Label>
                      <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)}
                        className="h-11 bg-slate-800 border-slate-700 text-white font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Employment Type</Label>
                      <div className="flex gap-2">
                        {(["salaried", "self-employed"] as const).map((t) => (
                          <button key={t} onClick={() => setEmpType(t)}
                            className={`flex-1 h-11 rounded-lg border text-sm font-semibold capitalize transition-all ${empType === t ? "bg-cyan-500 text-slate-950 border-cyan-500" : "border-slate-700 text-slate-400 hover:border-cyan-600"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      {empType === "self-employed" && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="text-[11px] text-amber-400 mt-2 font-medium">
                          Self-employed: ITR + MCA verification via Krediflo Instant Verification Engine (auto-fetched)
                        </motion.p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleCheck}
                className="w-full h-12 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-base gap-2 shadow-lg shadow-cyan-500/25 mb-6 border-0">
                <Zap className="w-4 h-4" />
                {isBusiness ? "Check Business Eligibility" : "Check My Eligibility Instantly"}
              </Button>

              {/* Score bar */}
              <div className={`rounded-2xl p-6 border transition-all duration-500 ${score !== null ? styles.ring : "bg-slate-800/50 border-slate-700/50"}`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-slate-400 font-medium">Eligibility Score</p>
                  <p className={`text-3xl font-bold font-mono tabular-nums transition-all ${styles.text}`}>
                    {score !== null ? `${score}%` : "—"}
                  </p>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden mb-4">
                  <div className={`h-4 rounded-full bg-gradient-to-r ${styles.bar} transition-all duration-1000 ease-out`}
                    style={{ width: `${sc}%` }} />
                </div>
                {score !== null && maxLoan !== null ? (
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-slate-400">Est. Max Loan</p>
                      <p className={`text-2xl font-bold font-mono ${styles.text}`}>{fmt(maxLoan)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Krediflo rate</p>
                      <p className="text-xs text-slate-300 font-semibold">
                        {isBusiness ? "11.00% p.a. →" : "10.50% p.a. →"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Enter your details above to see eligibility</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Sync Profile CTA Footer
   ──────────────────────────────────────────────────────────────────────────── */

export function SyncProfileCTA({
  heading,
  sub,
}: {
  heading: string;
  sub: string;
}) {
  return (
    <section className="py-24 bg-[#030d1a] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-blue-900/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(0,210,255,0.07)_0%,transparent_70%)]" />
      <div className="container mx-auto px-4 relative z-10 text-center max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{heading}</h2>
          <p className="text-slate-400 mb-8 text-lg">{sub}</p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            No PDF uploads. No paperwork. Secure API fetch.
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/apply">
              <Button size="lg" className="w-full sm:w-auto px-10 h-13 text-base bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold shadow-xl shadow-cyan-500/25 gap-2 border-0">
                Sync Profile &amp; Apply <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 h-13 text-base border-slate-600 text-slate-200 hover:bg-slate-800">
                Check Eligibility
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { v: "40+",    l: "Banks & NBFCs" },
              { v: "48 hrs", l: "Avg. Sanction" },
              { v: "2,000+", l: "Customers"     },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="text-xl font-bold text-cyan-400">{v}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
