import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Save, Plus, Trash2, User, Building2, Users, Briefcase, CreditCard, ChevronDown, ChevronRight, Sparkles, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

type LoanEntry = { bankName: string; loanAmount: string; loanType: string; startDate: string; endDate: string; currentBalance: string };

const emptyLoan: LoanEntry = { bankName: "", loanAmount: "", loanType: "", startDate: "", endDate: "", currentBalance: "" };

function Section({ title, icon: Icon, children, defaultOpen = true, prefilled = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean; prefilled?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`border ${prefilled ? "border-cyan-200 dark:border-cyan-800/50" : "border-border"}`}>
      <CardHeader className="cursor-pointer py-4" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${prefilled ? "text-cyan-600" : "text-cyan-600"}`} />
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {prefilled && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Auto-filled
              </span>
            )}
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 pb-5">{children}</CardContent>}
    </Card>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text", highlighted = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; highlighted?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className={`h-9 text-sm ${highlighted && value ? "border-cyan-300 dark:border-cyan-700 bg-cyan-50/30 dark:bg-cyan-900/10" : ""}`}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const emptyPerson = { name: "", mobile: "", email: "", motherName: "", fatherName: "", spouseName: "", qualification: "", dob: "", pan: "", aadhar: "", currentAddress: "", addressProof: "", residenceStatus: "", residenceSince: "" };
const emptyCompany = { name: "", incorporationDate: "", officeAddress: "", officeStatus: "", addressProof: "", gstNumber: "", pan: "", natureOfBusiness: "" };
const emptyRef = { name: "", address: "", mobile: "" };
const emptyTrade = { companyName: "", contactPerson: "", address: "", mobile: "" };

export default function ProfileSheet() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [individual, setIndividual] = useState({ ...emptyPerson });
  const [coApplicant, setCoApplicant] = useState({ ...emptyPerson });
  const [company, setCompany] = useState({ ...emptyCompany });
  const [coCompany, setCoCompany] = useState({ ...emptyCompany });
  const [personalRef1, setPersonalRef1] = useState({ ...emptyRef });
  const [personalRef2, setPersonalRef2] = useState({ ...emptyRef });
  const [tradeRef1, setTradeRef1] = useState({ ...emptyTrade });
  const [tradeRef2, setTradeRef2] = useState({ ...emptyTrade });
  const [existingLoans, setExistingLoans] = useState<LoanEntry[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-detail-sheet"],
    queryFn: () => apiFetch("/api/profile/detail-sheet"),
  });

  const isPrefilled = data?.prefilled === true && !bannerDismissed;
  const prefillSource = data?.prefillSource as string | undefined;

  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    if (d.individual) setIndividual({ ...emptyPerson, ...d.individual });
    if (d.coApplicant) setCoApplicant({ ...emptyPerson, ...d.coApplicant });
    if (d.company) setCompany({ ...emptyCompany, ...d.company });
    if (d.coCompany) setCoCompany({ ...emptyCompany, ...d.coCompany });
    if (d.personalRef1) setPersonalRef1({ ...emptyRef, ...d.personalRef1 });
    if (d.personalRef2) setPersonalRef2({ ...emptyRef, ...d.personalRef2 });
    if (d.tradeRef1) setTradeRef1({ ...emptyTrade, ...d.tradeRef1 });
    if (d.tradeRef2) setTradeRef2({ ...emptyTrade, ...d.tradeRef2 });
    if (d.existingLoans) setExistingLoans(d.existingLoans);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: any) => apiFetch("/api/profile/detail-sheet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-detail-sheet"] });
      setBannerDismissed(false);
      toast({ title: "Detail sheet saved", description: "Your information has been saved successfully." });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    mutation.mutate({ individual, coApplicant, company, coCompany, personalRef1, personalRef2, tradeRef1, tradeRef2, existingLoans });
  };

  const updatePerson = (setter: React.Dispatch<React.SetStateAction<typeof emptyPerson>>) => (field: string) => (v: string) =>
    setter((p) => ({ ...p, [field]: v }));

  const updateCompany = (setter: React.Dispatch<React.SetStateAction<typeof emptyCompany>>) => (field: string) => (v: string) =>
    setter((p) => ({ ...p, [field]: v }));

  const updateLoan = (idx: number, field: keyof LoanEntry) => (v: string) =>
    setExistingLoans((ls) => ls.map((l, i) => i === idx ? { ...l, [field]: v } : l));

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const ia = updatePerson(setIndividual);
  const ca = updatePerson(setCoApplicant);
  const ic = updateCompany(setCompany);
  const cc = updateCompany(setCoCompany);

  const hasCoApplicant = !!(data?.data?.coApplicant?.name);
  const hasCompany = !!(data?.data?.company?.name) || !!(company.name);
  const iPreFilled = data?.prefilled && !!data?.data?.individual;
  const coPrefilled = data?.prefilled && !!data?.data?.coApplicant;
  const compPrefilled = data?.prefilled && !!data?.data?.company;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Detail Sheet</h1>
              <p className="text-sm text-muted-foreground">Required by banks and NBFCs for loan processing</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard"><Button variant="outline" size="sm">← Dashboard</Button></Link>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white gap-2"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              <Save className="w-4 h-4" />
              {mutation.isPending ? "Saving…" : "Save Sheet"}
            </Button>
          </div>
        </div>

        {/* Pre-fill banner */}
        <AnimatePresence>
          {isPrefilled && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50"
            >
              <Sparkles className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">
                  Details pre-filled from your loan application
                </p>
                <p className="text-xs text-cyan-700/80 dark:text-cyan-400/80 mt-0.5">
                  Your name, mobile, PAN, address, and company details have been pulled from{" "}
                  <span className="font-medium">{prefillSource ?? "your application"}</span>. Review the fields below, fill in any missing information, and click <strong>Save Sheet</strong> to confirm.
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-cyan-500 hover:text-cyan-700 dark:text-cyan-400 flex-shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved indicator */}
        {data?.updatedAt && !data?.prefilled && (
          <div className="mb-5 flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Last saved: {new Date(data.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        )}

        <div className="space-y-4">
          <Section title="Applicant — Individual Details" icon={User} defaultOpen prefilled={!!iPreFilled}>
            <FieldGrid>
              <Field label="Full Name" value={individual.name} onChange={ia("name")} highlighted={!!iPreFilled} />
              <Field label="Mobile No." value={individual.mobile} onChange={ia("mobile")} type="tel" highlighted={!!iPreFilled} />
              <Field label="Email ID" value={individual.email} onChange={ia("email")} type="email" highlighted={!!iPreFilled} />
              <Field label="PAN No." value={individual.pan} onChange={ia("pan")} placeholder="ABCDE1234F" highlighted={!!iPreFilled} />
              <Field label="Aadhar No." value={individual.aadhar} onChange={ia("aadhar")} placeholder="XXXX XXXX XXXX" />
              <Field label="Date of Birth" value={individual.dob} onChange={ia("dob")} type="date" highlighted={!!iPreFilled} />
              <Field label="Father's Name" value={individual.fatherName} onChange={ia("fatherName")} />
              <Field label="Mother's Name" value={individual.motherName} onChange={ia("motherName")} />
              <Field label="Spouse Name" value={individual.spouseName} onChange={ia("spouseName")} />
              <Field label="Qualification" value={individual.qualification} onChange={ia("qualification")} />
              <Field label="Current Address" value={individual.currentAddress} onChange={ia("currentAddress")} highlighted={!!iPreFilled} />
              <Field label="Address Proof" value={individual.addressProof} onChange={ia("addressProof")} placeholder="Aadhar / Passport / Utility Bill" />
              <SelectField label="Residence Status" value={individual.residenceStatus} onChange={ia("residenceStatus")} options={["Owned", "Rented", "Company Provided", "Parental"]} />
              <Field label="Residing Since" value={individual.residenceSince} onChange={ia("residenceSince")} placeholder="e.g. Jan 2015" />
            </FieldGrid>
          </Section>

          <Section title="Co-Applicant — Individual Details" icon={Users} defaultOpen={hasCoApplicant} prefilled={!!coPrefilled}>
            <FieldGrid>
              <Field label="Full Name" value={coApplicant.name} onChange={ca("name")} highlighted={!!coPrefilled} />
              <Field label="Mobile No." value={coApplicant.mobile} onChange={ca("mobile")} type="tel" highlighted={!!coPrefilled} />
              <Field label="Email ID" value={coApplicant.email} onChange={ca("email")} type="email" highlighted={!!coPrefilled} />
              <Field label="PAN No." value={coApplicant.pan} onChange={ca("pan")} placeholder="ABCDE1234F" highlighted={!!coPrefilled} />
              <Field label="Aadhar No." value={coApplicant.aadhar} onChange={ca("aadhar")} />
              <Field label="Date of Birth" value={coApplicant.dob} onChange={ca("dob")} type="date" highlighted={!!coPrefilled} />
              <Field label="Father's Name" value={coApplicant.fatherName} onChange={ca("fatherName")} />
              <Field label="Mother's Name" value={coApplicant.motherName} onChange={ca("motherName")} />
              <Field label="Spouse Name" value={coApplicant.spouseName} onChange={ca("spouseName")} />
              <Field label="Qualification" value={coApplicant.qualification} onChange={ca("qualification")} />
              <Field label="Current Address" value={coApplicant.currentAddress} onChange={ca("currentAddress")} highlighted={!!coPrefilled} />
              <Field label="Address Proof" value={coApplicant.addressProof} onChange={ca("addressProof")} />
              <SelectField label="Residence Status" value={coApplicant.residenceStatus} onChange={ca("residenceStatus")} options={["Owned", "Rented", "Company Provided", "Parental"]} />
              <Field label="Residing Since" value={coApplicant.residenceSince} onChange={ca("residenceSince")} />
            </FieldGrid>
          </Section>

          <Section title="Applicant — Company Details" icon={Building2} defaultOpen={hasCompany} prefilled={!!compPrefilled}>
            <FieldGrid>
              <Field label="Company Name" value={company.name} onChange={ic("name")} highlighted={!!compPrefilled} />
              <Field label="Date of Incorporation" value={company.incorporationDate} onChange={ic("incorporationDate")} type="date" />
              <Field label="Office Address" value={company.officeAddress} onChange={ic("officeAddress")} highlighted={!!compPrefilled} />
              <SelectField label="Office Status" value={company.officeStatus} onChange={ic("officeStatus")} options={["Owned", "Rented"]} />
              <Field label="Address Proof" value={company.addressProof} onChange={ic("addressProof")} />
              <Field label="GST Registration No." value={company.gstNumber} onChange={ic("gstNumber")} />
              <Field label="Company PAN No." value={company.pan} onChange={ic("pan")} />
              <Field label="Nature of Business" value={company.natureOfBusiness} onChange={ic("natureOfBusiness")} highlighted={!!compPrefilled} />
            </FieldGrid>
          </Section>

          <Section title="Co-Applicant — Company Details" icon={Building2} defaultOpen={false}>
            <FieldGrid>
              <Field label="Company Name" value={coCompany.name} onChange={cc("name")} />
              <Field label="Date of Incorporation" value={coCompany.incorporationDate} onChange={cc("incorporationDate")} type="date" />
              <Field label="Office Address" value={coCompany.officeAddress} onChange={cc("officeAddress")} />
              <SelectField label="Office Status" value={coCompany.officeStatus} onChange={cc("officeStatus")} options={["Owned", "Rented"]} />
              <Field label="Address Proof" value={coCompany.addressProof} onChange={cc("addressProof")} />
              <Field label="GST Registration No." value={coCompany.gstNumber} onChange={cc("gstNumber")} />
              <Field label="Company PAN No." value={coCompany.pan} onChange={cc("pan")} />
              <Field label="Nature of Business" value={coCompany.natureOfBusiness} onChange={cc("natureOfBusiness")} />
            </FieldGrid>
          </Section>

          <Section title="Personal References" icon={Users} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference 1</p>
                <Field label="Name" value={personalRef1.name} onChange={(v) => setPersonalRef1(p => ({ ...p, name: v }))} />
                <Field label="Mobile No." value={personalRef1.mobile} onChange={(v) => setPersonalRef1(p => ({ ...p, mobile: v }))} />
                <Field label="Address" value={personalRef1.address} onChange={(v) => setPersonalRef1(p => ({ ...p, address: v }))} />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference 2</p>
                <Field label="Name" value={personalRef2.name} onChange={(v) => setPersonalRef2(p => ({ ...p, name: v }))} />
                <Field label="Mobile No." value={personalRef2.mobile} onChange={(v) => setPersonalRef2(p => ({ ...p, mobile: v }))} />
                <Field label="Address" value={personalRef2.address} onChange={(v) => setPersonalRef2(p => ({ ...p, address: v }))} />
              </div>
            </div>
          </Section>

          <Section title="Trade References" icon={Briefcase} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trade Reference 1</p>
                <Field label="Company Name" value={tradeRef1.companyName} onChange={(v) => setTradeRef1(p => ({ ...p, companyName: v }))} />
                <Field label="Contact Person" value={tradeRef1.contactPerson} onChange={(v) => setTradeRef1(p => ({ ...p, contactPerson: v }))} />
                <Field label="Mobile No." value={tradeRef1.mobile} onChange={(v) => setTradeRef1(p => ({ ...p, mobile: v }))} />
                <Field label="Address" value={tradeRef1.address} onChange={(v) => setTradeRef1(p => ({ ...p, address: v }))} />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trade Reference 2</p>
                <Field label="Company Name" value={tradeRef2.companyName} onChange={(v) => setTradeRef2(p => ({ ...p, companyName: v }))} />
                <Field label="Contact Person" value={tradeRef2.contactPerson} onChange={(v) => setTradeRef2(p => ({ ...p, contactPerson: v }))} />
                <Field label="Mobile No." value={tradeRef2.mobile} onChange={(v) => setTradeRef2(p => ({ ...p, mobile: v }))} />
                <Field label="Address" value={tradeRef2.address} onChange={(v) => setTradeRef2(p => ({ ...p, address: v }))} />
              </div>
            </div>
          </Section>

          <Section title="Existing Loan Obligations" icon={CreditCard} defaultOpen={false}>
            <div className="space-y-3">
              {existingLoans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No existing loans added. Click below to add one.</p>
              ) : (
                <div className="space-y-3">
                  {existingLoans.map((loan, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/20 relative">
                      <Button
                        size="icon" variant="ghost"
                        className="absolute right-2 top-2 w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setExistingLoans(ls => ls.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-8">
                        <Field label="Bank Name" value={loan.bankName} onChange={updateLoan(idx, "bankName")} />
                        <Field label="Loan Amount (₹)" value={loan.loanAmount} onChange={updateLoan(idx, "loanAmount")} />
                        <Field label="Type of Loan" value={loan.loanType} onChange={updateLoan(idx, "loanType")} placeholder="Home / LAP / Personal…" />
                        <Field label="Start Date" value={loan.startDate} onChange={updateLoan(idx, "startDate")} type="date" />
                        <Field label="End Date" value={loan.endDate} onChange={updateLoan(idx, "endDate")} type="date" />
                        <Field label="Current Balance (₹)" value={loan.currentBalance} onChange={updateLoan(idx, "currentBalance")} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline" size="sm"
                className="gap-2 border-dashed"
                onClick={() => setExistingLoans(ls => [...ls, { ...emptyLoan }])}
              >
                <Plus className="w-3.5 h-3.5" /> Add Loan Entry
              </Button>
            </div>
          </Section>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white gap-2 px-8"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? "Saving…" : "Save All Changes"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
