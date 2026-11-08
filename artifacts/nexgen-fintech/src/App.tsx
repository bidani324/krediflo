import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { useEffect, useState } from "react";
import AdminQuickCheck from "@/pages/AdminQuickCheck";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Apply from "@/pages/Apply";
import Dashboard from "@/pages/Dashboard";
import LoanDetail from "@/pages/LoanDetail";
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLoans from "@/pages/AdminLoans";
import AdminLoanDetail from "@/pages/AdminLoanDetail";
import AdminCreateApplication from "@/pages/AdminCreateApplication";
import AdminUsers from "@/pages/AdminUsers";
import ProfileSheet from "@/pages/ProfileSheet";
import HomeLoanPage from "@/pages/HomeLoanPage";
import LAPPage from "@/pages/LAPPage";
import BusinessLoanPage from "@/pages/BusinessLoanPage";
import PersonalLoanPage from "@/pages/PersonalLoanPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, isLoadingUser } = useAuth();
  if (isLoadingUser) return null;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { admin, isLoadingAdmin } = useAuth();
  if (isLoadingAdmin) return null;
  if (!admin) return <Redirect to="/admin/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/admin/login" component={AdminLogin} />

        <Route path="/apply">
          <RequireUser><Apply /></RequireUser>
        </Route>
        <Route path="/dashboard">
          <RequireUser><Dashboard /></RequireUser>
        </Route>
        <Route path="/dashboard/:loanId">
          <RequireUser><LoanDetail /></RequireUser>
        </Route>

        <Route path="/admin">
          <RequireAdmin><AdminDashboard /></RequireAdmin>
        </Route>
        <Route path="/admin/loans">
          <RequireAdmin><AdminLoans /></RequireAdmin>
        </Route>
        <Route path="/admin/loans/:loanId">
          <RequireAdmin><AdminLoanDetail /></RequireAdmin>
        </Route>
        <Route path="/admin/create">
          <RequireAdmin><AdminCreateApplication /></RequireAdmin>
        </Route>
        <Route path="/admin/users">
          <RequireAdmin><AdminUsers /></RequireAdmin>
        </Route>
        <Route path="/admin/quick-check">
          <RequireAdmin><AdminQuickCheck /></RequireAdmin>
        </Route>

        <Route path="/profile/detail-sheet">
          <RequireUser><ProfileSheet /></RequireUser>
        </Route>

        <Route path="/home-loan" component={HomeLoanPage} />
        <Route path="/lap" component={LAPPage} />
        <Route path="/business-loan" component={BusinessLoanPage} />
        <Route path="/personal-loan" component={PersonalLoanPage} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <ThemeProvider defaultTheme="light" forcedTheme={isPhone ? "dark" : undefined} attribute="class">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
