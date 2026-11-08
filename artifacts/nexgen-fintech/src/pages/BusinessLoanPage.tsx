import { motion } from "framer-motion";
import { Link } from "wouter";
import { Briefcase, ArrowRight, Building2, Zap, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiStatusBar, DocChecklist, EligibilityMeter, SyncProfileCTA } from "./products/ProductBlocks";

const MCA_POWERS = [
  {
    icon: Building2,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Auto Director KYC",
    desc: "Director names, DIN numbers, and KYC status fetched instantly from MCA21 — zero manual entry.",
  },
  {
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    title: "Company Standing Check",
    desc: "Active / Struck-Off status verified via the Krediflo Instant Verification Engine. Lenders get real-time data, not month-old PDFs.",
  },
  {
    icon: TrendingUp,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Faster Credit Decision",
    desc: "Banks reduce TAT from 10 days to 48 hours when MCA data is pre-populated by Krediflo.",
  },
];

export default function BusinessLoanPage() {
  return (
    <div className="flex flex-col w-full pb-20">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-[#030d1a] py-24 lg:py-36 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-amber-900/10" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#030d1a] to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6"
            >
              <Briefcase className="w-3 h-3" /> Business Loan — Starting 11.00% p.a.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              Zero Collateral.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Instant MCA Verification.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-slate-300 mb-8 max-w-2xl"
            >
              Director details, company standing, and financial health fetched automatically from MCA21 via
              the Krediflo Instant Verification Engine. No collateral required up to ₹75L.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/apply">
                <Button size="lg" className="h-13 px-8 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold gap-2 shadow-lg shadow-cyan-500/25">
                  <Zap className="w-5 h-5" />
                  MCA-Verified Eligibility Check
                </Button>
              </Link>
              <Link href="/apply">
                <Button size="lg" variant="outline" className="h-13 px-8 border-slate-600 text-slate-200 hover:bg-slate-800">
                  Check Eligibility ↓
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
                { v: "11%",    l: "Starting p.a."   },
                { v: "₹2 Cr",  l: "Max Loan"        },
                { v: "Zero",   l: "Collateral ≤75L" },
                { v: "48 hrs", l: "Sanction TAT"    },
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

      {/* ── API Status — MCA highlighted ─────────────────────────────────────── */}
      <ApiStatusBar highlightMca />

      {/* ── Eligibility Meter ────────────────────────────────────────────────── */}
      <EligibilityMeter type="business" />

      {/* ── MCA Power Features ───────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-500 mb-3">MCA API Integration</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powered by the Krediflo Instant Verification Engine</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our MCA integration eliminates the biggest bottleneck in business loan processing.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {MCA_POWERS.map((item, i) => (
              <motion.div key={item.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="h-full border-border/60 hover:shadow-md hover:border-cyan-500/30 transition-all">
                  <CardContent className="pt-7 pb-7 flex flex-col gap-4">
                    <div className={`w-11 h-11 rounded-xl border ${item.bg} flex items-center justify-center`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Document Checklist ───────────────────────────────────────────────── */}
      <DocChecklist type="business" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <SyncProfileCTA
        heading="Business Funding. Verified in Minutes."
        sub="MCA data fetched automatically. Your eligibility check takes under 60 seconds."
      />
    </div>
  );
}
