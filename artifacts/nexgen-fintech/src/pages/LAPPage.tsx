import { motion } from "framer-motion";
import { Link } from "wouter";
import { Landmark, ArrowRight, Building2, Home as HomeIcon, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiStatusBar, DocChecklist, LTVEstimator, LBTCalculator, SyncProfileCTA } from "./products/ProductBlocks";

const PROPERTY_TYPES = [
  { icon: HomeIcon,   label: "Residential",         note: "Flat / Villa / Plot — up to 70% LTV",      color: "text-cyan-400",  bg: "bg-cyan-500/10 border-cyan-500/20" },
  { icon: Building2,  label: "Commercial",          note: "Office / Warehouse — up to 60% LTV",       color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { icon: Store,      label: "Industrial / Mixed",  note: "Factory / Plot — up to 55% LTV",           color: "text-cyan-400",  bg: "bg-cyan-500/10 border-cyan-500/20" },
  { icon: Landmark,   label: "Self-Occupied",       note: "Business premises — LAP with MCA API link", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
];

export default function LAPPage() {
  return (
    <div className="flex flex-col w-full pb-20">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-[#030d1a] py-24 lg:py-36 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-blue-900/20" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#030d1a] to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6"
            >
              <Landmark className="w-3 h-3" /> Loan Against Property — Starting 9.00% p.a.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6"
            >
              Unlock Capital from{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400">
                Any Property Type.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-slate-300 mb-8 max-w-2xl"
            >
              Residential, commercial, or industrial — we work with all property types. MCA verification
              auto-links your business credentials. Loan to value up to 70%.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/apply">
                <Button size="lg" className="h-13 px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2 shadow-lg shadow-amber-500/25">
                  Unlock My Property's Value <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/apply">
                <Button size="lg" variant="outline" className="h-13 px-8 border-slate-600 text-slate-200 hover:bg-slate-800">
                  LTV Estimator ↓
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
                { v: "9.00%",  l: "Starting p.a."   },
                { v: "70%",    l: "Max Res. LTV"     },
                { v: "60%",    l: "Max Comm. LTV"    },
                { v: "15 Yrs", l: "Max Tenure"       },
              ].map(({ v, l }) => (
                <div key={l}>
                  <p className="text-xl font-bold text-amber-400">{v}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── API Status ───────────────────────────────────────────────────────── */}
      <ApiStatusBar highlightMca />

      {/* ── LTV Estimator ────────────────────────────────────────────────────── */}
      <LTVEstimator />

      {/* ── Property Types Accepted ──────────────────────────────────────────── */}
      <section className="py-20 bg-[#040f1f]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-400 mb-3">Property Coverage</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">All Property Types Accepted</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Unlike many lenders, Krediflo processes LAP on residential, commercial, and mixed-use properties.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {PROPERTY_TYPES.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className={`p-6 rounded-2xl border ${p.bg} h-full`}>
                  <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center mb-4`}>
                    <p.icon className={`w-5 h-5 ${p.color}`} />
                  </div>
                  <h3 className={`font-bold text-white mb-2`}>{p.label}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BT Calculator ────────────────────────────────────────────────────── */}
      <LBTCalculator defaultNewRate="9.0" anchor="balance-transfer" focusLabel="Rate Reduction Savings" />

      {/* ── Document Checklist ───────────────────────────────────────────────── */}
      <DocChecklist type="lap" />

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <SyncProfileCTA
        heading="Your Property. Unlocked in 48 Hours."
        sub="Get your LTV estimate and sanction letter without stepping into a bank."
      />
    </div>
  );
}
