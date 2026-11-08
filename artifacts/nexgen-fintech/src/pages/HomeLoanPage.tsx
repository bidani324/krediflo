import { motion } from "framer-motion";
import { Link } from "wouter";
import { Home as HomeIcon, ArrowRight, Percent, TrendingDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiStatusBar, DocChecklist, LBTCalculator, SyncProfileCTA } from "./products/ProductBlocks";

const WHY = [
  {
    icon: Percent,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Lowest Rate. Guaranteed.",
    desc: "8.40% p.a. starting rates via exclusive DSA relationships with 40+ banks. We negotiate on your behalf.",
  },
  {
    icon: TrendingDown,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    title: "BT Reduces Tenure by Years",
    desc: "Even a 1% rate reduction on ₹50L for 20 years saves ₹7.5L+. Our balance transfer team makes it seamless.",
  },
  {
    icon: ShieldCheck,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Zero Physical Doc Uploads",
    desc: "CIBIL, PAN, and Bank Statements are auto-fetched via APIs. Just bring original property documents.",
  },
];

export default function HomeLoanPage() {
  return (
    <div className="flex flex-col w-full pb-20">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-[#030d1a] py-24 lg:py-36 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-transparent to-slate-900/60" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#030d1a] to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6"
            >
              <HomeIcon className="w-3 h-3" /> Home Loan — Starting 8.40% p.a.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              India's Lowest Home Loan Rates.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Period.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-slate-300 mb-8 max-w-2xl"
            >
              40+ bank partners. Automated eligibility via CIBIL + Account Aggregator. Balance transfer
              calculator that shows you exactly how much you save — before you sign.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/apply">
                <Button size="lg" className="h-13 px-8 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold gap-2 shadow-lg shadow-cyan-500/25 border-0">
                  Apply for Home Loan <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#balance-transfer">
                <Button size="lg" variant="outline" className="h-13 px-8 border-slate-600 text-slate-200 hover:bg-slate-800">
                  Balance Transfer Calculator
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-12 flex flex-wrap gap-8"
            >
              {[
                { v: "8.40%", l: "Starting p.a." },
                { v: "90%",   l: "Max LTV"       },
                { v: "30 Yrs",l: "Max Tenure"    },
                { v: "40+",   l: "Bank Partners" },
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

      {/* ── BT Calculator ────────────────────────────────────────────────────── */}
      <LBTCalculator defaultNewRate="8.4" anchor="balance-transfer" focusLabel="Tenure Reduction" />

      {/* ── Why Krediflo ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-cyan-500 mb-3">Why Krediflo</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">More Than a DSA</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A full-stack home loan fintech platform built on real-time API integrations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {WHY.map((item, i) => (
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
      <DocChecklist type="home" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <SyncProfileCTA
        heading="Your Dream Home. Synced in Seconds."
        sub="Apply now and get a sanction letter from our bank partners within 48 hours."
      />
    </div>
  );
}
