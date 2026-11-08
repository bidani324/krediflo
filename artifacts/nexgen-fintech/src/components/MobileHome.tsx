import { Link } from "wouter";
import { ArrowRight, Activity, ChevronRight, Zap, Shield, CheckCircle2, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Product = {
  icon: ComponentType<{ className?: string }>;
  label: string; rate: string; highlight: string; description: string; href: string;
};
type Step = { step: string; title: string; desc: string };

export function MobileHome({ products, steps }: { products: Product[]; steps: Step[] }) {
  const { user } = useAuth();
  return (
    <div className="kf-mhome md:hidden px-[18px] pt-4 pb-6" data-testid="mobile-home">
      {user && <p className="text-sm text-muted-foreground mb-3 text-right">Hi, {user.firstName}</p>}
      <section className="kf-hero">
        <span className="kf-badge"><Zap className="h-3 w-3" /> DSA Partner — 40+ Banks &amp; NBFCs</span>
        <h1 className="kf-hero-title">Seamless Data.<br /><span>Effortless Credit.</span></h1>
        <p className="kf-hero-sub">Real-time CIBIL, Account Aggregator and MCA verification — no PDFs, no branch visits.</p>
        <Link href="/apply" className="kf-btn kf-btn-grad" data-testid="button-check-eligibility">
          Check Eligibility <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/dashboard" className="kf-btn kf-btn-outline" data-testid="button-track-applications">
          <Activity className="h-4 w-4" /> Track My Applications
        </Link>
      </section>

      <h2 className="kf-h2">Loan Products</h2>
      <div className="grid gap-3">
        {products.map(p => (
          <Link key={p.href} href={p.href} className="kf-card kf-product" data-testid={`card-product-${p.href.slice(1)}`}>
            <span className="kf-picon"><p.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="kf-eyebrow">{p.highlight}</span>
              <span className="block text-[15px] font-semibold text-foreground">{p.label}</span>
              <span className="block text-xs text-muted-foreground leading-[17px] mt-0.5">{p.description}</span>
              <span className="block text-xs font-semibold mt-1.5" style={{ color: "#F59E0B" }}>Starting {p.rate}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      <h2 className="kf-h2">How Krediflo Works</h2>
      <div className="kf-card grid gap-4">
        {steps.map(s => (
          <div key={s.step} className="flex gap-3 items-start">
            <span className="kf-step">{s.step}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-[17px] mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" />SSL Encrypted</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />RBI-Compliant AA</span>
        <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" />Live Tracking</span>
      </div>
    </div>
  );
}
