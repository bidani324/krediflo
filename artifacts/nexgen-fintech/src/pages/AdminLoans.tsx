import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAdminListLoans } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, ArrowRight, Users } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  docs_procured: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  sent_to_bank: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  approved: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  lap: "LAP",
  home: "Home Loan",
  personal: "Personal Loan",
  business: "Business Loan",
};

function formatCurrency(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

export default function AdminLoans() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading } = useAdminListLoans(
    statusFilter !== "all" ? { status: statusFilter, search: debouncedSearch || undefined } : { search: debouncedSearch || undefined }
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    clearTimeout((window as any)._searchTimeout);
    (window as any)._searchTimeout = setTimeout(() => setDebouncedSearch(e.target.value), 400);
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Master Case File</h1>
            <p className="text-sm text-muted-foreground">All loan applications — {data?.total ?? 0} total</p>
          </div>
          <Link href="/admin/create">
            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="button-create-loan">
              <Plus className="w-4 h-4 mr-2" /> New Application
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="border border-border mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by applicant name, email, or mobile..."
                  value={search}
                  onChange={handleSearchChange}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="docs_procured">Docs Ready</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="sent_to_bank">Sent to Bank</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loans List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="border border-border">
                <CardContent className="pt-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !data?.loans.length ? (
          <Card className="border border-border">
            <CardContent className="py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.loans.map((loan, i) => {
              const primary = loan.applicants.find(a => a.applicantType === "primary");
              return (
                <motion.div key={loan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className="border border-border hover:border-cyan-200 dark:hover:border-cyan-800 transition-colors" data-testid={`loan-card-${loan.id}`}>
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              #{loan.id} — {LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[loan.status] ?? "bg-slate-100 text-slate-700"}`}>
                              {loan.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          {primary && (
                            <p className="text-sm text-muted-foreground truncate">
                              {primary.firstName} {primary.lastName} · {primary.mobile} · {primary.email}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(loan.loanAmount)}</span>
                            <span>{loan.tenure} months</span>
                            <span>{loan.applicants.length} applicant{loan.applicants.length !== 1 ? "s" : ""}</span>
                            <span>{format(new Date(loan.createdAt), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                        <Link href={`/admin/loans/${loan.id}`}>
                          <Button variant="outline" size="sm" className="shrink-0" data-testid={`button-view-loan-${loan.id}`}>
                            View Case <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
