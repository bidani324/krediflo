import { Link } from "wouter";
import { motion } from "framer-motion";
import { useGetAdminDashboard, useGetStatsOverview, useGetLoanTypeStats, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, FileText, CheckCircle, Clock, Plus, ArrowRight, LayoutDashboard, Zap } from "lucide-react";
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

const LOAN_TYPE_COLORS = ["#00D2FF", "#2563EB", "#8b5cf6", "#0F172A"];

function formatCurrency(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString("en-IN")}`;
}

export default function AdminDashboard() {
  const { data: dashboard, isLoading: dashLoading } = useGetAdminDashboard();
  const { data: stats, isLoading: statsLoading } = useGetStatsOverview();
  const { data: loanTypes } = useGetLoanTypeStats();
  const { data: activity } = useGetRecentActivity();

  const isLoading = dashLoading || statsLoading;

  const statCards = [
    {
      title: "Total Applications",
      value: dashboard?.totalApplications ?? 0,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Total Loan Value",
      value: formatCurrency(stats?.totalValue ?? 0),
      icon: TrendingUp,
      color: "text-cyan-500",
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
    },
    {
      title: "Active Applications",
      value: dashboard?.activeApplications ?? 0,
      icon: Clock,
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Approved",
      value: dashboard?.approvedCount ?? 0,
      icon: CheckCircle,
      color: "text-cyan-500",
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Overview of all loan applications</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/admin/users">
              <Button variant="outline" data-testid="button-manage-users">
                <Users className="w-4 h-4 mr-2" /> Manage Users
              </Button>
            </Link>
            <Link href="/admin/loans">
              <Button variant="outline" data-testid="button-view-all-loans">
                <FileText className="w-4 h-4 mr-2" /> All Applications
              </Button>
            </Link>
            <Link href="/admin/quick-check">
              <Button variant="outline" className="border-cyan-300 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20" data-testid="button-quick-check">
                <Zap className="w-4 h-4 mr-2" /> Quick Check
              </Button>
            </Link>
            <Link href="/admin/create">
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="button-create-application">
                <Plus className="w-4 h-4 mr-2" /> New Application
              </Button>
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, i) => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }}>
              <Card className="border border-border">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid={`stat-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                          {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                        </p>
                      )}
                    </div>
                    <div className={`p-2.5 rounded-lg ${card.bg}`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Status Breakdown Bar Chart */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader>
              <CardTitle className="text-base">Applications by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dashboard?.statusBreakdown ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} tickFormatter={(v) => v.replace(/_/g, " ")} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [v, "Count"]}
                      labelFormatter={(l) => l.replace(/_/g, " ")}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#00D2FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Loan Type Pie Chart */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base">Loan Type Mix</CardTitle>
            </CardHeader>
            <CardContent>
              {!loanTypes ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={loanTypes} dataKey="count" nameKey="loanType" cx="50%" cy="50%" outerRadius={60} strokeWidth={2}>
                        {loanTypes.map((_, i) => (
                          <Cell key={i} fill={LOAN_TYPE_COLORS[i % LOAN_TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {loanTypes.map((lt, i) => (
                      <div key={lt.loanType} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: LOAN_TYPE_COLORS[i % LOAN_TYPE_COLORS.length] }} />
                          <span className="capitalize text-muted-foreground">{lt.loanType === "lap" ? "LAP" : lt.loanType.charAt(0).toUpperCase() + lt.loanType.slice(1)}</span>
                        </div>
                        <span className="font-medium">{lt.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest application updates</CardDescription>
            </div>
            <Link href="/admin/loans">
              <Button variant="ghost" size="sm" className="text-cyan-600 hover:text-cyan-700">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!activity ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between" data-testid={`activity-item-${item.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{item.applicantName}</p>
                        <p className="text-xs text-muted-foreground">{item.action} · {formatCurrency(item.amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-700"}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                      <Link href={`/admin/loans/${item.loanId}`}>
                        <Button variant="ghost" size="icon" className="w-7 h-7">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
