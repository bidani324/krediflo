import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { User, ArrowRight, Zap, CheckCircle2, CreditCard, Database, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiStatusBar, DocChecklist, EligibilityMeter, SyncProfileCTA } from "./products/ProductBlocks";
import { useCalculateEmi } from "@workspace/api-client-react";

const SYNC_STEPS = [
  {
    num: "01",
    icon: CreditCard,
    title: "CIBIL Sync",
    sub: "Auto-fetched",
    desc: "Enter PAN — Krediflo pulls your complete credit report in 30 seconds.",
    color: "cyan",
  },
  {
    num: "02",
    icon: Database,
    title: "AA Bank Consent",
    sub: "One-tap",
    desc: "Tap once to share your last 6 months' statements via the RBI Account Aggregator framework.",
    color: "amber",
  },
  {
    num: "03",
    icon: CheckCircle2,
    title: "Instant Offers",
    sub: "Live comparison",
    desc: "See personalised offers from 5+ lenders ranked by rate and EMI — apply in under 60 seconds.",
    color: "cyan",
  },
];

export default function PersonalLoanPage() {
  const [principal, setPrincipal] = useState("500000");
  const [rate, setRate]           = useState("10.5");
  const [tenure, setTenure]       = useState("36");
  const calculateEmi = useCalculateEmi();

  return (
    <div className="flex flex-col w-full pb-20">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-[#030d1a] py-24 lg:py-36 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=2071&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/25 via-transparent to-slate-900/60" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#030d1a] to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6"
            >
              <User className="w-3 h-3" /> Personal Loan — Starting 10.50% p.a.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              Sanctioned in Minutes,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Not Days.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-slate-300 mb-8 max-w-2xl"
            >
              API-driven eligibility in seconds. CIBIL score verified automatically. Account Aggregator
              replaces bank statement uploads. No documents, no delays.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/apply">
                <Button size="lg" className="h-13 px-8 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold gap-2 shadow-lg shadow-cyan-500/25 border-0">
                  <Zap className="w-5 h-5" /> Sync &amp; Go — Apply Now
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-13 px-8 border-slate-600 text-slate-200 hover:bg-slate-800">
                  Check Eligibility
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-12 flex flex-wrap gap-8"
            >
              {[
                { v: "10.5%",  l: "Starting p.a."  },
                { v: "₹40L",   l: "Max Loan"       },
                { v: "60 sec", l: "Eligibility"    },
                { v: "Zero",   l: "Doc Uploads"    },
              ].map(({ v, l }) => (
                <div key={l}>
                  <p className="text-xl font-bold text-cyan-400">{v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── API Status ───────────────────────────────────────────────────────── */}
      <ApiStatusBar />

      {/* ── Sync & Go 3-step flow ────────────────────────────────────────────── */}
      <section className="py-24 bg-[#040f1f]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-400 mb-3">Sync &amp; Go Flow</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              From Intent to Offer in 3 Steps
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Most applicants complete the Krediflo checkout in under 3 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 max-w-4xl mx-auto">
            {SYNC_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative flex flex-col items-start p-8"
              >
                {i < SYNC_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-14 right-0 w-full h-px bg-gradient-to-r from-cyan-500/30 to-transparent translate-x-1/2 z-0" />
                )}
                <div className={`relative z-10 w-12 h-12 rounded-xl border flex items-center justify-center mb-5 ${step.color === "cyan" ? "bg-cyan-500/10 border-cyan-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                  <step.icon className={`w-5 h-5 ${step.color === "cyan" ? "text-cyan-400" : "text-amber-400"}`} />
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${step.color === "cyan" ? "text-cyan-500" : "text-amber-500"}`}>
                  Step {step.num} — {step.sub}
                </p>
                <h3 className="font-bold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/apply">
              <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 gap-2 border-0">
                Start Sync &amp; Go <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── EMI Calculator ───────────────────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-500 mb-3">Financial Tools</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Personal Loan EMI Calculator</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Calculate your exact monthly outgo before applying.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <Card className="shadow-xl border-border/60">
              <CardContent className="p-4 sm:p-8">
                <div className="space-y-5">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Loan Amount (₹)</Label>
                    <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)}
                      className="h-11 font-mono text-lg" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Interest Rate (% p.a.)</Label>
                      <Input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)}
                        className="h-11 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Tenure (Months)</Label>
                      <Input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)}
                        className="h-11 font-mono" />
                    </div>
                  </div>

                  {/* Quick tenure toggle */}
                  <div className="flex gap-2">
                    {[["12","12"], ["24","24"], ["36","36"], ["48","48"], ["60","60"]].map(([label, val]) => (
                      <button key={val} onClick={() => setTenure(val)}
                        className={`flex-1 h-11 rounded-lg border text-xs font-semibold transition-all ${tenure === val ? "bg-cyan-500 text-slate-950 border-cyan-500" : "border-border text-muted-foreground hover:border-cyan-400"}`}>
                        {label}m
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={() => calculateEmi.mutate({ data: { principal: Number(principal), interestRate: Number(rate), tenureMonths: Number(tenure) } })}
                    disabled={calculateEmi.isPending}
                    className="w-full h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold border-0"
                  >
                    {calculateEmi.isPending ? "Calculating…" : "Calculate EMI"}
                  </Button>

                  {calculateEmi.data && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Monthly EMI</p>
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400 font-mono">
                          ₹{calculateEmi.data.emi.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Interest</p>
                        <p className="text-2xl font-bold font-mono">
                          ₹{calculateEmi.data.totalInterest.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Eligibility Meter ────────────────────────────────────────────────── */}
      <EligibilityMeter type="personal" />

      {/* ── Document Checklist ───────────────────────────────────────────────── */}
      <DocChecklist type="personal" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <SyncProfileCTA
        heading="From Application to Sanction in 60 Minutes."
        sub="No branch visits, no PDF uploads. Just your PAN and one-tap AA consent."
      />
    </div>
  );
}
