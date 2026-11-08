import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight, Calculator, PieChart, Zap, ShieldCheck, Building2,
  Database, CheckCircle2, ChevronRight, Home as HomeIcon, Landmark,
  Briefcase, User, TrendingUp,
} from "lucide-react";
import { MobileHome } from "@/components/MobileHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCalculateEmi, useCalculateBalanceTransfer } from "@workspace/api-client-react";

const BANKS = [
  "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Bajaj Finserv",
  "Kotak Mahindra", "Yes Bank", "PNB", "IDFC First Bank", "LIC HFL",
  "Tata Capital", "Aditya Birla", "L&T Finance", "Fullerton India", "Piramal Finance",
];

const LOAN_PRODUCTS = [
  {
    icon: HomeIcon,
    label: "Home Loan",
    rate: "8.40% p.a.",
    highlight: "New purchase & balance transfer",
    description: "Finance your dream home or reduce your existing EMI with our BT savings calculator.",
    href: "/home-loan",
    color: "text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    icon: Landmark,
    label: "Loan Against Property",
    rate: "9.00% p.a.",
    highlight: "High value, low interest",
    description: "Unlock the equity in your residential or commercial property for capital needs.",
    href: "/lap",
    color: "text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    icon: Briefcase,
    label: "Business Loan",
    rate: "11.00% p.a.",
    highlight: "MCA-verified processing",
    description: "Automatic director details and financial standing via MCA API for faster working capital.",
    href: "/business-loan",
    color: "text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: User,
    label: "Personal Loan",
    rate: "10.50% p.a.",
    highlight: "Instant eligibility check",
    description: "API-driven eligibility in seconds. CIBIL score verified automatically — no documents needed.",
    href: "/personal-loan",
    color: "text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Select Your Loan",
    desc: "Choose from Home, LAP, Business, or Personal loans.",
  },
  {
    step: "02",
    title: "Instant Verification",
    desc: "Enter your PAN — we fetch your CIBIL and MCA profile via API in 30 seconds.",
  },
  {
    step: "03",
    title: "AA Consent",
    desc: "Authorize the Account Aggregator to share your last 6 months' bank statements — no PDF uploads.",
  },
  {
    step: "04",
    title: "See Your Options",
    desc: '"You are eligible for loans from 5 partners." Compare offers and apply instantly.',
  },
];

export default function Home() {
  const [emiPrincipal, setEmiPrincipal] = useState("5000000");
  const [emiRate, setEmiRate] = useState("8.5");
  const [emiTenure, setEmiTenure] = useState("240");

  const [btPrincipal, setBtPrincipal] = useState("5000000");
  const [btCurrentRate, setBtCurrentRate] = useState("9.5");
  const [btNewRate, setBtNewRate] = useState("8.5");
  const [btTenure, setBtTenure] = useState("240");

  const calculateEmi = useCalculateEmi();
  const calculateBt = useCalculateBalanceTransfer();

  const handleEmiCalculate = () => {
    calculateEmi.mutate({ data: { principal: Number(emiPrincipal), interestRate: Number(emiRate), tenureMonths: Number(emiTenure) } });
  };

  const handleBtCalculate = () => {
    calculateBt.mutate({ data: { currentPrincipal: Number(btPrincipal), currentRate: Number(btCurrentRate), newRate: Number(btNewRate), remainingTenureMonths: Number(btTenure), processingFee: 10000 } });
  };

  return (
    <div className="flex flex-col w-full pb-20">
      <MobileHome products={LOAN_PRODUCTS} steps={HOW_IT_WORKS} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hidden md:block relative w-full bg-[#030d1a] py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639762681057-408e52192e55?q=80&w=2832&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-transparent to-blue-900/10" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#030d1a] to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <Zap className="w-3 h-3" /> Official DSA Partner — 40+ Banks & NBFCs
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6"
            >
              Seamless Data.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Effortless Credit.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl"
            >
              Krediflo connects your credit profile, bank statements, and business data through a single API layer — real-time CIBIL, Account Aggregator, and MCA verification with no PDFs or branch visits.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/apply">
                <Button size="lg" className="w-full sm:w-auto text-base h-13 px-8 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-semibold border-0 shadow-lg shadow-cyan-500/25">
                  Check Eligibility <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-13 px-8 border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white">
                  Track My Application
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 flex flex-wrap gap-6"
            >
              {[
                { icon: ShieldCheck, label: "SSL Encrypted Data" },
                { icon: CheckCircle2, label: "RBI-Compliant AA" },
                { icon: TrendingUp, label: "Live Loan Tracking" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                  <Icon className="w-4 h-4 text-cyan-400" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ────────────────────────────────────────── */}
      <section className="hidden md:block py-10 bg-[#040f1f] border-y border-cyan-900/30 overflow-hidden">
        <div className="container mx-auto px-4 mb-4 text-center">
          <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">Trusted by leading banks &amp; NBFCs</p>
        </div>
        <div className="relative flex overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...BANKS, ...BANKS].map((bank, i) => (
              <span
                key={i}
                className="inline-flex items-center mx-6 text-slate-400 font-semibold text-sm tracking-wide border border-slate-800 rounded-full px-5 py-2 bg-slate-900/50 flex-shrink-0"
              >
                {bank}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Krediflo Engine ──────────────────────────────────── */}
      <section className="hidden md:block py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">The Krediflo Engine</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Three core data flows that eliminate paperwork and accelerate your loan approval.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Database,
                color: "text-cyan-400",
                bg: "bg-cyan-500/10 border-cyan-500/20",
                title: "Instant CIBIL",
                tag: "Credit Report API",
                desc: "Your complete credit profile — score, accounts, enquiries — fetched from the bureau in 30 seconds. No PDF, no branch.",
              },
              {
                icon: Zap,
                color: "text-blue-400",
                bg: "bg-blue-400/10 border-blue-400/20",
                title: "Account Aggregator",
                tag: "Paperless Income Proof",
                desc: "One-tap consent shares your last 6 months' bank statements directly with lenders via the RBI-approved AA framework.",
              },
              {
                icon: Building2,
                color: "text-emerald-400",
                bg: "bg-emerald-400/10 border-emerald-400/20",
                title: "Business Health (MCA)",
                tag: "MCA API Integration",
                desc: "Automatic fetching of Director details, company standing, and financials for Business Loan processing — zero manual entry.",
              },
            ].map(({ icon: Icon, color, bg, title, tag, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <Card className="h-full border-border/60 hover:border-cyan-500/30 transition-colors duration-300 hover:shadow-lg hover:shadow-cyan-900/10">
                  <CardContent className="pt-8 pb-8 flex flex-col gap-5">
                    <div className={`w-12 h-12 rounded-xl border ${bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold tracking-widest uppercase mb-1.5 ${color}`}>{tag}</p>
                      <h3 className="text-xl font-bold mb-2">{title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Loan Products ────────────────────────────────────── */}
      <section className="hidden md:block py-24 bg-slate-50 dark:bg-slate-900/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Loan Products</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Compare and apply for the right product — all from one platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {LOAN_PRODUCTS.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <Card className="h-full border-border/60 hover:shadow-md transition-all duration-300 group">
                  <CardContent className="pt-7 pb-7 flex flex-col gap-4">
                    <div className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center`}>
                      <p.icon className={`w-5 h-5 ${p.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[10px] font-semibold tracking-widest uppercase mb-1 ${p.color}`}>{p.highlight}</p>
                      <h3 className="text-base font-bold mb-1">{p.label}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.description}</p>
                      <p className="text-sm font-semibold text-amber-500">Starting {p.rate}</p>
                    </div>
                    <Link href={p.href}>
                      <Button variant="outline" size="sm" className="w-full gap-1 group-hover:border-cyan-500/50 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        Apply Now <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="hidden md:block py-24 bg-[#030d1a]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How Krediflo Works</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Four steps from intent to eligible. Most users complete verification in under 3 minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative flex flex-col items-start p-6"
              >
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-10 right-0 w-full h-px bg-gradient-to-r from-cyan-500/30 to-transparent translate-x-1/2 z-0" />
                )}
                <div className="relative z-10 w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4">
                  <span className="text-cyan-400 font-bold text-sm">{item.step}</span>
                </div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/apply">
              <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25 gap-2 border-0">
                Start My Eligibility Check <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Calculators ──────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Financial Engineering Tools</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Model your loan scenarios with our institutional-grade calculators.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* EMI Calculator */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-cyan-500" /> EMI Calculator
                </CardTitle>
                <CardDescription>Calculate your monthly outgo precisely.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="principal">Loan Amount (₹)</Label>
                    <Input id="principal" type="number" value={emiPrincipal} onChange={e => setEmiPrincipal(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="rate">Interest Rate (%)</Label>
                      <Input id="rate" type="number" step="0.1" value={emiRate} onChange={e => setEmiRate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tenure">Tenure (Months)</Label>
                      <Input id="tenure" type="number" value={emiTenure} onChange={e => setEmiTenure(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleEmiCalculate} disabled={calculateEmi.isPending} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0">
                    {calculateEmi.isPending ? "Calculating…" : "Calculate EMI"}
                  </Button>
                  {calculateEmi.data && (
                    <div className="mt-2 p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/30 flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly EMI</p>
                        <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">₹{calculateEmi.data.emi.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Interest</p>
                        <p className="text-lg font-semibold">₹{calculateEmi.data.totalInterest.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Balance Transfer ROI */}
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-cyan-500" /> Balance Transfer ROI
                </CardTitle>
                <CardDescription>Evaluate if transferring your loan saves money.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="bt-principal">Outstanding Principal (₹)</Label>
                    <Input id="bt-principal" type="number" value={btPrincipal} onChange={e => setBtPrincipal(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bt-crate">Current Rate (%)</Label>
                      <Input id="bt-crate" type="number" step="0.1" value={btCurrentRate} onChange={e => setBtCurrentRate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bt-nrate">New Rate (%)</Label>
                      <Input id="bt-nrate" type="number" step="0.1" value={btNewRate} onChange={e => setBtNewRate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bt-tenure">Months Left</Label>
                      <Input id="bt-tenure" type="number" value={btTenure} onChange={e => setBtTenure(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleBtCalculate} disabled={calculateBt.isPending} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0">
                    {calculateBt.isPending ? "Analyzing…" : "Analyze Savings"}
                  </Button>
                  {calculateBt.data && (
                    <div className="mt-2 p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/30">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-muted-foreground">Net Savings</p>
                        <p className={`text-xl font-bold ${calculateBt.data.worthTransferring ? "text-cyan-700 dark:text-cyan-400" : "text-red-600 dark:text-red-400"}`}>
                          ₹{calculateBt.data.netSavingsAfterFees.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Break-even in {calculateBt.data.breakEvenMonths} months</span>
                        <span className={`font-semibold ${calculateBt.data.worthTransferring ? "text-cyan-600" : "text-red-500"}`}>
                          {calculateBt.data.worthTransferring ? "✓ Recommended" : "✗ Not Recommended"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Footer Strip ─────────────────────────────────────── */}
      <section className="hidden md:block py-10 bg-[#030d1a] border-t border-cyan-900/30">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">
              Kredi<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">flo</span>
            </span>
            <span>— Seamless Credit &amp; Data Flow.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-center">
            <span>🔒 SSL Encrypted</span>
            <span>🏛 RBI-Compliant AA</span>
            <span>📍 Lodhi Road, New Delhi</span>
          </div>
        </div>
      </section>
    </div>
  );
}
